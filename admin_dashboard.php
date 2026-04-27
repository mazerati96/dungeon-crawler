<?php
// ============================================================
//  admin_dashboard.php  —  System AI Dashboard (main view)
// ============================================================
session_start();
if (empty($_SESSION['user_id']) || empty($_SESSION['is_admin'])) {
    header('Location: login.php');
    exit;
}
$adminName = htmlspecialchars($_SESSION['username'] ?? 'admin');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>System AI — Admin Dashboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="css/admin.css" />
</head>
<body>
    <canvas id="particles-canvas"></canvas>

    <!-- ── Top Bar ──────────────────────────────────────────── -->
    <header class="admin-topbar">
        <div class="topbar-ai-logo">
            <span class="ai-logo-glyph">⬡</span>
            <span class="ai-logo-text">SYSTEM AI</span>
            <span class="ai-logo-badge">ADMIN</span>
        </div>
        <div class="topbar-spacer"></div>
        <span class="topbar-admin-name">Logged in as <strong><?= $adminName ?></strong></span>
        <a class="hud-btn-sm" href="logout.php">LOGOUT</a>
    </header>

    <!-- ── Tab Nav ──────────────────────────────────────────── -->
    <nav class="admin-tabnav">
        <button class="tab-btn active" data-tab="stats">
            <span class="tab-icon">◈</span> STATS
        </button>
        <button class="tab-btn" data-tab="crawlers">
            <span class="tab-icon">⊞</span> ALL CRAWLERS
        </button>
        <button class="tab-btn" data-tab="inspector">
            <span class="tab-icon">◉</span> INSPECTOR
        </button>
        <button class="tab-btn" data-tab="audit">
            <span class="tab-icon">★</span> AUDIT LOG
        </button>
    </nav>

    <!-- ══════════════════════════════════════════════════════
         MAIN CONTENT
    ══════════════════════════════════════════════════════════ -->
    <main class="admin-main">

        <!-- ── TAB: STATS ─────────────────────────────────── -->
        <section class="tab-panel active" id="tab-stats">
            <div class="stats-grid">
                <div class="stat-tile">
                    <div class="stat-tile-label">TOTAL CRAWLERS</div>
                    <div class="stat-tile-value" id="st-users">—</div>
                </div>
                <div class="stat-tile success">
                    <div class="stat-tile-label">ACTIVE</div>
                    <div class="stat-tile-value" id="st-active">—</div>
                </div>
                <div class="stat-tile danger">
                    <div class="stat-tile-label">BANNED</div>
                    <div class="stat-tile-value" id="st-banned">—</div>
                </div>
                <div class="stat-tile">
                    <div class="stat-tile-label">ADMINS</div>
                    <div class="stat-tile-value" id="st-admins">—</div>
                </div>
                <div class="stat-tile">
                    <div class="stat-tile-label">TOTAL CHARACTERS</div>
                    <div class="stat-tile-value" id="st-chars">—</div>
                </div>
                <div class="stat-tile">
                    <div class="stat-tile-label">AUDIT ACTIONS</div>
                    <div class="stat-tile-value" id="st-audit">—</div>
                </div>
            </div>

            <div class="three-col">
                <div class="ai-card">
                    <div class="card-header">RECENT SIGN-UPS</div>
                    <div class="mini-list" id="recentSignups">Loading…</div>
                </div>
                <div class="ai-card">
                    <div class="card-header">RECENT LOGINS</div>
                    <div class="mini-list" id="recentLogins">Loading…</div>
                </div>
                <div class="ai-card">
                    <div class="card-header">TOP AUDIT ACTIONS</div>
                    <div class="mini-list" id="topActions">Loading…</div>
                </div>
            </div>
        </section>

        <!-- ── TAB: CRAWLERS ──────────────────────────────── -->
        <section class="tab-panel" id="tab-crawlers">
            <div class="search-bar">
                <input class="hud-input" type="text" id="crawlerSearch"
                       placeholder="Search username or email…"
                       oninput="Admin.filterCrawlers()" />
                <span id="crawlerCount" style="font-size:.7rem;color:var(--clr-label);white-space:nowrap"></span>
            </div>
            <div class="ai-card" style="padding:0;overflow-x:auto">
                <table class="user-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>USERNAME</th>
                            <th>EMAIL</th>
                            <th style="text-align:center">CHARS</th>
                            <th>LAST LOGIN</th>
                            <th>JOINED</th>
                            <th>ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody id="crawlerTableBody"></tbody>
                </table>
            </div>
        </section>

        <!-- ── TAB: INSPECTOR ─────────────────────────────── -->
        <section class="tab-panel" id="tab-inspector">
            <div class="inspector-layout">

                <!-- Sidebar: selectors -->
                <div class="inspector-sidebar">
                    <div class="ai-card">
                        <div class="card-header">◉ SELECT CHARACTER</div>
                        <div class="inspector-sidebar-label">CRAWLER</div>
                        <select class="inspector-user-select" id="inspectorUserSelect"
                                onchange="Admin.inspectorLoadChars()">
                            <option value="">— Select crawler —</option>
                        </select>

                        <div class="inspector-sidebar-label" style="margin-top:.75rem">CHARACTER</div>
                        <select class="inspector-char-select" id="inspectorCharSelect"
                                onchange="Admin.inspectorLoadSheet()">
                            <option value="">— Select character —</option>
                        </select>

                        <div class="inspector-char-label" id="jsonCharLabel">No character selected</div>

                        <!-- View mode toggle -->
                        <div class="view-toggle-row">
                            <button class="view-toggle-btn active" data-mode="sheet">◈ SHEET VIEW</button>
                            <button class="view-toggle-btn" data-mode="json">{ } JSON</button>
                        </div>

                        <!-- JSON-only controls (shown in json mode) -->
                        <div id="jsonControls" class="json-sidebar-controls">
                            <button class="btn-xs json" onclick="Admin.inspectorFormatJson()" style="width:100%;justify-content:center;padding:.35rem">FORMAT JSON</button>
                            <button class="btn-xs save" onclick="Admin.inspectorSaveJson()" style="width:100%;justify-content:center;padding:.35rem;margin-top:.3rem">SAVE CHANGES</button>
                            <div class="json-status" id="jsonStatus"></div>
                        </div>
                    </div>
                </div>

                <!-- Main panel: sheet view + JSON editor -->
                <div class="inspector-main-panel">
                    <!-- SHEET VIEW -->
                    <div id="sheetView">
                        <div class="sheet-empty">Select a crawler and character to view their sheet.</div>
                    </div>

                    <!-- JSON EDITOR (hidden by default) -->
                    <div id="jsonPane" class="hidden">
                        <textarea class="json-editor" id="jsonEditor" spellcheck="false"></textarea>
                    </div>
                </div>

            </div>
        </section>

        <!-- ── TAB: AUDIT LOG ─────────────────────────────── -->
        <section class="tab-panel" id="tab-audit">
            <div class="audit-toolbar">
                <input class="hud-input" type="text" id="auditFilter"
                       placeholder="Filter by action, user, detail…"
                       style="max-width:320px"
                       onkeydown="if(event.key==='Enter') Admin.loadAudit(true)" />
                <button class="hud-btn-sm" onclick="Admin.loadAudit(true)">SEARCH</button>
                <span class="audit-count" id="auditCount"></span>
            </div>
            <div class="ai-card" style="padding:0;overflow-x:auto">
                <table class="audit-table">
                    <thead>
                        <tr>
                            <th>TIMESTAMP</th>
                            <th>ACTION</th>
                            <th>USER</th>
                            <th>DETAIL</th>
                            <th>IP</th>
                        </tr>
                    </thead>
                    <tbody id="auditTableBody"></tbody>
                </table>
            </div>
            <button class="load-more-btn hidden" id="auditLoadMore" onclick="Admin.loadAuditMore()">
                LOAD MORE ENTRIES
            </button>
        </section>

    </main>

    <!-- ══════════════════════════════════════════════════════
         MODALS
    ══════════════════════════════════════════════════════════ -->

    <!-- BAN MODAL -->
    <div class="modal-backdrop hidden" id="banModal">
        <div class="modal-box danger">
            <div class="modal-title danger">BAN CRAWLER</div>
            <div class="modal-body">
                Banning <strong id="banTargetName"></strong> will prevent them from logging in.
            </div>
            <div class="modal-field">
                <label>BAN REASON (optional)</label>
                <input class="hud-input" type="text" id="banReason" placeholder="Reason…" />
            </div>
            <div class="form-message" id="banMsg"></div>
            <div class="modal-actions">
                <button class="hud-btn-sm" onclick="Admin.closeModal('banModal')">CANCEL</button>
                <button class="hud-btn-sm danger" onclick="Admin.confirmBan()" style="flex:1">CONFIRM BAN</button>
            </div>
        </div>
    </div>

    <!-- DELETE USER MODAL -->
    <div class="modal-backdrop hidden" id="deleteUserModal">
        <div class="modal-box danger">
            <div class="modal-title danger">DELETE CRAWLER ACCOUNT</div>
            <div class="modal-body">
                This permanently deletes <strong id="deleteUserTargetName"></strong> and all their data. Type their username to confirm.
            </div>
            <div class="modal-field">
                <label>TYPE USERNAME TO CONFIRM</label>
                <input class="hud-input" type="text" id="deleteUserConfirm" placeholder="Username…" />
            </div>
            <div class="form-message" id="deleteUserMsg"></div>
            <div class="modal-actions">
                <button class="hud-btn-sm" onclick="Admin.closeModal('deleteUserModal')">CANCEL</button>
                <button class="hud-btn-sm danger" id="deleteUserConfirmBtn" onclick="Admin.confirmDeleteUser()" style="flex:1" disabled>DELETE FOREVER</button>
            </div>
        </div>
    </div>

    <!-- DELETE CHARACTER MODAL -->
    <div class="modal-backdrop hidden" id="deleteCharModal">
        <div class="modal-box danger">
            <div class="modal-title danger">DELETE CHARACTER</div>
            <div class="modal-body">
                Permanently delete character <strong id="deleteCharTargetName"></strong>? This cannot be undone.
            </div>
            <div class="form-message" id="deleteCharMsg"></div>
            <div class="modal-actions">
                <button class="hud-btn-sm" onclick="Admin.closeModal('deleteCharModal')">CANCEL</button>
                <button class="hud-btn-sm danger" onclick="Admin.confirmDeleteChar()" style="flex:1">DELETE CHARACTER</button>
            </div>
        </div>
    </div>

    <script src="js/particles.js"></script>
    <script src="js/admin.js"></script>
</body>
</html>