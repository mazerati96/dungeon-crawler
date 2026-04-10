<?php
// ============================================================
//  login.php  —  Login & Register (updated for admin passkey)
// ============================================================
session_start();
if (!empty($_SESSION['user_id'])) {
    header('Location: ' . (!empty($_SESSION['is_admin']) ? 'admin.php' : 'dashboard.php'));
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dungeon Crawler — Enter the Interface</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="css/auth.css" />
</head>
<body>
    <canvas id="particles-canvas"></canvas>

    <div class="auth-container">
        <div class="auth-logo">
            <div class="logo-glyph">⬡</div>
            <div class="logo-title">DUNGEON CRAWLER</div>
            <div class="logo-sub">INTERFACE v1.0</div>
        </div>

        <div class="auth-tabs">
            <button class="auth-tab active" id="tab-login"    onclick="switchTab('login')">LOGIN</button>
            <button class="auth-tab"         id="tab-register" onclick="switchTab('register')">REGISTER</button>
        </div>

        <!-- ── Login form ────────────────────────────────── -->
        <div class="auth-form" id="form-login">
            <div class="field-group">
                <label class="field-label">USERNAME / EMAIL</label>
                <input class="hud-input" type="text"     id="login-identifier" autocomplete="username"         placeholder="crawler_name or email" />
            </div>
            <div class="field-group">
                <label class="field-label">PASSWORD</label>
                <input class="hud-input" type="password" id="login-password"   autocomplete="current-password" placeholder="••••••••" />
            </div>
            <div class="form-message" id="login-msg"></div>
            <button class="hud-btn" id="login-btn" onclick="doLogin()">ENTER THE DUNGEON</button>
        </div>

        <!-- ── Register form ─────────────────────────────── -->
        <div class="auth-form hidden" id="form-register">
            <div class="field-group">
                <label class="field-label">USERNAME</label>
                <input class="hud-input" type="text"     id="reg-username" autocomplete="username"    placeholder="your_crawler_name" />
            </div>
            <div class="field-group">
                <label class="field-label">EMAIL</label>
                <input class="hud-input" type="email"    id="reg-email"    autocomplete="email"       placeholder="email@domain.com" />
            </div>
            <div class="field-group">
                <label class="field-label">PASSWORD</label>
                <input class="hud-input" type="password" id="reg-password" autocomplete="new-password" placeholder="min 8 characters" />
            </div>

            <!-- Secret key — hidden until toggled -->
            <div class="field-group admin-key-group">
                <div class="admin-key-toggle" onclick="toggleAdminKey()">
                    <span class="admin-key-icon">⬡</span>
                    <span class="admin-key-label" id="adminKeyLabel">System AI Access Key (optional)</span>
                    <span class="admin-key-chevron" id="adminKeyChevron">▸</span>
                </div>
                <div class="admin-key-reveal hidden" id="adminKeyReveal">
                    <input class="hud-input admin-key-input" type="password" id="reg-admin-key"
                           autocomplete="off" placeholder="Enter key to create System AI account…" />
                    <div class="admin-key-hint">Leave blank to register as a normal crawler.</div>
                </div>
            </div>

            <div class="form-message" id="reg-msg"></div>
            <button class="hud-btn" id="reg-btn" onclick="doRegister()">CREATE CRAWLER</button>
        </div>
    </div>

    <script src="js/particles.js"></script>
    <script>
        function switchTab(tab) {
            document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
            document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
            document.getElementById('tab-login').classList.toggle('active', tab === 'login');
            document.getElementById('tab-register').classList.toggle('active', tab === 'register');
        }

        function toggleAdminKey() {
            const reveal   = document.getElementById('adminKeyReveal');
            const chevron  = document.getElementById('adminKeyChevron');
            const isHidden = reveal.classList.contains('hidden');
            reveal.classList.toggle('hidden', !isHidden);
            chevron.textContent = isHidden ? '▾' : '▸';
        }

        async function postAuth(action, payload, msgId, btnId, defaultLabel) {
            const msg = document.getElementById(msgId);
            const btn = document.getElementById(btnId);
            msg.textContent = '';
            msg.className   = 'form-message';
            btn.disabled    = true;
            btn.textContent = 'PROCESSING…';

            const body = new URLSearchParams({ action, ...payload });
            try {
                const res  = await fetch('api/auth.php', { method: 'POST', body });
                const data = await res.json();

                if (data.success) {
                    msg.className   = 'form-message success';
                    msg.textContent = data.is_admin
                        ? '⬡ SYSTEM AI ACCESS GRANTED — redirecting…'
                        : data.message;
                    setTimeout(() => {
                        window.location.href = data.is_admin ? 'admin.php' : 'dashboard.php';
                    }, 700);
                } else {
                    msg.className   = 'form-message error';
                    msg.textContent = data.message;
                    btn.disabled    = false;
                    btn.textContent = defaultLabel;
                }
            } catch {
                msg.className   = 'form-message error';
                msg.textContent = 'Network error. Try again.';
                btn.disabled    = false;
                btn.textContent = defaultLabel;
            }
        }

        function doLogin() {
            postAuth('login', {
                identifier: document.getElementById('login-identifier').value,
                password:   document.getElementById('login-password').value,
            }, 'login-msg', 'login-btn', 'ENTER THE DUNGEON');
        }

        function doRegister() {
            postAuth('register', {
                username:  document.getElementById('reg-username').value,
                email:     document.getElementById('reg-email').value,
                password:  document.getElementById('reg-password').value,
                admin_key: document.getElementById('reg-admin-key').value,
            }, 'reg-msg', 'reg-btn', 'CREATE CRAWLER');
        }

        document.addEventListener('keydown', e => {
            if (e.key !== 'Enter') return;
            const loginVisible = !document.getElementById('form-login').classList.contains('hidden');
            if (loginVisible) doLogin(); else doRegister();
        });
    </script>
</body>
</html>