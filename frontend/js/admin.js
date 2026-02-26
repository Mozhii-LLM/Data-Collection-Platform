/* ══════════════════════════════════════════════════════════════
   MOZHII.AI — Admin Panel JavaScript
   ══════════════════════════════════════════════════════════════ */

let token = localStorage.getItem("mozhii_admin_token") || "";
let adminUser = localStorage.getItem("mozhii_admin_user") || "";
let currentPage = 1;

document.addEventListener("DOMContentLoaded", () => {
    initAdminTheme();
    
    if (token) {
        showPanel();
    }

    // Login
    document.getElementById("loginForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const user = document.getElementById("loginUser").value.trim();
        const pass = document.getElementById("loginPass").value;
        const errEl = document.getElementById("loginError");

        try {
            const res = await fetch("/api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: user, password: pass })
            });
            if (!res.ok) {
                errEl.textContent = "Invalid username or password";
                errEl.classList.remove("hidden");
                return;
            }
            const data = await res.json();
            token = data.token;
            adminUser = data.username;
            localStorage.setItem("mozhii_admin_token", token);
            localStorage.setItem("mozhii_admin_user", adminUser);
            errEl.classList.add("hidden");
            showPanel();
        } catch (err) {
            errEl.textContent = "Connection error. Please try again.";
            errEl.classList.remove("hidden");
        }
    });

    // Sidebar nav
    document.querySelectorAll(".sidebar-link").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const view = link.dataset.view;
            switchView(view);
        });
    });

    // Logout
    document.getElementById("logoutBtn").addEventListener("click", () => {
        token = "";
        adminUser = "";
        localStorage.removeItem("mozhii_admin_token");
        localStorage.removeItem("mozhii_admin_user");
        document.getElementById("adminPanel").classList.add("hidden");
        document.getElementById("loginScreen").classList.remove("hidden");
    });

    // Mobile sidebar
    document.getElementById("sidebarToggle").addEventListener("click", () => {
        document.getElementById("adminSidebar").classList.toggle("open");
    });

    // Filters
    document.getElementById("applyFilters").addEventListener("click", () => {
        currentPage = 1;
        loadSubmissions();
    });

    // Settings save
    document.getElementById("saveStats").addEventListener("click", saveStatsOverride);

    // HF settings
    document.getElementById("saveHfSettings").addEventListener("click", saveHfSettings);
    document.getElementById("testHfConnection").addEventListener("click", testHfConnection);
});

function headers() {
    return { "Authorization": "Bearer " + token, "Content-Type": "application/json" };
}

function showPanel() {
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    document.getElementById("adminUsername").textContent = adminUser;
    document.getElementById("adminAvatar").textContent = adminUser.charAt(0).toUpperCase();
    loadDashboard();
}

function switchView(view) {
    document.querySelectorAll(".sidebar-link").forEach(l => l.classList.remove("active"));
    document.querySelector(`.sidebar-link[data-view="${view}"]`).classList.add("active");
    document.querySelectorAll(".admin-view").forEach(v => v.classList.remove("active"));

    const titles = { dashboard: "Dashboard", submissions: "Submissions", audit: "Audit Log", feedbacks: "Feedbacks", settings: "Settings" };
    const subtitles = {
        dashboard: "Overview of all submissions and activity",
        submissions: "Review, approve, or reject contributor data",
        audit: "History of all admin actions",
        feedbacks: "Messages from contributors",
        settings: "Configure public display settings"
    };
    document.getElementById("viewTitle").textContent = titles[view] || view;
    const subtitleEl = document.getElementById("viewSubtitle");
    if (subtitleEl) subtitleEl.textContent = subtitles[view] || "";

    const viewEl = document.getElementById(view + "View");
    if (viewEl) viewEl.classList.add("active");

    // Close mobile sidebar
    document.getElementById("adminSidebar").classList.remove("open");

    if (view === "dashboard") loadDashboard();
    else if (view === "submissions") loadSubmissions();
    else if (view === "audit") loadAuditLog();
    else if (view === "feedbacks") loadFeedbacks();
    else if (view === "settings") { loadHfSettings(); loadStorageInfo(); }
}

/* ── Dashboard ─────────────────────────────────────────────── */
async function loadDashboard() {
    try {
        const res = await fetch("/api/admin/stats", { headers: { "Authorization": "Bearer " + token } });
        if (res.status === 401) { logout(); return; }
        const data = await res.json();

        animateNumber("sPending", data.pending || 0);
        animateNumber("sApproved", data.approved || 0);
        animateNumber("sRejected", data.rejected || 0);
        animateNumber("sTotal", data.total || 0);

        // Update pending badge in sidebar
        const badge = document.getElementById("pendingBadge");
        if (badge) badge.textContent = data.pending > 0 ? data.pending : "";

        document.getElementById("lTamil").textContent = data.lang_tamil || 0;
        document.getElementById("lSinhala").textContent = data.lang_sinhala || 0;
        document.getElementById("lEnglish").textContent = data.lang_english || 0;

        const total = data.total || 1;
        document.getElementById("lTamilBar").style.width = ((data.lang_tamil / total) * 100) + "%";
        document.getElementById("lSinhalaBar").style.width = ((data.lang_sinhala / total) * 100) + "%";
        document.getElementById("lEnglishBar").style.width = ((data.lang_english / total) * 100) + "%";
    } catch (err) {
        console.error("Dashboard load error:", err);
    }
}

function animateNumber(id, target) {
    const el = document.getElementById(id);
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const interval = setInterval(() => {
        current += step;
        if (current >= target) {
            current = target;
            clearInterval(interval);
        }
        el.textContent = current;
    }, 30);
}

/* ── Submissions ───────────────────────────────────────────── */
async function loadSubmissions() {
    const status = document.getElementById("filterStatus").value;
    const lang = document.getElementById("filterLang").value;
    const search = document.getElementById("filterSearch").value;
    const from = document.getElementById("filterFrom").value;
    const to = document.getElementById("filterTo").value;

    let url = `/api/admin/submissions?page=${currentPage}&limit=15`;
    if (status) url += `&status=${status}`;
    if (lang) url += `&language=${lang}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (from) url += `&date_from=${from}`;
    if (to) url += `&date_to=${to}`;

    try {
        const res = await fetch(url, { headers: { "Authorization": "Bearer " + token } });
        if (res.status === 401) { logout(); return; }
        const data = await res.json();
        renderSubmissions(data.submissions, data.total);
    } catch (err) {
        console.error("Submissions load error:", err);
    }
}

function renderSubmissions(submissions, total) {
    const body = document.getElementById("submissionsBody");
    
    if (submissions.length === 0) {
        body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">
            <i class="fas fa-inbox" style="font-size:32px;margin-bottom:8px;display:block;opacity:0.3"></i>
            No submissions found</td></tr>`;
        document.getElementById("pagination").innerHTML = "";
        return;
    }

    body.innerHTML = submissions.map(s => {
        const date = new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const maskedEmail = s.contributor_email.replace(/(.{2}).*(@.*)/, "$1***$2");
        return `<tr>
            <td><strong style="color:var(--accent)">${s.id}</strong></td>
            <td><span class="lang-badge ${s.language}">${s.language}</span></td>
            <td>
                <div style="font-weight:500">${s.contributor_name}</div>
                <div style="font-size:12px;color:var(--text-muted)">${maskedEmail}</div>
            </td>
            <td><span class="status-badge status-${s.status}">${s.status}</span></td>
            <td style="font-size:13px;color:var(--text-muted)">${date}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn view" title="View" onclick="viewSubmission('${s.id}')"><i class="fas fa-eye"></i></button>
                    ${s.status === "PENDING" ? `
                        <button class="action-btn approve" title="Approve" onclick="quickApprove('${s.id}')"><i class="fas fa-check"></i></button>
                        <button class="action-btn reject" title="Reject" onclick="quickReject('${s.id}')"><i class="fas fa-times"></i></button>
                    ` : ""}
                </div>
            </td>
        </tr>`;
    }).join("");

    // Pagination
    const totalPages = Math.ceil(total / 15);
    const pagination = document.getElementById("pagination");
    let pagHtml = "";
    for (let i = 1; i <= totalPages; i++) {
        pagHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    pagination.innerHTML = pagHtml;
}

function goToPage(page) {
    currentPage = page;
    loadSubmissions();
}

/* ── View Submission Detail ────────────────────────────────── */
async function viewSubmission(sid) {
    try {
        const res = await fetch(`/api/admin/submission/${sid}`, { headers: { "Authorization": "Bearer " + token } });
        if (res.status === 401) { logout(); return; }
        const s = await res.json();

        const pii = JSON.parse(s.pii_flags || "[]");
        const prof = JSON.parse(s.profanity_flags || "false");
        const maskedEmail = s.contributor_email.replace(/(.{2}).*(@.*)/, "$1***$2");

        let flagsHtml = "";
        if (pii.length > 0) flagsHtml += `<span class="flag-badge flag-pii"><i class="fas fa-exclamation-triangle"></i> PII Detected</span>`;
        if (prof === true || prof === "true") flagsHtml += `<span class="flag-badge flag-profanity"><i class="fas fa-exclamation-triangle"></i> Profanity Detected</span>`;
        if (s.duplicate_flag) flagsHtml += `<span class="flag-badge flag-duplicate"><i class="fas fa-copy"></i> Possible Duplicate</span>`;
        if (!pii.length && !prof && !s.duplicate_flag) flagsHtml += `<span class="flag-badge flag-clean"><i class="fas fa-check-circle"></i> Clean</span>`;

        let previewsHtml = "";
        if (s.file_previews && s.file_previews.length > 0) {
            previewsHtml = s.file_previews.map(fp => `
                <div style="margin-top:8px">
                    <div style="font-size:13px;font-weight:600;margin-bottom:4px"><i class="fas fa-file"></i> ${fp.file}</div>
                    <div class="text-preview">${escapeHtml(fp.preview || "[No text extracted]")}</div>
                </div>
            `).join("");
        }

        document.getElementById("detailContent").innerHTML = `
            <div class="detail-row"><span class="detail-label">ID</span><span class="detail-value" style="color:var(--accent);font-weight:600">${s.id}</span></div>
            <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="status-badge status-${s.status}">${s.status}</span></span></div>
            <div class="detail-row"><span class="detail-label">Language</span><span class="detail-value"><span class="lang-badge">${s.language}</span></span></div>
            <div class="detail-row"><span class="detail-label">Contributor</span><span class="detail-value">${s.contributor_name}</span></div>
            <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${maskedEmail}</span></div>
            <div class="detail-row"><span class="detail-label">Submitted</span><span class="detail-value">${new Date(s.created_at).toLocaleString()}</span></div>
            
            <div class="detail-section">
                <h4><i class="fas fa-shield-alt"></i> Auto-Check Results</h4>
                <div style="margin-top:8px">${flagsHtml}</div>
            </div>

            ${s.text_content ? `
            <div class="detail-section">
                <h4><i class="fas fa-align-left"></i> Text Content</h4>
                <div class="text-preview">${escapeHtml(s.text_content)}</div>
            </div>` : ""}

            ${previewsHtml ? `
            <div class="detail-section">
                <h4><i class="fas fa-file-alt"></i> File Previews</h4>
                ${previewsHtml}
            </div>` : ""}

            ${s.audit_log && s.audit_log.length > 0 ? `
            <div class="detail-section">
                <h4><i class="fas fa-history"></i> Audit History</h4>
                ${s.audit_log.map(log => `
                    <div style="font-size:13px;padding:8px 0;border-bottom:1px solid var(--border)">
                        <span class="audit-action audit-${log.action}">${log.action}</span>
                        by <strong>${log.admin_user}</strong> 
                        at ${new Date(log.timestamp).toLocaleString()}
                        ${log.reason ? `<br><span style="color:var(--text-muted)">Reason: ${log.reason}</span>` : ""}
                    </div>
                `).join("")}
            </div>` : ""}
        `;

        // Actions
        const actions = document.getElementById("detailActions");
        if (s.status === "PENDING") {
            actions.innerHTML = `
                <div style="width:100%;margin-bottom:8px">
                    <label style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;display:block">Data Category (for HF repo)</label>
                    <div class="category-selector">
                        <button class="cat-btn ${(s.data_category||'raw_text')==='raw_text'?'active':''}" data-cat="raw_text"><i class="fas fa-align-left"></i> Raw Text</button>
                        <button class="cat-btn ${(s.data_category||'raw_text')==='images'?'active':''}" data-cat="images"><i class="fas fa-images"></i> Images</button>
                        <button class="cat-btn ${(s.data_category||'raw_text')==='pdf'?'active':''}" data-cat="pdf"><i class="fas fa-file-pdf"></i> PDF</button>
                        <button class="cat-btn ${(s.data_category||'raw_text')==='scan_pdf'?'active':''}" data-cat="scan_pdf"><i class="fas fa-file-image"></i> Scan PDF</button>
                        <button class="cat-btn ${(s.data_category||'raw_text')==='zip'?'active':''}" data-cat="zip"><i class="fas fa-file-archive"></i> ZIP</button>
                    </div>
                </div>
                <input type="text" class="reason-input" id="actionReason" placeholder="Reason / Notes (optional)" style="width:100%">
                <button class="btn btn-sm" style="background:#10B981;color:white;border:none" onclick="approveSubmission('${s.id}')">
                    <i class="fas fa-check"></i> Approve & Push to HF
                </button>
                <button class="btn btn-sm" style="background:#EF4444;color:white;border:none" onclick="rejectSubmission('${s.id}')">
                    <i class="fas fa-times"></i> Reject
                </button>
                <button class="btn btn-outline btn-sm" onclick="closeModal()">Cancel</button>
            `;
            // Category selector click handler
            actions.querySelectorAll('.cat-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    actions.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });
        } else {
            actions.innerHTML = `<button class="btn btn-outline btn-sm" onclick="closeModal()">Close</button>`;
        }

        document.getElementById("detailModal").classList.add("active");
    } catch (err) {
        console.error("Detail load error:", err);
        alert("Failed to load submission details.");
    }
}

function closeModal() {
    document.getElementById("detailModal").classList.remove("active");
}

/* ── Approve / Reject ──────────────────────────────────────── */
async function approveSubmission(sid) {
    const reason = document.getElementById("actionReason")?.value || "";
    const activeCat = document.querySelector('.cat-btn.active');
    const data_category = activeCat ? activeCat.dataset.cat : "raw_text";
    try {
        const res = await fetch(`/api/admin/submission/${sid}/approve`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ reason, notes: reason, data_category })
        });
        if (res.ok) {
            closeModal();
            loadSubmissions();
            loadDashboard();
        } else {
            alert("Failed to approve.");
        }
    } catch (err) {
        alert("Error approving submission.");
    }
}

async function rejectSubmission(sid) {
    const reason = document.getElementById("actionReason")?.value || "Your submission did not meet our guidelines.";
    try {
        const res = await fetch(`/api/admin/submission/${sid}/reject`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ reason, notes: reason })
        });
        if (res.ok) {
            closeModal();
            loadSubmissions();
            loadDashboard();
        } else {
            alert("Failed to reject.");
        }
    } catch (err) {
        alert("Error rejecting submission.");
    }
}

async function quickApprove(sid) {
    if (!confirm("Approve this submission?")) return;
    try {
        const res = await fetch(`/api/admin/submission/${sid}/approve`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ reason: "Quick approve", notes: "" })
        });
        if (res.ok) { loadSubmissions(); loadDashboard(); }
    } catch (err) { alert("Error."); }
}

async function quickReject(sid) {
    const reason = prompt("Reason for rejection:", "Your submission did not meet our data quality guidelines.");
    if (reason === null) return;
    try {
        const res = await fetch(`/api/admin/submission/${sid}/reject`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ reason, notes: "" })
        });
        if (res.ok) { loadSubmissions(); loadDashboard(); }
    } catch (err) { alert("Error."); }
}

/* ── Audit Log ─────────────────────────────────────────────── */
async function loadAuditLog() {
    try {
        const res = await fetch("/api/admin/audit-log", { headers: { "Authorization": "Bearer " + token } });
        if (res.status === 401) { logout(); return; }
        const data = await res.json();
        const body = document.getElementById("auditBody");

        if (data.logs.length === 0) {
            body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">No audit entries yet</td></tr>`;
            return;
        }

        body.innerHTML = data.logs.map(log => `<tr>
            <td><strong style="color:var(--accent)">${log.submission_id}</strong></td>
            <td><span class="audit-action audit-${log.action}">${log.action}</span></td>
            <td style="font-weight:500">${log.admin_user}</td>
            <td style="font-size:13px">${log.reason || "-"}</td>
            <td style="font-size:13px;color:var(--text-muted)">${log.notes || "-"}</td>
            <td style="font-size:13px;color:var(--text-muted)">${new Date(log.timestamp).toLocaleString()}</td>
        </tr>`).join("");
    } catch (err) {
        console.error("Audit log error:", err);
    }
}

/* ── Feedbacks ─────────────────────────────────────────────── */
async function loadFeedbacks() {
    try {
        const res = await fetch("/api/admin/feedbacks", { headers: { "Authorization": "Bearer " + token } });
        if (res.status === 401) { logout(); return; }
        const data = await res.json();
        const list = document.getElementById("feedbacksList");

        if (data.feedbacks.length === 0) {
            list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">
                <i class="fas fa-comment-slash" style="font-size:32px;margin-bottom:8px;display:block;opacity:0.3"></i>
                No feedbacks yet</div>`;
            return;
        }

        list.innerHTML = data.feedbacks.map(fb => `
            <div class="feedback-card">
                <div class="feedback-card-header">
                    <span class="name">${fb.name || "Anonymous"} ${fb.email ? `(${fb.email})` : ""}</span>
                    <span class="date">${new Date(fb.created_at).toLocaleString()}</span>
                </div>
                <p>${escapeHtml(fb.message)}</p>
            </div>
        `).join("");
    } catch (err) {
        console.error("Feedbacks error:", err);
    }
}

/* ── HF Settings ───────────────────────────────────────────── */
async function loadHfSettings() {
    try {
        const res = await fetch("/api/admin/hf-settings", { headers: { "Authorization": "Bearer " + token } });
        if (res.status === 401) { logout(); return; }
        const data = await res.json();

        document.getElementById("hfToken").placeholder = data.hf_token_masked || "hf_xxxxx...";
        document.getElementById("hfRepoRawText").value = data.repo_raw_text || "";
        document.getElementById("hfRepoImages").value = data.repo_images || "";
        document.getElementById("hfRepoPdf").value = data.repo_pdf || "";
        document.getElementById("hfRepoScanPdf").value = data.repo_scan_pdf || "";
        document.getElementById("hfRepoZip").value = data.repo_zip || "";

        const statusEl = document.getElementById("hfStatus");
        if (!data.hf_available) {
            statusEl.innerHTML = `<span class="hf-badge hf-warn"><i class="fas fa-exclamation-triangle"></i> huggingface_hub not installed</span>`;
        } else if (data.hf_token_masked) {
            statusEl.innerHTML = `<span class="hf-badge hf-ok"><i class="fas fa-check-circle"></i> Token configured (${data.hf_token_masked})</span>`;
        } else {
            statusEl.innerHTML = `<span class="hf-badge hf-none"><i class="fas fa-info-circle"></i> No token set</span>`;
        }
    } catch (err) {
        console.error("HF settings load error:", err);
    }
}

async function saveHfSettings() {
    const tokenVal = document.getElementById("hfToken").value.trim();
    const body = {
        repo_raw_text: document.getElementById("hfRepoRawText").value.trim(),
        repo_images: document.getElementById("hfRepoImages").value.trim(),
        repo_pdf: document.getElementById("hfRepoPdf").value.trim(),
        repo_scan_pdf: document.getElementById("hfRepoScanPdf").value.trim(),
        repo_zip: document.getElementById("hfRepoZip").value.trim(),
    };
    if (tokenVal) body.hf_token = tokenVal;

    try {
        const res = await fetch("/api/admin/hf-settings", {
            method: "PUT",
            headers: headers(),
            body: JSON.stringify(body)
        });
        if (res.ok) {
            alert("HF settings saved!");
            document.getElementById("hfToken").value = "";
            loadHfSettings();
        }
    } catch (err) {
        alert("Failed to save HF settings.");
    }
}

async function testHfConnection() {
    const btn = document.getElementById("testHfConnection");
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Testing...';
    try {
        const res = await fetch("/api/admin/hf-test", {
            method: "POST",
            headers: headers()
        });
        const data = await res.json();
        if (data.success) {
            alert(`Connected as: ${data.username}`);
        } else {
            alert(`Connection failed: ${data.error}`);
        }
    } catch (err) {
        alert("Connection test failed.");
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-plug"></i> Test Connection';
}

/* ── Storage Info ──────────────────────────────────────────── */
async function loadStorageInfo() {
    try {
        const res = await fetch("/api/admin/storage-info", { headers: { "Authorization": "Bearer " + token } });
        if (!res.ok) return;
        const data = await res.json();
        document.getElementById("storagePending").textContent = data.pending_count;
        document.getElementById("storageSize").textContent = data.storage_mb > 1 ? data.storage_mb + " MB" : Math.round(data.storage_bytes / 1024) + " KB";
        document.getElementById("storageRetention").textContent = data.retention_days + " days";
    } catch (err) {
        console.error("Storage info error:", err);
    }
}

/* ── Settings ──────────────────────────────────────────────── */
async function saveStatsOverride() {
    const contributors = document.getElementById("setContributors").value.trim();
    const datasets = document.getElementById("setDatasets").value.trim();
    const body = {};
    if (contributors) body.contributors_display = contributors;
    if (datasets) body.datasets_display = datasets;

    try {
        const res = await fetch("/api/admin/stats-override", {
            method: "PUT",
            headers: headers(),
            body: JSON.stringify(body)
        });
        if (res.ok) {
            alert("Stats updated successfully!");
        }
    } catch (err) {
        alert("Failed to update stats.");
    }
}

/* ── Theme ─────────────────────────────────────────────────── */
function initAdminTheme() {
    const toggle = document.getElementById("adminThemeToggle");
    const icon = document.getElementById("adminThemeIcon");
    const saved = localStorage.getItem("mozhii_theme") || "dark";

    document.documentElement.setAttribute("data-theme", saved);
    updateIcon(saved, icon);

    if (toggle) {
        toggle.addEventListener("click", () => {
            const current = document.documentElement.getAttribute("data-theme");
            const next = current === "light" ? "dark" : "light";
            document.documentElement.setAttribute("data-theme", next);
            localStorage.setItem("mozhii_theme", next);
            updateIcon(next, icon);
        });
    }
}

function updateIcon(theme, icon) {
    if (!icon) return;
    if (theme === "dark") {
        icon.classList.remove("fa-moon");
        icon.classList.add("fa-sun");
    } else {
        icon.classList.remove("fa-sun");
        icon.classList.add("fa-moon");
    }
}

function logout() {
    token = "";
    adminUser = "";
    localStorage.removeItem("mozhii_admin_token");
    localStorage.removeItem("mozhii_admin_user");
    location.reload();
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
}
