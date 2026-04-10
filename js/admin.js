// ============================================================
//  js/admin.js  —  System AI Dashboard
//
//  Four tabs: Stats, All Crawlers, Raw Data, Audit Log
//  All mutations go through api/admin.php
// ============================================================

const Admin = (() => {

    // ── State ────────────────────────────────────────────────
    let allUsers = [];   // full user list cache
    let auditOffset = 0;
    let auditTotal = 0;
    const AUDIT_LIMIT = 75;

    // Pending modal targets
    let pendingBanUid = null;
    let pendingDeleteUid = null;
    let pendingDeleteUname = null;
    let pendingDeleteCharId = null;

    // Inspector state
    let inspectorCharId = null;

    // ── API helper ───────────────────────────────────────────
    async function api(params, method = 'POST') {
        const body = new URLSearchParams(params);
        const res = await fetch('api/admin.php', { method, body });
        return res.json();
    }

    async function apiGet(params) {
        const qs = new URLSearchParams(params).toString();
        const res = await fetch('api/admin.php?' + qs);
        return res.json();
    }

    // ── Escape HTML ──────────────────────────────────────────
    function esc(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function fmtDate(d) {
        if (!d) return '—';
        return new Date(d).toLocaleString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    }

    // ── Tab switching ────────────────────────────────────────
    function initTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('tab-' + tabId)?.classList.add('active');

                // Lazy-load data on first visit
                if (tabId === 'stats') loadStats();
                if (tabId === 'crawlers') loadCrawlers();
                if (tabId === 'rawdata') loadInspectorUsers();
                if (tabId === 'audit') loadAudit(true);
            });
        });
    }

    // ═══════════════════════════════════════════════════════
    //  STATS TAB
    // ═══════════════════════════════════════════════════════
    async function loadStats() {
        const data = await apiGet({ action: 'stats' });
        if (!data.success) return;
        const s = data.stats;

        document.getElementById('st-users').textContent = s.total_users;
        document.getElementById('st-active').textContent = s.total_users - s.total_banned;
        document.getElementById('st-banned').textContent = s.total_banned;
        document.getElementById('st-admins').textContent = s.total_admins;
        document.getElementById('st-chars').textContent = s.total_chars;
        document.getElementById('st-audit').textContent = s.total_actions;

        const signupEl = document.getElementById('recentSignups');
        signupEl.innerHTML = s.recent_signups.length
            ? s.recent_signups.map(u => `
                <div class="mini-row">
                    <span class="mini-row-label">${esc(u.username)}</span>
                    <span class="mini-row-value">${fmtDate(u.created_at)}</span>
                </div>`).join('')
            : '<div style="color:var(--clr-text-dim);font-size:.72rem">No sign-ups yet.</div>';

        const loginEl = document.getElementById('recentLogins');
        loginEl.innerHTML = s.recent_logins.length
            ? s.recent_logins.map(u => `
                <div class="mini-row">
                    <span class="mini-row-label">${esc(u.username)}</span>
                    <span class="mini-row-value">${fmtDate(u.last_login)}</span>
                </div>`).join('')
            : '<div style="color:var(--clr-text-dim);font-size:.72rem">No logins yet.</div>';

        const actionEl = document.getElementById('topActions');
        actionEl.innerHTML = s.action_counts.length
            ? s.action_counts.map(a => `
                <div class="mini-row">
                    <span class="mini-row-label">${esc(a.action)}</span>
                    <span class="mini-row-value ai">${a.cnt}</span>
                </div>`).join('')
            : '<div style="color:var(--clr-text-dim);font-size:.72rem">No actions logged.</div>';
    }

    // ═══════════════════════════════════════════════════════
    //  ALL CRAWLERS TAB
    // ═══════════════════════════════════════════════════════
    async function loadCrawlers() {
        const data = await apiGet({ action: 'users' });
        if (!data.success) return;
        allUsers = data.users;
        renderCrawlers(allUsers);
    }

    function renderCrawlers(users) {
        const tbody = document.getElementById('crawlerTableBody');
        document.getElementById('crawlerCount').textContent = `${users.length} CRAWLERS`;
        tbody.innerHTML = '';

        users.forEach(u => {
            const isBanned = u.is_banned == 1;
            const isAdmin = u.is_admin == 1;

            // Main row
            const tr = document.createElement('tr');
            if (isBanned) tr.classList.add('banned');
            tr.innerHTML = `
                <td style="color:var(--clr-text-dim)">${u.id}</td>
                <td>
                    <span class="user-username">${esc(u.username)}</span>
                    ${isAdmin ? '<span class="badge badge-admin">ADMIN</span>' : ''}
                    ${isBanned ? '<span class="badge badge-banned">BANNED</span>' : ''}
                </td>
                <td><span class="user-email">${esc(u.email)}</span></td>
                <td style="text-align:center">
                    <button class="btn-xs view" onclick="Admin.toggleChars(${u.id})" title="Show characters">${u.char_count} ▾</button>
                </td>
                <td style="white-space:nowrap">${fmtDate(u.last_login)}</td>
                <td style="white-space:nowrap">${fmtDate(u.created_at)}</td>
                <td>
                    <div class="action-btns">
                        ${!isAdmin && !isBanned ? `<button class="btn-xs ban"   onclick="Admin.openBanModal(${u.id}, '${esc(u.username)}')">BAN</button>` : ''}
                        ${!isAdmin && isBanned ? `<button class="btn-xs unban" onclick="Admin.unbanUser(${u.id})">UNBAN</button>` : ''}
                        ${!isAdmin ? `<button class="btn-xs del" onclick="Admin.openDeleteUserModal(${u.id}, '${esc(u.username)}')">DELETE</button>` : ''}
                    </div>
                </td>`;
            tbody.appendChild(tr);

            // Expandable characters row
            const charTr = document.createElement('tr');
            charTr.classList.add('chars-row');
            charTr.id = `chars-row-${u.id}`;
            const charTd = document.createElement('td');
            charTd.colSpan = 7;
            charTd.innerHTML = `
                <div class="chars-inner">
                    <div class="chars-inner-title">CHARACTERS — loading…</div>
                    <div class="char-sub-list" id="chars-list-${u.id}"></div>
                </div>`;
            charTr.appendChild(charTd);
            tbody.appendChild(charTr);
        });
    }

    function filterCrawlers() {
        const q = document.getElementById('crawlerSearch').value.toLowerCase();
        const filtered = allUsers.filter(u =>
            u.username.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q)
        );
        renderCrawlers(filtered);
    }

    async function toggleChars(uid) {
        const row = document.getElementById(`chars-row-${uid}`);
        const list = document.getElementById(`chars-list-${uid}`);
        const isOpen = row.classList.contains('open');

        // Close all other open rows
        document.querySelectorAll('.chars-row.open').forEach(r => r.classList.remove('open'));

        if (!isOpen) {
            row.classList.add('open');
            // Load chars if not yet loaded
            if (list.innerHTML === '') {
                const data = await apiGet({ action: 'user_chars', uid });
                const inner = row.querySelector('.chars-inner-title');
                if (!data.success || !data.characters.length) {
                    inner.textContent = 'CHARACTERS — none found';
                    return;
                }
                inner.textContent = `CHARACTERS (${data.characters.length})`;
                list.innerHTML = data.characters.map(c => `
                    <div class="char-sub-row">
                        <span class="char-sub-name">${esc(c.name)}</span>
                        <span class="char-sub-meta">id=${c.id}</span>
                        <span class="char-sub-meta">Updated: ${fmtDate(c.updated_at)}</span>
                        <div class="action-btns">
                            <button class="btn-xs json" onclick="Admin.jumpToInspector(${uid}, ${c.id}, '${esc(c.name)}')">INSPECT</button>
                            <button class="btn-xs del"  onclick="Admin.openDeleteCharModal(${c.id}, '${esc(c.name)}')">DELETE</button>
                        </div>
                    </div>`).join('');
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    //  RAW DATA / JSON INSPECTOR TAB
    // ═══════════════════════════════════════════════════════
    async function loadInspectorUsers() {
        if (allUsers.length === 0) await loadCrawlers();
        const sel = document.getElementById('inspectorUserSelect');
        sel.innerHTML = '<option value="">— Select crawler —</option>';
        allUsers.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.text = `${u.username} (id=${u.id})`;
            sel.appendChild(opt);
        });
    }

    async function inspectorLoadChars() {
        const uid = document.getElementById('inspectorUserSelect').value;
        const sel = document.getElementById('inspectorCharSelect');
        sel.innerHTML = '<option value="">— Select character —</option>';
        document.getElementById('jsonEditor').value = '';
        document.getElementById('jsonCharLabel').textContent = 'No character selected';
        inspectorCharId = null;
        if (!uid) return;

        const data = await apiGet({ action: 'user_chars', uid });
        if (!data.success) return;
        data.characters.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.text = c.name;
            sel.appendChild(opt);
        });
    }

    async function inspectorLoadJson() {
        const cid = document.getElementById('inspectorCharSelect').value;
        const label = document.getElementById('jsonCharLabel');
        const editor = document.getElementById('jsonEditor');
        const status = document.getElementById('jsonStatus');
        status.textContent = '';

        if (!cid) { editor.value = ''; label.textContent = 'No character selected'; inspectorCharId = null; return; }
        inspectorCharId = cid;
        label.textContent = 'Loading…';

        const data = await apiGet({ action: 'sheet_json', cid });
        label.textContent = `Character id=${cid}`;
        editor.value = JSON.stringify(data.data ?? {}, null, 2);
    }

    function inspectorFormatJson() {
        const editor = document.getElementById('jsonEditor');
        const status = document.getElementById('jsonStatus');
        try {
            const parsed = JSON.parse(editor.value);
            editor.value = JSON.stringify(parsed, null, 2);
            status.className = 'json-status ok';
            status.textContent = '✓ Valid JSON';
        } catch (e) {
            status.className = 'json-status error';
            status.textContent = '✕ ' + e.message;
        }
    }

    async function inspectorSaveJson() {
        const status = document.getElementById('jsonStatus');
        if (!inspectorCharId) { status.className = 'json-status error'; status.textContent = 'No character selected.'; return; }
        const raw = document.getElementById('jsonEditor').value;
        try { JSON.parse(raw); } catch (e) {
            status.className = 'json-status error';
            status.textContent = '✕ Invalid JSON — ' + e.message;
            return;
        }
        status.textContent = 'Saving…';
        const res = await api({ action: 'edit_sheet', cid: inspectorCharId, sheet_json: raw });
        status.className = res.success ? 'json-status ok' : 'json-status error';
        status.textContent = res.success ? '✓ Saved successfully' : '✕ ' + (res.message || 'Error');
    }

    // Jump to inspector from crawlers tab
    async function jumpToInspector(uid, cid, charName) {
        // Switch to rawdata tab
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelector('[data-tab="rawdata"]').classList.add('active');
        document.getElementById('tab-rawdata').classList.add('active');

        await loadInspectorUsers();
        document.getElementById('inspectorUserSelect').value = uid;
        await inspectorLoadChars();
        document.getElementById('inspectorCharSelect').value = cid;
        await inspectorLoadJson();
    }

    // ═══════════════════════════════════════════════════════
    //  AUDIT LOG TAB
    // ═══════════════════════════════════════════════════════
    async function loadAudit(reset = false) {
        if (reset) auditOffset = 0;
        const filter = document.getElementById('auditFilter').value.trim();
        const data = await apiGet({ action: 'audit', limit: AUDIT_LIMIT, offset: auditOffset, filter });
        if (!data.success) return;

        auditTotal = data.total;
        document.getElementById('auditCount').textContent = `${auditTotal} TOTAL ENTRIES`;

        const tbody = document.getElementById('auditTableBody');
        if (reset) tbody.innerHTML = '';

        data.logs.forEach(log => {
            const tr = document.createElement('tr');
            const actionClass = (log.action || '').replace(/_/g, '_').toLowerCase();
            tr.innerHTML = `
                <td class="audit-ts">${fmtDate(log.created_at)}</td>
                <td><span class="audit-action ${actionClass}">${esc(log.action)}</span></td>
                <td class="audit-user">${esc(log.username) || '<span style="color:var(--clr-text-dim)">—</span>'}</td>
                <td class="audit-detail">${esc(log.detail) || '—'}</td>
                <td style="color:var(--clr-text-dim);font-size:.65rem">${esc(log.ip) || '—'}</td>`;
            tbody.appendChild(tr);
        });

        auditOffset += data.logs.length;
        const loadMore = document.getElementById('auditLoadMore');
        loadMore.classList.toggle('hidden', auditOffset >= auditTotal);
    }

    function loadAuditMore() { loadAudit(false); }

    // ═══════════════════════════════════════════════════════
    //  BAN MODAL
    // ═══════════════════════════════════════════════════════
    function openBanModal(uid, username) {
        pendingBanUid = uid;
        document.getElementById('banTargetName').textContent = username;
        document.getElementById('banReason').value = '';
        document.getElementById('banMsg').textContent = '';
        document.getElementById('banModal').classList.remove('hidden');
    }

    async function confirmBan() {
        const reason = document.getElementById('banReason').value.trim();
        const msg = document.getElementById('banMsg');
        const res = await api({ action: 'ban', uid: pendingBanUid, reason });
        if (res.success) {
            closeModal('banModal');
            loadCrawlers();
            loadStats();
        } else {
            msg.className = 'form-message error';
            msg.textContent = res.message || 'Error.';
        }
    }

    async function unbanUser(uid) {
        const res = await api({ action: 'unban', uid });
        if (res.success) { loadCrawlers(); loadStats(); }
    }

    // ═══════════════════════════════════════════════════════
    //  DELETE USER MODAL
    // ═══════════════════════════════════════════════════════
    function openDeleteUserModal(uid, username) {
        pendingDeleteUid = uid;
        pendingDeleteUname = username;
        document.getElementById('deleteUserTargetName').textContent = username;
        document.getElementById('deleteUserConfirm').value = '';
        document.getElementById('deleteUserMsg').textContent = '';
        document.getElementById('deleteUserConfirmBtn').disabled = true;
        document.getElementById('deleteUserModal').classList.remove('hidden');
    }

    async function confirmDeleteUser() {
        const msg = document.getElementById('deleteUserMsg');
        const res = await api({ action: 'delete_user', uid: pendingDeleteUid });
        if (res.success) {
            closeModal('deleteUserModal');
            loadCrawlers();
            loadStats();
        } else {
            msg.className = 'form-message error';
            msg.textContent = res.message || 'Error.';
        }
    }

    // ═══════════════════════════════════════════════════════
    //  DELETE CHARACTER MODAL
    // ═══════════════════════════════════════════════════════
    function openDeleteCharModal(cid, name) {
        pendingDeleteCharId = cid;
        document.getElementById('deleteCharTargetName').textContent = name;
        document.getElementById('deleteCharMsg').textContent = '';
        document.getElementById('deleteCharModal').classList.remove('hidden');
    }

    async function confirmDeleteChar() {
        const msg = document.getElementById('deleteCharMsg');
        const res = await api({ action: 'delete_char', cid: pendingDeleteCharId });
        if (res.success) {
            closeModal('deleteCharModal');
            loadCrawlers();
        } else {
            msg.className = 'form-message error';
            msg.textContent = res.message || 'Error.';
        }
    }

    // ── Generic modal close ──────────────────────────────────
    function closeModal(id) {
        document.getElementById(id)?.classList.add('hidden');
    }

    // ── Init ─────────────────────────────────────────────────
    function init() {
        initTabs();

        // Delete user confirm gate
        document.getElementById('deleteUserConfirm').addEventListener('input', function () {
            document.getElementById('deleteUserConfirmBtn').disabled =
                this.value !== pendingDeleteUname;
        });

        // Close modals on backdrop click
        document.querySelectorAll('.modal-backdrop').forEach(m => {
            m.addEventListener('click', e => { if (e.target === m) m.classList.add('hidden'); });
        });

        // Load stats on boot
        loadStats();
    }

    return {
        init,
        loadStats, loadCrawlers, filterCrawlers, toggleChars,
        inspectorLoadChars, inspectorLoadJson, inspectorFormatJson, inspectorSaveJson,
        jumpToInspector,
        loadAudit, loadAuditMore,
        openBanModal, confirmBan, unbanUser,
        openDeleteUserModal, confirmDeleteUser,
        openDeleteCharModal, confirmDeleteChar,
        closeModal,
    };

})();

document.addEventListener('DOMContentLoaded', () => Admin.init());