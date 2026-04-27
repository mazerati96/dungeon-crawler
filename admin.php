<?php
// ============================================================
//  admin.php  —  System AI Dashboard
//  Requires: is_admin session flag
// ============================================================
session_start();
if (empty($_SESSION['user_id']) || empty($_SESSION['is_admin'])) {
    header('Location: login.php');
    exit;
}
$adminName = htmlspecialchars($_SESSION['username']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>System AI — Dungeon Crawler</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="css/admin.css" />
    <!-- auth.css only for the admin-key extras used here -->
    <link rel="stylesheet" href="css/auth.css" />
</head>
<body>
    <canvas id="particles-canvas"></canvas>

    <!-- ── Top Bar ────────────────────────────────────────── -->
    <header class="admin-topbar">
        <div class="topbar-ai-logo">
            <span class="ai-logo-glyph">⬡</span>
            <span class="ai-logo-text">SYSTEM AI</span>
            <span class="ai-logo-badge">ADMIN</span>
        </div>
        <div class="topbar-spacer"></div>
        <span class="topbar-admin-name">Logged in as <strong><?= $adminName ?></strong></span>
        <a class="hud-btn-sm" href="admin_dashboard.php" style="border-color:#00c8ff;color:#00c8ff;">⬡ CRAWLER VIEWER</a>
        <a class="hud-btn-sm" href="logout.php">LOGOUT</a>
    </header>

    <!-- ── Tab Nav ────────────────────────────────────────── -->
    <nav class="admin-tabnav">
        <button class="tab-btn active" data-tab="stats">
            <span class="tab-icon">◈</span> SYSTEM STATS
        </button>
        <button class="tab-btn" data-tab="crawlers">
            <span class="tab-icon">⊞</span> ALL CRAWLERS
        </button>
        <button class="tab-btn" data-tab="rawdata">
            <span class="tab-icon">{ }</span> RAW DATA
        </button>
        <button class="tab-btn" data-tab="audit">
            <span class="tab-icon">◎</span> AUDIT LOG
        </button>
    </nav>

    <main class="admin-main">

        <!-- ══════════════════════════════════════════════════
             TAB: SYSTEM STATS
        ══════════════════════════════════════════════════════ -->
        <section class="tab-panel active" id="tab-stats">

            <!-- Stat tiles -->
            <div class="stats-grid" id="statTiles">
                <div class="stat-tile"><div class="stat-tile-label">TOTAL CRAWLERS</div><div class="stat-tile-value" id="st-users">—</div></div>
                <div class="stat-tile success"><div class="stat-tile-label">ACTIVE (NOT BANNED)</div><div class="stat-tile-value" id="st-active">—</div></div>
                <div class="stat-tile danger"><div class="stat-tile-label">BANNED ACCOUNTS</div><div class="stat-tile-value" id="st-banned">—</div></div>
                <div class="stat-tile"><div class="stat-tile-label">SYSTEM AI ADMINS</div><div class="stat-tile-value" id="st-admins">—</div></div>
                <div class="stat-tile"><div class="stat-tile-label">TOTAL CHARACTERS</div><div class="stat-tile-value" id="st-chars">—</div></div>
                <div class="stat-tile"><div class="stat-tile-label">AUDIT LOG ENTRIES</div><div class="stat-tile-value" id="st-audit">—</div></div>
            </div>

            <div class="three-col">
                <!-- Recent sign-ups -->
                <div class="ai-card">
                    <div class="card-header">◈ RECENT SIGN-UPS</div>
                    <div class="mini-list" id="recentSignups"></div>
                </div>

                <!-- Recent logins -->
                <div class="ai-card">
                    <div class="card-header">◈ RECENT LOGINS</div>
                    <div class="mini-list" id="recentLogins"></div>
                </div>

                <!-- Top actions -->
                <div class="ai-card">
                    <div class="card-header">◈ TOP ACTIONS</div>
                    <div class="mini-list" id="topActions"></div>
                </div>
            </div>

        </section>

        <!-- ══════════════════════════════════════════════════
             TAB: ALL CRAWLERS
        ══════════════════════════════════════════════════════ -->
        <section class="tab-panel" id="tab-crawlers">
            <div class="ai-card">
                <div class="card-header">
                    ⊞ CRAWLER REGISTRY
                    <span id="crawlerCount" style="color:var(--clr-label);font-size:.55rem"></span>
                </div>

                <div class="search-bar">
                    <input class="hud-input" type="text" id="crawlerSearch"
                           placeholder="Filter by username or email…" oninput="Admin.filterCrawlers()" />
                    <button class="hud-btn-sm" onclick="Admin.loadCrawlers()">↺ REFRESH</button>
                </div>

                <div style="overflow-x:auto">
                    <table class="user-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>USERNAME</th>
                                <th>EMAIL</th>
                                <th>CHARS</th>
                                <th>LAST LOGIN</th>
                                <th>REGISTERED</th>
                                <th>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody id="crawlerTableBody"></tbody>
                    </table>
                </div>
            </div>
        </section>

        <!-- ══════════════════════════════════════════════════
             TAB: RAW DATA / JSON INSPECTOR
        ══════════════════════════════════════════════════════ -->
        <section class="tab-panel" id="tab-rawdata">
            <div class="ai-card">
                <div class="card-header">{ } RAW DATA INSPECTOR</div>

                <div class="inspector-layout">
                    <!-- Sidebar: pick user → character -->
                    <div class="inspector-sidebar">
                        <div class="inspector-sidebar-label">1. SELECT CRAWLER</div>
                        <select class="inspector-user-select" id="inspectorUserSelect"
                                onchange="Admin.inspectorLoadChars()">
                            <option value="">— Select crawler —</option>
                        </select>

                        <div class="inspector-sidebar-label" style="margin-top:.75rem">2. SELECT CHARACTER</div>
                        <select class="inspector-char-select" id="inspectorCharSelect"
                                onchange="Admin.inspectorLoadJson()">
                            <option value="">— Select character —</option>
                        </select>

                        <div style="margin-top:1rem;display:flex;flex-direction:column;gap:.4rem">
                            <button class="hud-btn-sm" onclick="Admin.inspectorFormatJson()" style="justify-content:center">FORMAT JSON</button>
                            <button class="hud-btn-sm" onclick="Admin.inspectorSaveJson()" style="justify-content:center;border-color:var(--clr-success);color:var(--clr-success)">SAVE CHANGES</button>
                        </div>
                        <div class="json-status" id="jsonStatus" style="margin-top:.4rem"></div>
                    </div>

                    <!-- Main JSON panel -->
                    <div class="json-panel">
                        <div class="json-toolbar">
                            <span id="jsonCharLabel">No character selected</span>
                        </div>
                        <textarea class="json-editor" id="jsonEditor"
                                  placeholder='Select a crawler and character to inspect their sheet data…'
                                  spellcheck="false"></textarea>
                    </div>
                </div>
            </div>
        </section>

        <!-- ══════════════════════════════════════════════════
             TAB: AUDIT LOG
        ══════════════════════════════════════════════════════ -->
        <section class="tab-panel" id="tab-audit">
            <div class="ai-card">
                <div class="card-header">◎ AUDIT LOG</div>

                <div class="audit-toolbar">
                    <input class="hud-input" type="text" id="auditFilter"
                           placeholder="Filter by action, username, or detail…"
                           style="max-width:340px"
                           oninput="Admin.loadAudit(true)" />
                    <button class="hud-btn-sm" onclick="Admin.loadAudit(true)">↺ REFRESH</button>
                    <span class="audit-count" id="auditCount"></span>
                </div>

                <div style="overflow-x:auto">
                    <table class="audit-table">
                        <thead>
                            <tr>
                                <th>TIME</th>
                                <th>ACTION</th>
                                <th>USER</th>
                                <th>DETAIL</th>
                                <th>IP</th>
                            </tr>
                        </thead>
                        <tbody id="auditTableBody"></tbody>
                    </table>
                </div>

                <button class="load-more-btn hidden" id="auditLoadMore"
                        onclick="Admin.loadAuditMore()">LOAD MORE ENTRIES</button>
            </div>
        </section>

    </main>

    <!-- ══════════════════════════════════════════════════════
         MODALS
    ══════════════════════════════════════════════════════════ -->

    <!-- Ban user -->
    <div class="modal-backdrop hidden" id="banModal">
        <div class="modal-box">
            <div class="modal-title">BAN CRAWLER</div>
            <div class="modal-body">You are banning <strong id="banTargetName">—</strong>.<br />They will be blocked from logging in.</div>
            <div class="modal-field">
                <label>BAN REASON (optional)</label>
                <input class="hud-input" type="text" id="banReason" placeholder="e.g. Violation of terms…" />
            </div>
            <div class="form-message" id="banMsg"></div>
            <div class="modal-actions">
                <button class="hud-btn-sm" onclick="Admin.closeModal('banModal')">CANCEL</button>
                <button class="hud-btn-sm ban" onclick="Admin.confirmBan()" style="flex:1;justify-content:center">CONFIRM BAN</button>
            </div>
        </div>
    </div>

    <!-- Delete user -->
    <div class="modal-backdrop hidden" id="deleteUserModal">
        <div class="modal-box danger">
            <div class="modal-title danger">DELETE CRAWLER</div>
            <div class="modal-body">Permanently delete <strong id="deleteUserTargetName">—</strong> and all their characters?<br /><span style="color:var(--clr-warn)">This cannot be undone.</span></div>
            <div class="modal-field">
                <label>TYPE USERNAME TO CONFIRM</label>
                <input class="hud-input" type="text" id="deleteUserConfirm" placeholder="username…" />
            </div>
            <div class="form-message" id="deleteUserMsg"></div>
            <div class="modal-actions">
                <button class="hud-btn-sm" onclick="Admin.closeModal('deleteUserModal')">CANCEL</button>
                <button class="hud-btn-sm del" id="deleteUserConfirmBtn" onclick="Admin.confirmDeleteUser()" style="flex:1;justify-content:center" disabled>DELETE FOREVER</button>
            </div>
        </div>
    </div>

    <!-- Delete character -->
    <div class="modal-backdrop hidden" id="deleteCharModal">
        <div class="modal-box danger">
            <div class="modal-title danger">DELETE CHARACTER</div>
            <div class="modal-body">Permanently delete character <strong id="deleteCharTargetName">—</strong>?<br /><span style="color:var(--clr-warn)">This cannot be undone.</span></div>
            <div class="form-message" id="deleteCharMsg"></div>
            <div class="modal-actions">
                <button class="hud-btn-sm" onclick="Admin.closeModal('deleteCharModal')">CANCEL</button>
                <button class="hud-btn-sm del" onclick="Admin.confirmDeleteChar()" style="flex:1;justify-content:center">DELETE FOREVER</button>
            </div>
        </div>
    </div>

    <script src="js/particles.js"></script>
    <script src="js/admin.js"></script>
</body>
</html>