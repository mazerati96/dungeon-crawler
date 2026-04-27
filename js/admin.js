// ============================================================
//  js/admin.js  —  System AI Dashboard
//
//  Four tabs: Stats, All Crawlers, Inspector (Sheet+JSON), Audit Log
//  All mutations go through api/admin.php
// ============================================================

const Admin = (() => {

    // ── State ────────────────────────────────────────────────
    let allUsers = [];
    let auditOffset = 0;
    let auditTotal = 0;
    const AUDIT_LIMIT = 75;

    let pendingBanUid = null;
    let pendingDeleteUid = null;
    let pendingDeleteUname = null;
    let pendingDeleteCharId = null;

    let inspectorCharId = null;
    let inspectorSheetData = null;
    let inspectorMode = 'sheet'; // 'sheet' | 'json'

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

    function val(v, fallback = '—') {
        if (v == null || v === '') return fallback;
        return esc(String(v));
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

                if (tabId === 'stats') loadStats();
                if (tabId === 'crawlers') loadCrawlers();
                if (tabId === 'inspector') loadInspectorUsers();
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
    //  CRAWLERS TAB
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
                        ${!isAdmin ? `<button class="btn-xs del"   onclick="Admin.openDeleteUserModal(${u.id}, '${esc(u.username)}')">DELETE</button>` : ''}
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

        document.querySelectorAll('.chars-row.open').forEach(r => r.classList.remove('open'));

        if (!isOpen) {
            row.classList.add('open');
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
    //  INSPECTOR TAB — Sheet View + JSON Toggle
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
        clearSheetView();
        document.getElementById('jsonEditor').value = '';
        document.getElementById('jsonCharLabel').textContent = 'No character selected';
        inspectorCharId = null;
        inspectorSheetData = null;
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

    async function inspectorLoadSheet() {
        const cid = document.getElementById('inspectorCharSelect').value;
        const label = document.getElementById('jsonCharLabel');
        const status = document.getElementById('jsonStatus');
        status.textContent = '';

        if (!cid) {
            clearSheetView();
            document.getElementById('jsonEditor').value = '';
            label.textContent = 'No character selected';
            inspectorCharId = null;
            inspectorSheetData = null;
            return;
        }

        inspectorCharId = cid;
        label.textContent = 'Loading…';

        const data = await apiGet({ action: 'sheet_json', cid });
        label.textContent = `Character id=${cid}`;

        try {
            inspectorSheetData = JSON.parse(data.raw ?? '{}');
        } catch {
            inspectorSheetData = {};
        }

        // Populate JSON editor
        document.getElementById('jsonEditor').value = JSON.stringify(inspectorSheetData, null, 2);

        // Render sheet view
        renderSheetView(inspectorSheetData);
    }

    // Keep old name as alias so jumpToInspector still works
    const inspectorLoadJson = inspectorLoadSheet;

    // ── Sheet View Renderer ──────────────────────────────────
    function clearSheetView() {
        const sv = document.getElementById('sheetView');
        if (sv) sv.innerHTML = '<div class="sheet-empty">Select a crawler and character to view their sheet.</div>';
    }

    function bar(current, max, cssClass) {
        const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
        return `
            <div class="sv-bar-wrap">
                <div class="sv-bar ${cssClass}" style="width:${pct}%"></div>
            </div>`;
    }

    function renderSheetView(d) {
        const sv = document.getElementById('sheetView');
        if (!sv) return;

        // helpers
        const n = (k, fb = '—') => val(d[k], fb);
        const num = k => (d[k] != null && d[k] !== '') ? Number(d[k]) : 0;

        // ── IDENTITY ────────────────────────────────────────
        const identityHtml = `
            <div class="sv-section sv-identity-section">
                <div class="sv-section-header">◈ CRAWLER IDENTITY</div>
                <div class="sv-identity-grid">
                    <div class="sv-id-block">
                        <div class="sv-id-label">NAME</div>
                        <div class="sv-id-value sv-name">${n('charName')}</div>
                    </div>
                    <div class="sv-id-block">
                        <div class="sv-id-label">CLASS / TITLE</div>
                        <div class="sv-id-value">${n('classTitle')}</div>
                    </div>
                    <div class="sv-id-block">
                        <div class="sv-id-label">RACE</div>
                        <div class="sv-id-value">${n('race')}</div>
                    </div>
                    <div class="sv-id-block">
                        <div class="sv-id-label">LEVEL</div>
                        <div class="sv-id-value sv-big-num">${n('level', '1')}</div>
                    </div>
                    <div class="sv-id-block">
                        <div class="sv-id-label">FLOOR</div>
                        <div class="sv-id-value sv-big-num">${n('floor', '1')}</div>
                    </div>
                    <div class="sv-id-block">
                        <div class="sv-id-label">XP</div>
                        <div class="sv-id-value sv-big-num">${n('xp', '0')}</div>
                    </div>
                </div>
                ${d.statusTags && d.statusTags.length ? `
                <div class="sv-tags-row">
                    ${d.statusTags.map(t => `<span class="sv-tag">${esc(t.tag || t)}</span>`).join('')}
                </div>` : ''}
            </div>`;

        // ── VITALS ──────────────────────────────────────────
        const vitals = [
            { key: 'hp', cur: 'hpCurrent', max: 'hpMax', label: 'HP', cls: 'bar-hp' },
            { key: 'mana', cur: 'manaCurrent', max: 'manaMax', label: 'MANA', cls: 'bar-mana' },
            { key: 'momentum', cur: 'momentumCurrent', max: 'momentumMax', label: 'MOMENTUM', cls: 'bar-momentum' },
            { key: 'morale', cur: 'moraleCurrent', max: 'moraleMax', label: 'MORALE', cls: 'bar-morale' },
        ];

        const vitalsHtml = `
            <div class="sv-section">
                <div class="sv-section-header">◈ VITALS</div>
                ${vitals.map(v => {
            const cur = num(v.cur), mx = num(v.max);
            return `
                    <div class="sv-vital-row">
                        <span class="sv-vital-label ${v.cls}-label">${v.label}</span>
                        <span class="sv-vital-nums">${cur} / ${mx}</span>
                        ${bar(cur, mx, v.cls)}
                    </div>`;
        }).join('')}
                ${d.armorClass != null ? `
                <div class="sv-vital-row">
                    <span class="sv-vital-label">ARMOR CLASS</span>
                    <span class="sv-vital-nums">${n('armorClass')}</span>
                </div>` : ''}
            </div>`;

        // ── CORE STATS ──────────────────────────────────────
        const coreStats = [
            ['STR', 'strength'], ['DEX', 'dexterity'], ['INT', 'intelligence'],
            ['WIS', 'wisdom'], ['CON', 'constitution'], ['CHA', 'charisma'],
        ];

        const statsHtml = `
            <div class="sv-section">
                <div class="sv-section-header">◈ CORE STATS</div>
                <div class="sv-stat-grid">
                    ${coreStats.map(([label, key]) => {
            const v = d[key] != null ? d[key] : '—';
            return `<div class="sv-stat-block">
                            <div class="sv-stat-val">${esc(String(v))}</div>
                            <div class="sv-stat-key">${label}</div>
                        </div>`;
        }).join('')}
                </div>
                ${d.luck != null ? `<div class="sv-mini-stat">LUCK <span>${n('luck')}</span></div>` : ''}
                ${d.speed != null ? `<div class="sv-mini-stat">SPEED <span>${n('speed')}</span></div>` : ''}
                ${d.initiative != null ? `<div class="sv-mini-stat">INIT <span>${n('initiative')}</span></div>` : ''}
            </div>`;

        // ── COMBAT ──────────────────────────────────────────
        const combatFields = [
            ['ATTACK BONUS', 'attackBonus'],
            ['DAMAGE BONUS', 'damageBonus'],
            ['CRIT RANGE', 'critRange'],
            ['SAVE BONUS', 'saveBonus'],
            ['SPELL ATTACK', 'spellAttack'],
            ['SPELL SAVE DC', 'spellSaveDC'],
        ].filter(([, k]) => d[k] != null && d[k] !== '');

        const combatHtml = combatFields.length ? `
            <div class="sv-section">
                <div class="sv-section-header">◈ COMBAT</div>
                <div class="sv-kv-list">
                    ${combatFields.map(([label, key]) =>
            `<div class="sv-kv-row"><span class="sv-kv-key">${label}</span><span class="sv-kv-val">${n(key)}</span></div>`
        ).join('')}
                </div>
                ${d.combatNotes ? `<div class="sv-notes-block">${n('combatNotes')}</div>` : ''}
            </div>` : '';

        // ── COLLAPSIBLE SECTIONS ─────────────────────────────
        function collapsibleList(id, header, icon, items, renderItem, emptyMsg = 'None.') {
            if (!items || !items.length) return `
                <div class="sv-section sv-collapsible">
                    <div class="sv-section-header sv-collapsible-header" onclick="Admin.toggleCollapse('${id}')">
                        ${icon} ${header} <span class="sv-collapse-badge">0</span>
                        <span class="sv-collapse-arrow">▾</span>
                    </div>
                    <div class="sv-collapse-body collapsed" id="${id}">
                        <div class="sv-empty">${emptyMsg}</div>
                    </div>
                </div>`;
            return `
                <div class="sv-section sv-collapsible">
                    <div class="sv-section-header sv-collapsible-header" onclick="Admin.toggleCollapse('${id}')">
                        ${icon} ${header} <span class="sv-collapse-badge">${items.length}</span>
                        <span class="sv-collapse-arrow">▾</span>
                    </div>
                    <div class="sv-collapse-body" id="${id}">
                        ${items.map(renderItem).join('')}
                    </div>
                </div>`;
        }

        // Inventory
        const invHtml = collapsibleList('sv-inv', 'INVENTORY', '⊞',
            d.inventory,
            item => `<div class="sv-list-row">
                <span class="sv-list-name">${esc(item.name || '?')}</span>
                ${item.qty ? `<span class="sv-list-meta">×${esc(item.qty)}</span>` : ''}
                ${item.type ? `<span class="sv-tag-sm">${esc(item.type)}</span>` : ''}
                ${item.notes ? `<span class="sv-list-notes">${esc(item.notes)}</span>` : ''}
            </div>`
        );

        // Active Skills
        const activeSkillsHtml = collapsibleList('sv-active-skills', 'ACTIVE SKILLS', '◉',
            d.activeSkills,
            s => `<div class="sv-list-row">
                <span class="sv-list-name">${esc(s.name || '?')}</span>
                ${s.rank ? `<span class="sv-list-meta">Rank ${esc(s.rank)}</span>` : ''}
                ${s.notes ? `<span class="sv-list-notes">${esc(s.notes)}</span>` : ''}
            </div>`
        );

        // Passive Skills
        const passiveSkillsHtml = collapsibleList('sv-passive-skills', 'PASSIVE SKILLS', '◎',
            d.passiveSkills,
            s => `<div class="sv-list-row">
                <span class="sv-list-name">${esc(s.name || '?')}</span>
                ${s.rank ? `<span class="sv-list-meta">Rank ${esc(s.rank)}</span>` : ''}
                ${s.notes ? `<span class="sv-list-notes">${esc(s.notes)}</span>` : ''}
            </div>`
        );

        // Spells
        const spellsHtml = collapsibleList('sv-spells', 'MAGIC / SPELLS', '◈',
            d.spells,
            sp => `<div class="sv-list-row">
                <span class="sv-list-name">${esc(sp.name || '?')}</span>
                ${sp.level ? `<span class="sv-tag-sm">Lv ${esc(sp.level)}</span>` : ''}
                ${sp.school ? `<span class="sv-list-meta">${esc(sp.school)}</span>` : ''}
                ${sp.notes ? `<span class="sv-list-notes">${esc(sp.notes)}</span>` : ''}
            </div>`
        );

        // Party
        const partyHtml = collapsibleList('sv-party', 'PARTY', '◎',
            d.party,
            m => `<div class="sv-list-row">
                <span class="sv-list-name">${esc(m.name || '?')}</span>
                ${m.role ? `<span class="sv-tag-sm">${esc(m.role)}</span>` : ''}
                ${m.relation ? `<span class="sv-list-meta">${esc(m.relation)}</span>` : ''}
            </div>`
        );

        // Quests
        const questsActive = collapsibleList('sv-quests-active', 'ACTIVE QUESTS', '◇',
            d.activeQuests,
            q => `<div class="sv-list-row">
                <span class="sv-list-name">${esc(q.title || q.name || '?')}</span>
                ${q.priority ? `<span class="sv-tag-sm">${esc(q.priority)}</span>` : ''}
                ${q.notes ? `<span class="sv-list-notes">${esc(q.notes)}</span>` : ''}
            </div>`
        );

        const questsDone = collapsibleList('sv-quests-done', 'COMPLETED QUESTS', '◇',
            d.completedQuests,
            q => `<div class="sv-list-row sv-list-row-done">
                <span class="sv-list-name">${esc(q.title || q.name || '?')}</span>
                <span class="sv-list-meta sv-done-tick">✓</span>
            </div>`
        );

        // Achievements
        const achHtml = collapsibleList('sv-ach', 'ACHIEVEMENTS', '★',
            d.achievements,
            a => `<div class="sv-list-row">
                <span class="sv-list-name">${esc(a.title || a.name || '?')}</span>
                ${a.date ? `<span class="sv-list-meta">${esc(a.date)}</span>` : ''}
            </div>`
        );

        // ── NOTES ───────────────────────────────────────────
        const notesFields = [
            ['BACKGROUND', 'background'],
            ['PERSONALITY', 'personality'],
            ['BONDS', 'bonds'],
            ['FLAWS', 'flaws'],
            ['GOALS', 'goals'],
            ['GENERAL NOTES', 'notes'],
        ].filter(([, k]) => d[k]);

        const notesHtml = notesFields.length ? `
            <div class="sv-section">
                <div class="sv-section-header">◈ NOTES & LORE</div>
                ${notesFields.map(([label, key]) => `
                    <div class="sv-notes-group">
                        <div class="sv-notes-label">${label}</div>
                        <div class="sv-notes-block">${n(key)}</div>
                    </div>`).join('')}
            </div>` : '';

        // ── SAFE ROOM ────────────────────────────────────────
        const srFields = [
            ['LOCATION', 'safeRoom'], ['TIER', 'safeRoomTier'], ['GOLD', 'gold'],
        ].filter(([, k]) => d[k] != null && d[k] !== '');

        const safeRoomHtml = srFields.length ? `
            <div class="sv-section">
                <div class="sv-section-header">⌂ SAFE ROOM</div>
                <div class="sv-kv-list">
                    ${srFields.map(([label, key]) =>
            `<div class="sv-kv-row"><span class="sv-kv-key">${label}</span><span class="sv-kv-val">${n(key)}</span></div>`
        ).join('')}
                </div>
                ${d.sponsorName ? `
                <div class="sv-kv-list" style="margin-top:.5rem;padding-top:.5rem;border-top:1px solid var(--clr-border-dim)">
                    <div class="sv-kv-row"><span class="sv-kv-key">SPONSOR</span><span class="sv-kv-val">${n('sponsorName')}</span></div>
                    ${d.sponsorStatus ? `<div class="sv-kv-row"><span class="sv-kv-key">STATUS</span><span class="sv-kv-val">${n('sponsorStatus')}</span></div>` : ''}
                    ${d.sponsorValue ? `<div class="sv-kv-row"><span class="sv-kv-key">CONTRACT</span><span class="sv-kv-val">${n('sponsorValue')}</span></div>` : ''}
                </div>` : ''}
            </div>` : '';

        // ── ASSEMBLE ─────────────────────────────────────────
        sv.innerHTML = `
            <div class="sv-layout">
                <div class="sv-col-main">
                    ${identityHtml}
                    ${vitalsHtml}
                    ${statsHtml}
                    ${combatHtml}
                    ${notesHtml}
                    ${safeRoomHtml}
                </div>
                <div class="sv-col-side">
                    ${invHtml}
                    ${activeSkillsHtml}
                    ${passiveSkillsHtml}
                    ${spellsHtml}
                    ${partyHtml}
                    ${questsActive}
                    ${questsDone}
                    ${achHtml}
                </div>
            </div>`;
    }

    function toggleCollapse(id) {
        const body = document.getElementById(id);
        if (!body) return;
        body.classList.toggle('collapsed');
        const arrow = body.previousElementSibling?.querySelector('.sv-collapse-arrow');
        if (arrow) arrow.textContent = body.classList.contains('collapsed') ? '▾' : '▴';
    }

    // ── Inspector view mode toggle ───────────────────────────
    function setInspectorMode(mode) {
        inspectorMode = mode;
        document.getElementById('sheetView').classList.toggle('hidden', mode !== 'sheet');
        document.getElementById('jsonPane').classList.toggle('hidden', mode !== 'json');

        document.querySelectorAll('.view-toggle-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === mode);
        });
    }

    // ── JSON editor helpers ──────────────────────────────────
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
        if (res.success) {
            status.className = 'json-status ok';
            status.textContent = '✓ Saved successfully';
            // Re-parse and refresh the sheet view
            try {
                inspectorSheetData = JSON.parse(raw);
                renderSheetView(inspectorSheetData);
            } catch { /* ignore */ }
        } else {
            status.className = 'json-status error';
            status.textContent = '✕ ' + (res.message || 'Error');
        }
    }

    // Jump to inspector from crawlers tab
    async function jumpToInspector(uid, cid, charName) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelector('[data-tab="inspector"]').classList.add('active');
        document.getElementById('tab-inspector').classList.add('active');

        await loadInspectorUsers();
        document.getElementById('inspectorUserSelect').value = uid;
        await inspectorLoadChars();
        document.getElementById('inspectorCharSelect').value = cid;
        await inspectorLoadSheet();
        setInspectorMode('sheet');
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
            const actionClass = (log.action || '').toLowerCase();
            tr.innerHTML = `
                <td class="audit-ts">${fmtDate(log.created_at)}</td>
                <td><span class="audit-action ${actionClass}">${esc(log.action)}</span></td>
                <td class="audit-user">${esc(log.username) || '<span style="color:var(--clr-text-dim)">—</span>'}</td>
                <td class="audit-detail">${esc(log.detail) || '—'}</td>
                <td style="color:var(--clr-text-dim);font-size:.65rem">${esc(log.ip) || '—'}</td>`;
            tbody.appendChild(tr);
        });

        auditOffset += data.logs.length;
        document.getElementById('auditLoadMore').classList.toggle('hidden', auditOffset >= auditTotal);
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

        // View toggle buttons
        document.querySelectorAll('.view-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => setInspectorMode(btn.dataset.mode));
        });

        loadStats();
    }

    return {
        init,
        loadStats, loadCrawlers, filterCrawlers, toggleChars,
        inspectorLoadChars, inspectorLoadJson: inspectorLoadSheet, inspectorLoadSheet,
        inspectorFormatJson, inspectorSaveJson,
        jumpToInspector,
        setInspectorMode, toggleCollapse,
        loadAudit, loadAuditMore,
        openBanModal, confirmBan, unbanUser,
        openDeleteUserModal, confirmDeleteUser,
        openDeleteCharModal, confirmDeleteChar,
        closeModal,
    };

})();

document.addEventListener('DOMContentLoaded', () => Admin.init());