import os, uuid, hashlib, json, sqlite3, re, shutil, threading, time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from jose import jwt, JWTError
from passlib.hash import pbkdf2_sha256

try:
    from huggingface_hub import HfApi, login as hf_login
    HF_AVAILABLE = True
except ImportError:
    HF_AVAILABLE = False
    print("[HF] huggingface_hub not installed – HF push disabled")

# ── Config ──────────────────────────────────────────────────────────────
BASE_DIR  = Path(__file__).resolve().parent.parent
DATA_DIR  = Path(os.getenv("DATA_DIR", str(BASE_DIR)))  # /data on Render, project root locally
STORAGE   = DATA_DIR / "storage"
EXPORTS   = DATA_DIR / "exports"
DB_PATH   = DATA_DIR / "mozhii.db"
SECRET    = os.getenv("JWT_SECRET", "mozhii-secret-key-2025-vdry")
ALGO      = "HS256"
TOKEN_EXP = 24  # hours
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
MAX_FILES     = 5
ALLOWED_EXT   = {".txt", ".pdf", ".docx", ".csv", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".zip", ".tar", ".gz"}
TEMP_RETENTION_DAYS = 7   # auto-delete unreviewed uploads after 7 days

# Data categories for HF repos
DATA_CATEGORIES = ["raw_text", "images", "pdf", "scan_pdf", "zip"]

_ADMIN_HASH = "$pbkdf2-sha256$29000$r3Vuzbk3hlDq/f8/hxAiRA$cgK2tah6G8i1H1jP7JWlY4R3yNNh6OopRwZtLvDqdbM"
ADMIN_USERS = {
    "Vipooshan":  _ADMIN_HASH,
    "Vishaal":    _ADMIN_HASH,
    "Dinojan":    _ADMIN_HASH,
    "Yashwin":    _ADMIN_HASH,
    "Ridursha":   _ADMIN_HASH,
    "Vishalini":  _ADMIN_HASH,
}

# ── App ─────────────────────────────────────────────────────────────────
app = FastAPI(title="Mozhii AI Data Collection")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

# Serve frontend
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "frontend")), name="static")

# ── Database ────────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        language TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        contributor_name TEXT NOT NULL,
        contributor_email TEXT NOT NULL,
        text_content TEXT,
        file_paths TEXT,
        file_hashes TEXT,
        metadata TEXT,
        pii_flags TEXT,
        profanity_flags TEXT,
        duplicate_flag INTEGER DEFAULT 0,
        data_category TEXT DEFAULT 'raw_text',
        created_at TEXT NOT NULL,
        updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id TEXT NOT NULL,
        action TEXT NOT NULL,
        admin_user TEXT NOT NULL,
        reason TEXT,
        notes TEXT,
        timestamp TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS feedbacks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        email TEXT,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stats_override (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    CREATE TABLE IF NOT EXISTS hf_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    """)
    # Insert default HF settings if not present
    hf_cur = conn.execute("SELECT COUNT(*) as c FROM hf_settings")
    if hf_cur.fetchone()["c"] == 0:
        hf_defaults = {
            "hf_token": "",
            "repo_raw_text": "",
            "repo_images": "",
            "repo_pdf": "",
            "repo_scan_pdf": "",
            "repo_zip": "",
        }
        for k, v in hf_defaults.items():
            conn.execute("INSERT INTO hf_settings VALUES (?,?)", (k, v))
    # Insert default stats if not present
    cur = conn.execute("SELECT COUNT(*) as c FROM stats_override")
    if cur.fetchone()["c"] == 0:
        conn.execute("INSERT INTO stats_override VALUES ('contributors_display', '40+')")
        conn.execute("INSERT INTO stats_override VALUES ('datasets_display', '8+')")
    conn.commit()
    conn.close()

init_db()

# Ensure storage directories exist (important for Render persistent disk)
for _d in [STORAGE / "pending", STORAGE / "approved", STORAGE / "rejected", EXPORTS]:
    _d.mkdir(parents=True, exist_ok=True)

# ── HF helpers ──────────────────────────────────────────────────────────
def get_hf_settings() -> dict:
    """Return HF settings as a dict."""
    conn = get_db()
    rows = conn.execute("SELECT key, value FROM hf_settings").fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}


def push_to_hf(category: str, file_paths: list, submission_id: str, language: str):
    """Push files to the appropriate HF dataset repo based on category."""
    try:
        settings = get_hf_settings()
        token = settings.get("hf_token", "")
        repo_key = f"repo_{category}"
        repo_id = settings.get(repo_key, "")
        if not token or not repo_id:
            print(f"[HF] Skipping push — token or repo not configured for {category}")
            return
        api = HfApi(token=token)
        # Create repo if it doesn't exist
        try:
            api.create_repo(repo_id, repo_type="dataset", exist_ok=True, private=False)
        except Exception as e:
            print(f"[HF] Repo creation note: {e}")
        # Upload each file
        for fp in file_paths:
            p = Path(fp)
            if p.exists():
                path_in_repo = f"{language}/{submission_id}/{p.name}"
                api.upload_file(
                    path_or_fileobj=str(p),
                    path_in_repo=path_in_repo,
                    repo_id=repo_id,
                    repo_type="dataset",
                )
                print(f"[HF] Uploaded {p.name} → {repo_id}/{path_in_repo}")
        print(f"[HF] Push complete for submission {submission_id} → {repo_id}")
    except Exception as e:
        print(f"[HF] Push failed: {e}")


# ── Temporary storage cleanup (7-day auto-delete) ──────────────────────
def cleanup_old_pending():
    """Background thread: delete PENDING submissions older than TEMP_RETENTION_DAYS."""
    while True:
        try:
            cutoff = (datetime.utcnow() - timedelta(days=TEMP_RETENTION_DAYS)).isoformat()
            conn = get_db()
            old = conn.execute(
                "SELECT id FROM submissions WHERE status='PENDING' AND created_at < ?",
                (cutoff,)
            ).fetchall()
            for row in old:
                sid = row["id"]
                # Remove files
                sub_dir = STORAGE / "pending"
                if sub_dir.exists():
                    for lang_dir in sub_dir.iterdir():
                        target = lang_dir / sid
                        if target.exists():
                            shutil.rmtree(target)
                conn.execute("DELETE FROM submissions WHERE id=?", (sid,))
                conn.execute(
                    "INSERT INTO audit_log (submission_id, action, admin_user, reason, notes, timestamp) VALUES (?, 'AUTO_DELETED', 'system', '7-day retention expired', '', ?)",
                    (sid, datetime.utcnow().isoformat())
                )
                print(f"[CLEANUP] Deleted expired submission {sid}")
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"[CLEANUP] Error: {e}")
        time.sleep(6 * 3600)  # Run every 6 hours

_cleanup_thread = threading.Thread(target=cleanup_old_pending, daemon=True)
_cleanup_thread.start()


# ── Auth helpers ────────────────────────────────────────────────────────
def create_token(username: str):
    return jwt.encode({"sub": username, "exp": datetime.utcnow() + timedelta(hours=TOKEN_EXP)}, SECRET, algorithm=ALGO)

def verify_token(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(auth[7:], SECRET, algorithms=[ALGO])
        user = payload.get("sub")
        if user not in ADMIN_USERS:
            raise HTTPException(403, "Forbidden")
        return user
    except JWTError:
        raise HTTPException(401, "Invalid token")

# ── PII / Profanity detection (lightweight) ─────────────────────────────
PII_PATTERNS = [
    r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',           # phone
    r'\b\d{9,12}\b',                               # long numbers (ID-like)
    r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',  # email
    r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b',   # IP
    r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b', # credit card
]

def check_pii(text: str) -> List[str]:
    flags = []
    for pat in PII_PATTERNS:
        if re.search(pat, text or ""):
            flags.append(pat)
    return flags

def check_profanity(text: str) -> bool:
    try:
        from better_profanity import profanity
        return profanity.contains_profanity(text or "")
    except:
        return False

def extract_text_from_file(filepath: str) -> str:
    ext = Path(filepath).suffix.lower()
    try:
        if ext == ".txt":
            return Path(filepath).read_text(errors="ignore")[:5000]
        elif ext == ".csv":
            return Path(filepath).read_text(errors="ignore")[:5000]
        elif ext == ".pdf":
            from PyPDF2 import PdfReader
            reader = PdfReader(filepath)
            text = ""
            for page in reader.pages[:5]:
                text += page.extract_text() or ""
            return text[:5000]
        elif ext == ".docx":
            from docx import Document
            doc = Document(filepath)
            return "\n".join([p.text for p in doc.paragraphs])[:5000]
        elif ext in {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}:
            return "[Image file]"
    except:
        pass
    return ""

# ── Routes: Pages ──────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
async def home():
    return FileResponse(str(BASE_DIR / "frontend" / "index.html"))

@app.get("/admin", response_class=HTMLResponse)
async def admin_page():
    return FileResponse(str(BASE_DIR / "frontend" / "admin.html"))

# ── Routes: Public ─────────────────────────────────────────────────────
@app.post("/api/submit")
async def submit_contribution(
    language: str = Form(...),
    contributor_name: str = Form(...),
    contributor_email: str = Form(...),
    text_content: Optional[str] = Form(None),
    consent: str = Form(...),
    files: List[UploadFile] = File(default=[])
):
    if consent != "true":
        raise HTTPException(400, "Consent is required")
    if language not in ("tamil", "sinhala", "english"):
        raise HTTPException(400, "Invalid language")
    if not text_content and len(files) == 0:
        raise HTTPException(400, "Provide text or upload files")
    if len(files) > MAX_FILES:
        raise HTTPException(400, f"Max {MAX_FILES} files allowed")

    sid = f"MZH-{uuid.uuid4().hex[:8].upper()}"
    folder = STORAGE / "pending" / language / sid
    folder.mkdir(parents=True, exist_ok=True)

    saved_files = []
    file_hashes = []
    all_text = text_content or ""

    for f in files:
        ext = Path(f.filename).suffix.lower()
        if ext not in ALLOWED_EXT:
            raise HTTPException(400, f"File type {ext} not allowed")
        data = await f.read()
        if len(data) > MAX_FILE_SIZE:
            raise HTTPException(400, f"File {f.filename} exceeds 20MB")
        fpath = folder / f.filename
        fpath.write_bytes(data)
        saved_files.append(str(fpath))
        file_hashes.append(hashlib.sha256(data).hexdigest())
        extracted = extract_text_from_file(str(fpath))
        all_text += "\n" + extracted

    pii = check_pii(all_text)
    prof = check_profanity(all_text)

    # Duplicate check
    conn = get_db()
    dup = 0
    if all_text.strip():
        text_hash = hashlib.sha256(all_text.strip().encode()).hexdigest()
        cur = conn.execute("SELECT COUNT(*) as c FROM submissions WHERE file_hashes LIKE ?", (f"%{text_hash}%",))
        if cur.fetchone()["c"] > 0:
            dup = 1

    # Auto-detect data category
    detected_category = "raw_text"
    if files:
        exts = [Path(f.filename).suffix.lower() for f in files]
        if any(e in (".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp") for e in exts):
            detected_category = "images"
        elif any(e == ".pdf" for e in exts):
            detected_category = "pdf"
        elif any(e in (".zip", ".tar", ".gz") for e in exts):
            detected_category = "zip"

    conn.execute("""INSERT INTO submissions
        (id, language, status, contributor_name, contributor_email, text_content,
         file_paths, file_hashes, metadata, pii_flags, profanity_flags, duplicate_flag, created_at, data_category)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (sid, language, "PENDING", contributor_name, contributor_email,
         text_content, json.dumps(saved_files), json.dumps(file_hashes),
         json.dumps({"file_count": len(files), "text_length": len(all_text)}),
         json.dumps(pii), json.dumps(prof), dup, datetime.utcnow().isoformat(), detected_category))
    conn.commit()
    conn.close()

    return {"status": "success", "submission_id": sid, "message": "Thank you for your contribution!"}

@app.get("/api/public-stats")
async def public_stats():
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) as c FROM submissions WHERE status='APPROVED'").fetchone()["c"]
    contributors = conn.execute("SELECT COUNT(DISTINCT contributor_email) as c FROM submissions").fetchone()["c"]
    # Get display overrides
    c_display = conn.execute("SELECT value FROM stats_override WHERE key='contributors_display'").fetchone()
    d_display = conn.execute("SELECT value FROM stats_override WHERE key='datasets_display'").fetchone()
    conn.close()
    return {
        "contributors_display": c_display["value"] if c_display else f"{contributors}+",
        "datasets_display": d_display["value"] if d_display else f"{total}+",
        "total_approved": total,
        "total_contributors": contributors
    }

# ── Routes: Feedback ───────────────────────────────────────────────────
@app.post("/api/feedback")
async def submit_feedback(request: Request):
    data = await request.json()
    name = data.get("name", "")
    email = data.get("email", "")
    message = data["message"]

    # Save to database
    conn = get_db()
    conn.execute("INSERT INTO feedbacks (name, email, message, created_at) VALUES (?,?,?,?)",
                 (name, email, message, datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()

    # Email now handled via EmailJS on frontend

    return {"status": "success"}

# ── Routes: Admin Auth ─────────────────────────────────────────────────
@app.post("/api/admin/login")
async def admin_login(request: Request):
    data = await request.json()
    username = data.get("username", "")
    password = data.get("password", "")
    if username not in ADMIN_USERS:
        raise HTTPException(401, "Invalid credentials")
    if not pbkdf2_sha256.verify(password, ADMIN_USERS[username]):
        raise HTTPException(401, "Invalid credentials")
    return {"token": create_token(username), "username": username}

# ── Routes: Admin Dashboard ────────────────────────────────────────────
@app.get("/api/admin/stats")
async def admin_stats(user: str = Depends(verify_token)):
    conn = get_db()
    stats = {}
    for status in ["PENDING", "APPROVED", "REJECTED"]:
        row = conn.execute("SELECT COUNT(*) as c FROM submissions WHERE status=?", (status,)).fetchone()
        stats[status.lower()] = row["c"]
    for lang in ["tamil", "sinhala", "english"]:
        row = conn.execute("SELECT COUNT(*) as c FROM submissions WHERE language=?", (lang,)).fetchone()
        stats[f"lang_{lang}"] = row["c"]
    stats["total"] = stats["pending"] + stats["approved"] + stats["rejected"]
    # Feedbacks count
    row = conn.execute("SELECT COUNT(*) as c FROM feedbacks").fetchone()
    stats["feedbacks"] = row["c"]
    conn.close()
    return stats

@app.get("/api/admin/submissions")
async def admin_submissions(
    user: str = Depends(verify_token),
    status: Optional[str] = Query(None),
    language: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1),
    limit: int = Query(20)
):
    conn = get_db()
    query = "SELECT * FROM submissions WHERE 1=1"
    params = []
    if status:
        query += " AND status=?"
        params.append(status)
    if language:
        query += " AND language=?"
        params.append(language)
    if search:
        query += " AND (contributor_name LIKE ? OR text_content LIKE ? OR id LIKE ?)"
        s = f"%{search}%"
        params.extend([s, s, s])
    if date_from:
        query += " AND created_at >= ?"
        params.append(date_from)
    if date_to:
        query += " AND created_at <= ?"
        params.append(date_to + "T23:59:59")
    
    # Count
    count_q = query.replace("SELECT *", "SELECT COUNT(*) as c")
    total = conn.execute(count_q, params).fetchone()["c"]
    
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, (page - 1) * limit])
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return {"total": total, "page": page, "submissions": [dict(r) for r in rows]}

@app.get("/api/admin/submission/{sid}")
async def admin_submission_detail(sid: str, user: str = Depends(verify_token)):
    conn = get_db()
    row = conn.execute("SELECT * FROM submissions WHERE id=?", (sid,)).fetchone()
    if not row:
        raise HTTPException(404, "Not found")
    # Get audit log
    logs = conn.execute("SELECT * FROM audit_log WHERE submission_id=? ORDER BY timestamp DESC", (sid,)).fetchall()
    conn.close()
    result = dict(row)
    result["audit_log"] = [dict(l) for l in logs]
    
    # Extract text preview from files
    file_paths = json.loads(result.get("file_paths") or "[]")
    previews = []
    for fp in file_paths:
        if os.path.exists(fp):
            previews.append({"file": os.path.basename(fp), "preview": extract_text_from_file(fp)[:1000]})
    result["file_previews"] = previews
    return result

@app.post("/api/admin/submission/{sid}/approve")
async def approve_submission(sid: str, request: Request, user: str = Depends(verify_token)):
    data = await request.json() if request.headers.get("content-type") == "application/json" else {}
    conn = get_db()
    row = conn.execute("SELECT * FROM submissions WHERE id=?", (sid,)).fetchone()
    if not row:
        raise HTTPException(404, "Not found")
    
    sub = dict(row)
    lang = sub["language"]
    
    # Admin can override the data category
    category = data.get("data_category") or sub.get("data_category") or "raw_text"
    
    # Move files to approved
    file_paths = json.loads(sub.get("file_paths") or "[]")
    new_paths = []
    approved_dir = STORAGE / "approved" / lang / sid
    approved_dir.mkdir(parents=True, exist_ok=True)
    for fp in file_paths:
        if os.path.exists(fp):
            dest = approved_dir / os.path.basename(fp)
            shutil.move(fp, str(dest))
            new_paths.append(str(dest))
    
    # Clean up pending folder
    pending_dir = STORAGE / "pending" / lang / sid
    if pending_dir.exists():
        shutil.rmtree(str(pending_dir), ignore_errors=True)
    
    # Update DB
    conn.execute("UPDATE submissions SET status='APPROVED', data_category=?, file_paths=?, updated_at=? WHERE id=?",
                 (category, json.dumps(new_paths), datetime.utcnow().isoformat(), sid))
    
    # Audit
    conn.execute("INSERT INTO audit_log (submission_id, action, admin_user, reason, notes, timestamp) VALUES (?,?,?,?,?,?)",
                 (sid, "APPROVED", user, data.get("reason", ""), data.get("notes", ""), datetime.utcnow().isoformat()))
    conn.commit()
    
    # Export to JSONL
    export_file = EXPORTS / lang / f"{lang}_approved.jsonl"
    export_file.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "id": sid,
        "language": lang,
        "text": sub.get("text_content") or "",
        "source": "public_contribution",
        "category": category,
        "created_at": sub["created_at"]
    }
    # Also extract text from files
    for fp in new_paths:
        txt = extract_text_from_file(fp)
        if txt and txt != "[Image file]":
            entry["text"] += "\n" + txt
    
    with open(str(export_file), "a") as f:
        f.write(json.dumps(entry) + "\n")
    
    # Push to Hugging Face in background
    hf_pushed = False
    all_push_files = new_paths[:]
    # If category is raw_text and there's text but no files, create a text file
    if category == "raw_text" and sub.get("text_content") and not new_paths:
        txt_file = approved_dir / f"{sid}.txt"
        txt_file.write_text(sub["text_content"])
        all_push_files = [str(txt_file)]
    
    if all_push_files:
        def _push():
            push_to_hf(category, all_push_files, sid, lang)
        t = threading.Thread(target=_push, daemon=True)
        t.start()
        hf_pushed = True
    
    conn.close()
    return {"status": "approved", "submission_id": sid, "hf_push_initiated": hf_pushed}

@app.post("/api/admin/submission/{sid}/reject")
async def reject_submission(sid: str, request: Request, user: str = Depends(verify_token)):
    data = await request.json() if request.headers.get("content-type") == "application/json" else {}
    reason = data.get("reason", "Your submission did not meet our guidelines.")
    
    conn = get_db()
    row = conn.execute("SELECT * FROM submissions WHERE id=?", (sid,)).fetchone()
    if not row:
        raise HTTPException(404, "Not found")
    
    sub = dict(row)
    lang = sub["language"]
    
    # Move files to rejected
    file_paths = json.loads(sub.get("file_paths") or "[]")
    new_paths = []
    rejected_dir = STORAGE / "rejected" / lang / sid
    rejected_dir.mkdir(parents=True, exist_ok=True)
    for fp in file_paths:
        if os.path.exists(fp):
            dest = rejected_dir / os.path.basename(fp)
            shutil.move(fp, str(dest))
            new_paths.append(str(dest))
    
    # Clean up pending
    pending_dir = STORAGE / "pending" / lang / sid
    if pending_dir.exists():
        shutil.rmtree(str(pending_dir), ignore_errors=True)
    
    conn.execute("UPDATE submissions SET status='REJECTED', file_paths=?, updated_at=? WHERE id=?",
                 (json.dumps(new_paths), datetime.utcnow().isoformat(), sid))
    conn.execute("INSERT INTO audit_log (submission_id, action, admin_user, reason, notes, timestamp) VALUES (?,?,?,?,?,?)",
                 (sid, "REJECTED", user, reason, data.get("notes", ""), datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()
    return {"status": "rejected", "submission_id": sid, "reason": reason}

@app.get("/api/admin/audit-log")
async def admin_audit_log(user: str = Depends(verify_token), page: int = Query(1), limit: int = Query(50)):
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) as c FROM audit_log").fetchone()["c"]
    rows = conn.execute("SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ? OFFSET ?",
                        (limit, (page - 1) * limit)).fetchall()
    conn.close()
    return {"total": total, "logs": [dict(r) for r in rows]}

@app.get("/api/admin/feedbacks")
async def admin_feedbacks(user: str = Depends(verify_token)):
    conn = get_db()
    rows = conn.execute("SELECT * FROM feedbacks ORDER BY created_at DESC").fetchall()
    conn.close()
    return {"feedbacks": [dict(r) for r in rows]}

@app.put("/api/admin/stats-override")
async def update_stats_override(request: Request, user: str = Depends(verify_token)):
    data = await request.json()
    conn = get_db()
    for key, val in data.items():
        conn.execute("INSERT OR REPLACE INTO stats_override (key, value) VALUES (?,?)", (key, str(val)))
    conn.commit()
    conn.close()
    return {"status": "updated"}

# ── Routes: HF Settings ────────────────────────────────────────────────
@app.get("/api/admin/hf-settings")
async def get_hf_settings_api(user: str = Depends(verify_token)):
    settings = get_hf_settings()
    # Mask token for display
    tok = settings.get("hf_token", "")
    settings["hf_token_masked"] = (tok[:4] + "****" + tok[-4:]) if len(tok) > 8 else ("****" if tok else "")
    settings["hf_available"] = HF_AVAILABLE
    settings["categories"] = DATA_CATEGORIES
    return settings

@app.put("/api/admin/hf-settings")
async def update_hf_settings_api(request: Request, user: str = Depends(verify_token)):
    data = await request.json()
    conn = get_db()
    allowed_keys = {"hf_token", "repo_raw_text", "repo_images", "repo_pdf", "repo_scan_pdf", "repo_zip"}
    for key, val in data.items():
        if key in allowed_keys:
            conn.execute("INSERT OR REPLACE INTO hf_settings (key, value) VALUES (?,?)", (key, str(val)))
    conn.commit()
    conn.close()
    return {"status": "updated"}

@app.post("/api/admin/hf-test")
async def test_hf_connection(user: str = Depends(verify_token)):
    """Test HF token validity."""
    if not HF_AVAILABLE:
        return {"success": False, "error": "huggingface_hub not installed"}
    settings = get_hf_settings()
    tok = settings.get("hf_token", "")
    if not tok:
        return {"success": False, "error": "No token configured"}
    try:
        api = HfApi(token=tok)
        info = api.whoami()
        return {"success": True, "username": info.get("name", "unknown")}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/admin/storage-info")
async def storage_info(user: str = Depends(verify_token)):
    """Return temporary storage stats."""
    conn = get_db()
    pending = conn.execute("SELECT COUNT(*) as c FROM submissions WHERE status='PENDING'").fetchone()["c"]
    oldest = conn.execute("SELECT MIN(created_at) as oldest FROM submissions WHERE status='PENDING'").fetchone()["oldest"]
    conn.close()
    
    # Calculate storage size
    pending_dir = STORAGE / "pending"
    total_size = 0
    if pending_dir.exists():
        for f in pending_dir.rglob("*"):
            if f.is_file():
                total_size += f.stat().st_size
    
    return {
        "pending_count": pending,
        "oldest_pending": oldest,
        "retention_days": TEMP_RETENTION_DAYS,
        "storage_bytes": total_size,
        "storage_mb": round(total_size / (1024 * 1024), 2)
    }
