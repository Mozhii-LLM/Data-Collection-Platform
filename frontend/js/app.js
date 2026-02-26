/* ══════════════════════════════════════════════════════════════
   MOZHII.AI — Main Application JavaScript
   ══════════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {
    initParticles();
    initTechEffects();
    initNavbar();
    initTheme();
    initLangToggle();
    initHeroRotation();
    initGlobe();
    initForm();
    initInstructionsPopup();
    initContactBubble();
    initScrollReveal();
    initSmoothAnimations();
    loadPublicStats();
});

/* ── Particles ─────────────────────────────────────────────── */
function initParticles() {
    const container = document.getElementById("heroParticles");
    if (!container) return;
    for (let i = 0; i < 30; i++) {
        const p = document.createElement("div");
        p.className = "particle";
        const size = Math.random() * 6 + 2;
        p.style.width = size + "px";
        p.style.height = size + "px";
        p.style.left = Math.random() * 100 + "%";
        p.style.top = Math.random() * 100 + "%";
        p.style.animationDuration = (Math.random() * 15 + 10) + "s";
        p.style.animationDelay = (Math.random() * 10) + "s";
        container.appendChild(p);
    }
}

/* ── Tech Effects (code rain, data lines, circuit nodes) ──── */
function initTechEffects() {
    const container = document.getElementById("heroParticles");
    if (!container) return;

    // Code rain particles
    const codeChars = ['0', '1', '{', '}', '<', '>', '/', 'λ', 'Σ', '∂', '→', '⟨', '⟩', 'AI', 'NLP', '01'];
    for (let i = 0; i < 15; i++) {
        const el = document.createElement("span");
        el.className = "code-particle";
        el.textContent = codeChars[Math.floor(Math.random() * codeChars.length)];
        el.style.left = Math.random() * 100 + "%";
        el.style.animationDuration = (Math.random() * 20 + 15) + "s";
        el.style.animationDelay = (Math.random() * 12) + "s";
        el.style.fontSize = (Math.random() * 8 + 10) + "px";
        container.appendChild(el);
    }

    // Data stream lines
    for (let i = 0; i < 6; i++) {
        const line = document.createElement("div");
        line.className = "tech-line";
        line.style.left = (10 + Math.random() * 80) + "%";
        line.style.height = (Math.random() * 200 + 100) + "px";
        line.style.animationDuration = (Math.random() * 10 + 8) + "s";
        line.style.animationDelay = (Math.random() * 8) + "s";
        container.appendChild(line);
    }

    // Circuit nodes along orbits
    for (let i = 0; i < 8; i++) {
        const node = document.createElement("div");
        node.className = "circuit-node";
        node.style.left = (15 + Math.random() * 70) + "%";
        node.style.top = (15 + Math.random() * 70) + "%";
        node.style.animationDelay = (Math.random() * 4) + "s";
        container.appendChild(node);
    }

    // Scan line
    const hero = document.querySelector(".hero");
    if (hero) {
        const scan = document.createElement("div");
        scan.className = "scan-line";
        hero.appendChild(scan);
    }
}

/* ── Navbar ────────────────────────────────────────────────── */
function initNavbar() {
    const navbar = document.getElementById("navbar");
    const mobileToggle = document.getElementById("mobileToggle");
    const navLinks = document.getElementById("navLinks");

    window.addEventListener("scroll", () => {
        if (window.scrollY > 50) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }
    });

    if (mobileToggle) {
        mobileToggle.addEventListener("click", () => {
            navLinks.classList.toggle("open");
            const icon = mobileToggle.querySelector("i");
            icon.classList.toggle("fa-bars");
            icon.classList.toggle("fa-times");
        });
    }

    // Close mobile nav on link click
    document.querySelectorAll(".nav-links a").forEach(link => {
        link.addEventListener("click", () => {
            navLinks.classList.remove("open");
            const icon = mobileToggle.querySelector("i");
            icon.classList.add("fa-bars");
            icon.classList.remove("fa-times");
        });
    });
}

/* ── Theme ─────────────────────────────────────────────────── */
function initTheme() {
    const floatingToggle = document.getElementById("floatingThemeToggle");
    const floatingIcon = document.getElementById("floatingThemeIcon");
    const saved = localStorage.getItem("mozhii_theme") || "dark";
    
    document.documentElement.setAttribute("data-theme", saved);
    if (floatingIcon) updateThemeIcon(saved, floatingIcon);

    function switchTheme() {
        const current = document.documentElement.getAttribute("data-theme");
        const next = current === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("mozhii_theme", next);
        if (floatingIcon) updateThemeIcon(next, floatingIcon);
    }

    if (floatingToggle) floatingToggle.addEventListener("click", switchTheme);
}

function updateThemeIcon(theme, icon) {
    if (theme === "dark") {
        icon.classList.remove("fa-moon");
        icon.classList.add("fa-sun");
    } else {
        icon.classList.remove("fa-sun");
        icon.classList.add("fa-moon");
    }
}

/* ── Language Toggle ───────────────────────────────────────── */
function initLangToggle() {
    document.querySelectorAll(".lang-float-btn, .lang-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            setLanguage(btn.dataset.lang);
        });
    });
}

/* ── Hero Rotating Headlines ───────────────────────────────── */
function initHeroRotation() {
    const lines = document.querySelectorAll(".hero-rotating-line");
    if (lines.length === 0) return;
    let current = 0;

    setInterval(() => {
        const prev = current;
        current = (current + 1) % lines.length;
        
        lines[prev].classList.remove("active");
        lines[prev].classList.add("exit-up");
        
        setTimeout(() => {
            lines[prev].classList.remove("exit-up");
        }, 600);
        
        lines[current].classList.add("active");
    }, 3000);
}

/* ── Animated Globe ────────────────────────────────────────── */
function initGlobe() {
    const canvas = document.getElementById("globeCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * 0.42;
    let rotation = 0;

    function drawGlobe() {
        ctx.clearRect(0, 0, W, H);

        // Outer glow
        const glowGrad = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.3);
        glowGrad.addColorStop(0, "rgba(108, 99, 255, 0.12)");
        glowGrad.addColorStop(1, "rgba(108, 99, 255, 0)");
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.3, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();

        // Main sphere gradient
        const sphereGrad = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 0, cx, cy, R);
        sphereGrad.addColorStop(0, "rgba(140, 130, 255, 0.9)");
        sphereGrad.addColorStop(0.5, "rgba(80, 60, 255, 0.6)");
        sphereGrad.addColorStop(0.8, "rgba(30, 10, 180, 0.5)");
        sphereGrad.addColorStop(1, "rgba(11, 3, 119, 0.3)");

        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = sphereGrad;
        ctx.fill();

        // Grid lines — meridians
        ctx.strokeStyle = "rgba(180, 170, 255, 0.12)";
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI + rotation;
            ctx.beginPath();
            ctx.ellipse(cx, cy, Math.abs(Math.cos(angle)) * R, R, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Parallels
        for (let i = 1; i < 6; i++) {
            const y = cy + R * (i / 6) * (i % 2 === 0 ? 1 : -1);
            const rr = Math.sqrt(R * R - (y - cy) * (y - cy));
            if (rr > 0) {
                ctx.beginPath();
                ctx.ellipse(cx, y, rr, rr * 0.15, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // Highlight
        const hlGrad = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, 0, cx - R * 0.35, cy - R * 0.35, R * 0.5);
        hlGrad.addColorStop(0, "rgba(255, 255, 255, 0.18)");
        hlGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = hlGrad;
        ctx.fill();

        // Edge atmosphere
        ctx.strokeStyle = "rgba(108, 99, 255, 0.2)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, R + 1, 0, Math.PI * 2);
        ctx.stroke();

        rotation += 0.003;
        requestAnimationFrame(drawGlobe);
    }

    drawGlobe();
}

/* ── Smooth Animations (parallax, tilt, scroll UX) ─────────── */
function initSmoothAnimations() {
    // Parallax on scroll for hero elements
    window.addEventListener("scroll", () => {
        const scrolled = window.scrollY;
        const hero = document.querySelector(".hero-content");
        if (hero && scrolled < window.innerHeight) {
            hero.style.transform = `translateY(${scrolled * 0.15}px)`;
            hero.style.opacity = 1 - (scrolled / window.innerHeight) * 0.5;
        }

        // Scroll-based subtle section tinting
        const sections = document.querySelectorAll('.section');
        sections.forEach(section => {
            const rect = section.getBoundingClientRect();
            const viewH = window.innerHeight;
            if (rect.top < viewH && rect.bottom > 0) {
                const progress = 1 - Math.abs(rect.top + rect.height / 2 - viewH / 2) / (viewH);
                const clampedProgress = Math.max(0, Math.min(1, progress));
                if (section.querySelector('.section-header')) {
                    section.style.setProperty('--scroll-progress', clampedProgress);
                }
            }
        });
    });

    // Magnetic tilt on cards
    document.querySelectorAll(".about-feature-card, .step-card, .why-card").forEach(card => {
        card.addEventListener("mousemove", (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const xPercent = (x / rect.width - 0.5) * 2;
            const yPercent = (y / rect.height - 0.5) * 2;
            card.style.transform = `translateY(-4px) perspective(800px) rotateX(${-yPercent * 3}deg) rotateY(${xPercent * 3}deg)`;
        });
        card.addEventListener("mouseleave", () => {
            card.style.transform = "";
        });
    });

    // Smooth counter animation for stats on scroll
    const stats = document.querySelectorAll(".stat-number");
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const text = el.textContent;
                const num = parseInt(text);
                if (!isNaN(num) && !el.dataset.animated) {
                    el.dataset.animated = "true";
                    animateCount(el, 0, num, text.includes("+") ? "+" : "");
                }
            }
        });
    }, { threshold: 0.5 });
    stats.forEach(s => statsObserver.observe(s));
}

function animateCount(el, start, end, suffix) {
    const duration = 1500;
    const startTime = performance.now();
    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(start + (end - start) * eased) + suffix;
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

/* ── Form ──────────────────────────────────────────────────── */
function initForm() {
    const form = document.getElementById("contributionForm");
    const textArea = document.getElementById("textContent");
    const charCount = document.getElementById("charCount");
    const fileInput = document.getElementById("fileInput");
    const photoInput = document.getElementById("photoInput");
    const fileList = document.getElementById("fileList");
    const photoGrid = document.getElementById("photoPreviewGrid");
    const dropZone = document.getElementById("fileDropZone");
    const photoDropZone = document.getElementById("photoDropZone");
    let selectedFiles = [];
    let selectedPhotos = [];

    // Upload tab switching
    document.querySelectorAll(".upload-tab-pill").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".upload-tab-pill").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            document.querySelectorAll(".upload-panel").forEach(p => p.classList.remove("active"));
            const panelId = tab.dataset.tab + "Panel";
            const panel = document.getElementById(panelId);
            if (panel) panel.classList.add("active");
        });
    });

    // Progress step tracking
    function updateProgressSteps() {
        const steps = document.querySelectorAll(".progress-step");
        const lines = document.querySelectorAll(".progress-line");
        const language = form ? form.querySelector('input[name="language"]:checked') : null;
        const name = document.getElementById("contribName").value.trim();
        const email = document.getElementById("contribEmail").value.trim();
        const text = textArea ? textArea.value.trim() : "";
        const hasUpload = text.length > 0 || selectedFiles.length > 0 || selectedPhotos.length > 0;
        const consent = document.getElementById("consentCheck").checked;

        // Step 1: Language
        if (language) {
            steps[0].classList.add("completed");
            steps[0].classList.remove("active");
            if (lines[0]) lines[0].classList.add("filled");
        } else {
            steps[0].classList.remove("completed");
            steps[0].classList.add("active");
            if (lines[0]) lines[0].classList.remove("filled");
        }

        // Step 2: Details
        if (name && email) {
            steps[1].classList.add("completed");
            steps[1].classList.remove("active");
            if (lines[1]) lines[1].classList.add("filled");
        } else if (language) {
            steps[1].classList.remove("completed");
            steps[1].classList.add("active");
            if (lines[1]) lines[1].classList.remove("filled");
        } else {
            steps[1].classList.remove("completed", "active");
            if (lines[1]) lines[1].classList.remove("filled");
        }

        // Step 3: Upload
        if (hasUpload) {
            steps[2].classList.add("completed");
            steps[2].classList.remove("active");
            if (lines[2]) lines[2].classList.add("filled");
        } else if (name && email) {
            steps[2].classList.remove("completed");
            steps[2].classList.add("active");
            if (lines[2]) lines[2].classList.remove("filled");
        } else {
            steps[2].classList.remove("completed", "active");
            if (lines[2]) lines[2].classList.remove("filled");
        }

        // Step 4: Submit
        if (consent && hasUpload && name && email && language) {
            steps[3].classList.add("active");
        } else {
            steps[3].classList.remove("active", "completed");
        }
    }

    // Attach listeners for progress tracking
    if (form) {
        form.querySelectorAll('input[name="language"]').forEach(r => r.addEventListener("change", updateProgressSteps));
        document.getElementById("contribName").addEventListener("input", updateProgressSteps);
        document.getElementById("contribEmail").addEventListener("input", updateProgressSteps);
        document.getElementById("consentCheck").addEventListener("change", updateProgressSteps);
    }
    if (textArea) textArea.addEventListener("input", updateProgressSteps);

    // Character count
    if (textArea) {
        textArea.addEventListener("input", () => {
            charCount.textContent = textArea.value.length;
        });
    }

    // File handling (documents)
    if (fileInput) {
        fileInput.addEventListener("change", (e) => {
            addFiles(e.target.files, 'doc');
        });
    }

    // Photo handling
    if (photoInput) {
        photoInput.addEventListener("change", (e) => {
            addFiles(e.target.files, 'photo');
        });
    }

    // Drag and drop for documents
    if (dropZone) {
        ["dragenter", "dragover"].forEach(evt => {
            dropZone.addEventListener(evt, e => {
                e.preventDefault();
                dropZone.classList.add("dragover");
            });
        });
        ["dragleave", "drop"].forEach(evt => {
            dropZone.addEventListener(evt, e => {
                e.preventDefault();
                dropZone.classList.remove("dragover");
            });
        });
        dropZone.addEventListener("drop", e => {
            addFiles(e.dataTransfer.files, 'doc');
        });
    }

    // Drag and drop for photos
    if (photoDropZone) {
        ["dragenter", "dragover"].forEach(evt => {
            photoDropZone.addEventListener(evt, e => {
                e.preventDefault();
                photoDropZone.classList.add("dragover");
            });
        });
        ["dragleave", "drop"].forEach(evt => {
            photoDropZone.addEventListener(evt, e => {
                e.preventDefault();
                photoDropZone.classList.remove("dragover");
            });
        });
        photoDropZone.addEventListener("drop", e => {
            addFiles(e.dataTransfer.files, 'photo');
        });
    }

    function addFiles(files, type) {
        const maxFiles = 5;
        const maxSize = 20 * 1024 * 1024;
        const docExts = [".txt", ".pdf", ".docx", ".csv"];
        const imageExts = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"];

        for (const file of files) {
            const ext = "." + file.name.split(".").pop().toLowerCase();
            if (type === 'doc') {
                if (selectedFiles.length >= maxFiles) { alert("Maximum 5 files allowed"); break; }
                if (!docExts.includes(ext)) { alert(`File type ${ext} not allowed for documents`); continue; }
                if (file.size > maxSize) { alert(`${file.name} exceeds 20MB`); continue; }
                selectedFiles.push(file);
            } else {
                if (selectedPhotos.length >= maxFiles) { alert("Maximum 5 photos allowed"); break; }
                if (!imageExts.includes(ext)) { alert(`File type ${ext} not allowed for photos`); continue; }
                if (file.size > maxSize) { alert(`${file.name} exceeds 20MB`); continue; }
                selectedPhotos.push(file);
            }
        }
        if (type === 'doc') renderFileList();
        else renderPhotoPreview();
        updateProgressSteps();
    }

    function renderFileList() {
        fileList.innerHTML = "";
        selectedFiles.forEach((file, idx) => {
            const item = document.createElement("div");
            item.className = "file-item";
            item.innerHTML = `
                <div class="file-item-info">
                    <i class="fas fa-file"></i>
                    <span>${file.name}</span>
                    <span style="color:var(--text-muted);font-size:12px">(${(file.size / 1024).toFixed(1)} KB)</span>
                </div>
                <button type="button" class="file-remove" data-idx="${idx}"><i class="fas fa-times"></i></button>
            `;
            fileList.appendChild(item);
        });
        fileList.querySelectorAll(".file-remove").forEach(btn => {
            btn.addEventListener("click", () => {
                selectedFiles.splice(parseInt(btn.dataset.idx), 1);
                renderFileList();
                updateProgressSteps();
            });
        });
    }

    function renderPhotoPreview() {
        photoGrid.innerHTML = "";
        selectedPhotos.forEach((file, idx) => {
            const item = document.createElement("div");
            item.className = "photo-preview-item";
            const img = document.createElement("img");
            img.src = URL.createObjectURL(file);
            img.alt = file.name;
            const removeBtn = document.createElement("button");
            removeBtn.className = "photo-preview-remove";
            removeBtn.innerHTML = '<i class="fas fa-times"></i>';
            removeBtn.type = "button";
            removeBtn.addEventListener("click", () => {
                selectedPhotos.splice(idx, 1);
                renderPhotoPreview();
                updateProgressSteps();
            });
            item.appendChild(img);
            item.appendChild(removeBtn);
            photoGrid.appendChild(item);
        });
    }

    // Form submit
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById("submitBtn");
            const btnText = submitBtn.querySelector(".btn-text");
            const btnLoader = submitBtn.querySelector(".btn-loader");
            const btnArrow = submitBtn.querySelector(".fa-paper-plane");

            // Validate
            const language = form.querySelector('input[name="language"]:checked');
            if (!language) { alert("Please select a language"); return; }

            const name = document.getElementById("contribName").value.trim();
            const email = document.getElementById("contribEmail").value.trim();
            if (!name || !email) { alert("Name and email are required"); return; }

            const text = textArea ? textArea.value.trim() : "";
            if (!text && selectedFiles.length === 0 && selectedPhotos.length === 0) {
                alert("Please provide text, upload documents, or add photos");
                return;
            }

            const consent = document.getElementById("consentCheck");
            if (!consent.checked) { alert("Please accept the consent checkbox"); return; }

            // Build FormData
            const formData = new FormData();
            formData.append("language", language.value);
            formData.append("contributor_name", name);
            formData.append("contributor_email", email);
            formData.append("text_content", text || "");
            formData.append("consent", "true");
            selectedFiles.forEach(f => formData.append("files", f));
            selectedPhotos.forEach(f => formData.append("files", f));

            // Loading state
            btnText.classList.add("hidden");
            btnLoader.classList.remove("hidden");
            if (btnArrow) btnArrow.style.display = "none";
            submitBtn.disabled = true;

            try {
                const res = await fetch("/api/submit", { method: "POST", body: formData });
                const data = await res.json();
                if (res.ok) {
                    document.getElementById("submissionId").textContent = data.submission_id;
                    document.getElementById("successPopup").classList.add("active");
                    // Reset form
                    form.reset();
                    selectedFiles = [];
                    selectedPhotos = [];
                    renderFileList();
                    renderPhotoPreview();
                    charCount.textContent = "0";
                    // Reset tabs
                    document.querySelectorAll(".upload-tab-pill").forEach(t => t.classList.remove("active"));
                    document.querySelector('.upload-tab-pill[data-tab="text"]').classList.add("active");
                    document.querySelectorAll(".upload-panel").forEach(p => p.classList.remove("active"));
                    document.getElementById("textPanel").classList.add("active");
                    updateProgressSteps();
                    // Auto close after 3s
                    setTimeout(() => {
                        document.getElementById("successPopup").classList.remove("active");
                    }, 3000);
                } else {
                    alert(data.detail || "Submission failed. Please try again.");
                }
            } catch (err) {
                alert("Network error. Please try again.");
            } finally {
                btnText.classList.remove("hidden");
                btnLoader.classList.add("hidden");
                if (btnArrow) btnArrow.style.display = "";
                submitBtn.disabled = false;
            }
        });
    }
}

/* ── Instructions Popup ────────────────────────────────────── */
function initInstructionsPopup() {
    const btn = document.getElementById("instructionsBtn");
    const popup = document.getElementById("instructionsPopup");
    const closeBtn = document.getElementById("instructionsCloseBtn");

    if (btn && popup) {
        btn.addEventListener("click", () => popup.classList.add("active"));
        if (closeBtn) closeBtn.addEventListener("click", () => popup.classList.remove("active"));
        popup.addEventListener("click", (e) => {
            if (e.target === popup) popup.classList.remove("active");
        });
    }
}

/* ── Contact Bubble ────────────────────────────────────────── */
function initContactBubble() {
    const bubbleBtn = document.getElementById("bubbleBtn");
    const bubblePopup = document.getElementById("bubblePopup");
    const bubbleClose = document.getElementById("bubbleClose");
    const feedbackForm = document.getElementById("feedbackForm");
    const bubbleSuccess = document.getElementById("bubbleSuccess");

    if (bubbleBtn) {
        bubbleBtn.addEventListener("click", () => {
            bubblePopup.classList.toggle("active");
        });
    }

    if (bubbleClose) {
        bubbleClose.addEventListener("click", () => {
            bubblePopup.classList.remove("active");
        });
    }

    if (feedbackForm) {
        feedbackForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document.getElementById("fbName").value;
            const email = document.getElementById("fbEmail").value;
            const msg = document.getElementById("fbMessage").value.trim();
            if (!msg) return;

            const submitBtn = feedbackForm.querySelector("button[type='submit']");
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

            try {
                // Save to backend DB
                await fetch("/api/feedback", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, email, message: msg })
                });

                // Send email via EmailJS
                if (typeof emailjs !== "undefined" && window.EMAILJS_PUBLIC_KEY) {
                    try {
                        emailjs.init(window.EMAILJS_PUBLIC_KEY);
                        await emailjs.send(
                            window.EMAILJS_SERVICE_ID || "default_service",
                            window.EMAILJS_TEMPLATE_ID || "template_mozhii",
                            {
                                from_name: name || "Anonymous",
                                from_email: email || "no-reply@mozhii.ai",
                                message: msg,
                                to_name: "Mozhii Team"
                            }
                        );
                    } catch (emailErr) {
                        console.warn("[EmailJS] Send failed:", emailErr);
                    }
                }

                feedbackForm.classList.add("hidden");
                bubbleSuccess.classList.remove("hidden");
                setTimeout(() => {
                    bubblePopup.classList.remove("active");
                    feedbackForm.reset();
                    feedbackForm.classList.remove("hidden");
                    bubbleSuccess.classList.add("hidden");
                }, 2500);
            } catch (err) {
                alert("Failed to send feedback. Please try again.");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> <span data-i18n="contact_send">Send to Mozhii</span>';
            }
        });
    }
}

/* ── Scroll Reveal ─────────────────────────────────────────── */
function initScrollReveal() {
    const reveals = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });

    reveals.forEach(el => observer.observe(el));

    // Stagger children inside bento grids, steps, and feature grids
    const staggerContainers = document.querySelectorAll(".why-bento, .steps-grid, .about-features-grid");
    staggerContainers.forEach(container => {
        const children = container.children;
        Array.from(children).forEach((child, i) => {
            child.style.transitionDelay = `${i * 0.1}s`;
        });
    });
}

/* ── Load Public Stats ─────────────────────────────────────── */
async function loadPublicStats() {
    try {
        const res = await fetch("/api/public-stats");
        const data = await res.json();
        const c = document.getElementById("statContributors");
        const d = document.getElementById("statDatasets");
        if (c) c.textContent = data.contributors_display || "40+";
        if (d) d.textContent = data.datasets_display || "8+";
    } catch (e) {
        // Use defaults
    }
}

/* ── Close Popup ───────────────────────────────────────────── */
function closePopup() {
    document.getElementById("successPopup").classList.remove("active");
}
