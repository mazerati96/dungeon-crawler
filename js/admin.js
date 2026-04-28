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
    let inspectorSheetData = null;

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
                if (tabId === 'rawdata' || tabId === 'inspector') loadInspectorUsers();
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
        const statusEl = document.getElementById('jsonStatus');
        if (statusEl) statusEl.textContent = '';

        if (!cid) {
            if (editor) editor.value = '';
            if (label) label.textContent = 'No character selected';
            inspectorCharId = null;
            inspectorSheetData = null;
            renderSheetView(null);
            return;
        }
        inspectorCharId = cid;
        if (label) label.textContent = 'Loading…';

        const data = await apiGet({ action: 'sheet_json', cid });
        if (label) label.textContent = `Character id=${cid}`;
        try {
            const parsed = JSON.parse(data.raw ?? '{}');
            if (editor) editor.value = JSON.stringify(parsed, null, 2);
            inspectorSheetData = parsed;
        } catch {
            if (editor) editor.value = data.raw ?? '{}';
            inspectorSheetData = null;
        }
        renderSheetView(inspectorSheetData);
        // wire up view-toggle buttons if present in DOM (admin_dashboard)
        initViewToggle();
    }

    // alias used by admin_dashboard.php
    const inspectorLoadSheet = inspectorLoadJson;

    // ── View toggle (admin_dashboard has these in HTML) ──────────
    function initViewToggle() {
        document.querySelectorAll('.view-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => setInspectorView(btn.dataset.mode));
        });
        setInspectorView('sheet'); // default to sheet view
    }

    function setInspectorView(mode) {
        const sheetEl = document.getElementById('sheetView');
        const jsonPane = document.getElementById('jsonPane');
        const jsonCtrl = document.getElementById('jsonControls');
        document.querySelectorAll('.view-toggle-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === mode);
        });
        if (mode === 'sheet') {
            sheetEl?.classList.remove('hidden');
            if (jsonPane) jsonPane.classList.add('hidden');
            if (jsonCtrl) jsonCtrl.classList.add('hidden');
        } else {
            sheetEl?.classList.add('hidden');
            jsonPane?.classList.remove('hidden');
            jsonCtrl?.classList.remove('hidden');
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  SHEET VIEW RENDERER — mirrors dashboard.php field names
    // ══════════════════════════════════════════════════════════════
    function renderSheetView(d) {
        const el = document.getElementById('sheetView');
        if (!el) return;
        if (!d) {
            el.innerHTML = '<div class="sheet-empty">Select a crawler and character to view their sheet.</div>';
            return;
        }

        // ── helpers ────────────────────────────────────────────
        const e = str => esc(str);

        const field = (label, val) => {
            const v = (val !== undefined && val !== null && val !== '')
                ? `<span class="sv-val">${e(String(val))}</span>`
                : `<span class="sv-val sv-none">—</span>`;
            return `<div class="sv-field"><span class="sv-label">${label}</span>${v}</div>`;
        };

        const textarea = (label, val) => {
            if (!val) return '';
            return `<div class="sv-textarea-block">
                <div class="sv-label">${label}</div>
                <div class="sv-textarea-body">${e(String(val))}</div>
            </div>`;
        };

        const vitalBar = (label, cur, max, cls) => {
            const c = Number(cur) || 0, m = Number(max) || 0;
            const pct = m > 0 ? Math.min(100, Math.round((c / m) * 100)) : 0;
            return `<div class="sv-vital-row">
                <span class="sv-vital-label ${cls}">${label}</span>
                <div class="sv-vital-bar-wrap"><div class="sv-vital-bar ${cls}" style="width:${pct}%"></div></div>
                <span class="sv-vital-nums">${c} / ${m}</span>
            </div>`;
        };

        const statBox = (label, val) =>
            `<div class="sv-stat-box"><span class="sv-stat-val">${val ?? '—'}</span><span class="sv-stat-label">${label}</span></div>`;

        const check = (label, val) =>
            `<div class="sv-check-row"><span class="sv-check-icon">${val ? '✔' : '○'}</span><span class="sv-check-label ${val ? 'owned' : ''}">${label}</span></div>`;

        const section = (icon, title, content) =>
            `<div class="sv-section"><div class="sv-section-title">${icon} ${title}</div>${content}</div>`;

        const collapsible = (id, icon, title, count, inner) => `
            <div class="sv-collapsible" id="svc-${id}">
                <button class="sv-coll-header" onclick="Admin.svToggle('${id}')">
                    <span class="sv-coll-icon">▸</span>
                    <span>${icon} ${title}</span>
                    <span class="sv-coll-count">${count}</span>
                </button>
                <div class="sv-coll-body hidden">${inner || '<div class="sv-empty-list">Nothing here.</div>'}</div>
            </div>`;

        // ── identity ────────────────────────────────────────────
        const identityHtml = section('◈', 'CRAWLER IDENTITY', `
            <div class="sv-fields-grid">
                ${field('CRAWLER NAME', d.charName)}
                ${field('CLASS / TITLE', d.classTitle)}
                ${field('SPECIALIZATION', d.classSpec)}
                ${field('STARTING RACE', d.startingRace)}
                ${field('EVOLVED RACE', d.evolvedRace)}
                ${field('CURRENT FLOOR', d.floor)}
                ${field('LEVEL', d.level)}
                ${field('EXPERIENCE', d.xp)}
            </div>
            ${textarea('NOTES / BACKSTORY', d.backstory)}
        `);

        // ── personality / resources ─────────────────────────────
        const personalityHtml = section('◈', 'PERSONALITY & RESOURCES', `
            <div class="sv-fields-grid">
                ${field('CATCH PHRASE', d.catchPhrase)}
                ${field('SIGNATURE MOVE', d.signatureMove)}
                ${field('PATRON DEITY', d.deity)}
                ${field('GUILD / FACTION', d.faction)}
                ${field('GOLD / COINS', d.gold)}
            </div>
        `);

        // ── vitals ──────────────────────────────────────────────
        const vitalsHtml = section('◈', 'VITALS', `
            ${vitalBar('HP', d.hpCurrent, d.hpMax, 'hp')}
            ${vitalBar('MANA', d.manaCurrent, d.manaMax, 'mana')}
            ${vitalBar('MMTM', d.momentumCurrent, d.momentumMax, 'momentum')}
            ${vitalBar('MORL', d.moraleCurrent, d.moraleMax, 'morale')}
        `);

        // ── combat ──────────────────────────────────────────────
        const combatHtml = section('◈', 'COMBAT', `
            <div class="sv-stat-grid">
                ${statBox('STR', d.strength)}
                ${statBox('AGI', d.agility)}
                ${statBox('INT', d.intelligence)}
                ${statBox('CON', d.constitution)}
                ${statBox('CHA', d.charisma)}
                ${statBox('LCK', d.luck)}
                ${statBox('DEF', d.defense)}
                ${statBox('INIT', d.initiative)}
                ${statBox('SPD', d.speed)}
            </div>
        `);

        // ── status effects ──────────────────────────────────────
        const tags = Array.isArray(d.statusTags) ? d.statusTags : [];
        const statusHtml = section('◈', 'STATUS EFFECTS', `
            <div class="sv-status-list">
                ${tags.length
                ? tags.map(s => `<span class="sv-status-tag">${e(String(s))}</span>`).join('')
                : '<div class="sv-empty-list">No active effects.</div>'}
            </div>
        `);

        // ── equipped gear ───────────────────────────────────────
        const gearSlots = [
            ['HEAD', d.gearHead], ['CHEST', d.gearChest], ['HANDS', d.gearHands],
            ['LEGS', d.gearLegs], ['FEET', d.gearFeet], ['MAIN HAND', d.gearMainHand],
            ['OFF HAND', d.gearOffHand], ['ACCESSORY 1', d.gearAcc1],
            ['ACCESSORY 2', d.gearAcc2], ['TRINKET', d.gearTrinket],
        ];
        const gearHtml = section('◈', 'EQUIPPED GEAR', `
            <div class="sv-gear-grid">
                ${gearSlots.map(([label, val]) => field(label, val)).join('')}
            </div>
        `);

        // ── inventory ───────────────────────────────────────────
        const invItems = Array.isArray(d.inventory) ? d.inventory : [];
        const invHtml = collapsible('inventory', '⊞', 'INVENTORY', invItems.length,
            invItems.map(it => {
                const name = it.name || it.itemName || '';
                const rarity = it.rarity ? `<span class="sv-rarity sv-rarity-${it.rarity}">${e(it.rarity)}</span>` : '';
                const qty = it.qty ? `<span class="sv-li-sub">x${it.qty}</span>` : '';
                const desc = it.description ? `<span class="sv-li-sub">${e(it.description)}</span>` : '';
                return `<div class="sv-list-item"><span class="sv-li-name">${e(name)}</span>${rarity}${qty}${desc}</div>`;
            }).join('')
        );

        const lootTiers = [
            ['BRONZE', d.lootBronze], ['SILVER', d.lootSilver], ['GOLD', d.lootGold],
            ['PLATINUM', d.lootPlatinum], ['LEGENDARY', d.lootLegendary], ['CELESTIAL', d.lootCelestial],
            ['FAN BOXES', d.lootFan], ['HATER BOXES', d.lootHater],
        ].filter(([, v]) => v != null && v !== '' && v !== 0 && v !== '0');
        const lootHtml = lootTiers.length ? `
            <div class="sv-section sv-section-tight">
                <div class="sv-section-title">⊞ LOOT BOXES</div>
                <div class="sv-loot-grid">
                    ${lootTiers.map(([l, v]) => `<div class="sv-loot-tier"><span class="sv-loot-label">${l}</span><span class="sv-loot-val">${v}</span></div>`).join('')}
                </div>
            </div>` : '';

        // ── skills ──────────────────────────────────────────────
        const renderSkill = sk => {
            if (typeof sk === 'string') return `<div class="sv-list-item"><span class="sv-li-name">${e(sk)}</span></div>`;
            const name = sk.name || sk.skillName || '';
            const meta = [sk.cost && `Cost: ${sk.cost}`, sk.level && `Lv.${sk.level}`, sk.description]
                .filter(Boolean).map(e).join(' · ');
            return `<div class="sv-list-item"><span class="sv-li-name">${e(name)}</span>${meta ? `<span class="sv-li-sub">${meta}</span>` : ''}</div>`;
        };
        const activeSkills = Array.isArray(d.activeSkills) ? d.activeSkills : [];
        const passiveSkills = Array.isArray(d.passiveSkills) ? d.passiveSkills : [];

        const hotlistItems = [];
        for (let i = 1; i <= 10; i++) { if (d[`hotlist${i}`]) hotlistItems.push(`${i}: ${d[`hotlist${i}`]}`); }

        const skillsInner = `
            ${activeSkills.length ? '<div class="sv-sub-label">ACTIVE</div>' + activeSkills.map(renderSkill).join('') : ''}
            ${passiveSkills.length ? '<div class="sv-sub-label">PASSIVE</div>' + passiveSkills.map(renderSkill).join('') : ''}
            ${hotlistItems.length ? '<div class="sv-sub-label">HOTLIST</div>' + hotlistItems.map(h => `<div class="sv-list-item sv-li-hotlist"><span class="sv-li-name">${e(h)}</span></div>`).join('') : ''}
            ${(!activeSkills.length && !passiveSkills.length) ? '<div class="sv-empty-list">No skills yet.</div>' : ''}`;
        const skillsHtml = collapsible('skills', '◉', 'SKILLS', activeSkills.length + passiveSkills.length, skillsInner);

        // ── party ───────────────────────────────────────────────
        const partyMembers = Array.isArray(d.partyMembers) ? d.partyMembers : [];
        const pets = Array.isArray(d.pets) ? d.pets : [];
        const partyInner = `
            ${partyMembers.length ? '<div class="sv-sub-label">MEMBERS</div>' + partyMembers.map(m => {
            const name = m.name || '';
            const meta = [m.class, m.level && `Lv.${m.level}`, m.hp && `HP: ${m.hp}`, m.status].filter(Boolean).map(e).join(' · ');
            return `<div class="sv-list-item"><span class="sv-li-name">${e(name)}</span>${meta ? `<span class="sv-li-sub">${meta}</span>` : ''}</div>`;
        }).join('') : ''}
            ${pets.length ? '<div class="sv-sub-label">PETS & FAMILIARS</div>' + pets.map(p => {
            const name = p.name || (typeof p === 'string' ? p : '');
            const type = p.type ? `<span class="sv-li-sub">${e(p.type)}</span>` : '';
            return `<div class="sv-list-item"><span class="sv-li-name">${e(name)}</span>${type}</div>`;
        }).join('') : ''}
            ${(!partyMembers.length && !pets.length) ? '<div class="sv-empty-list">No party members.</div>' : ''}`;
        const partyHtml = collapsible('party', '◎', 'PARTY', partyMembers.length + pets.length, partyInner);

        // ── quests ──────────────────────────────────────────────
        const activeQuests = Array.isArray(d.activeQuests) ? d.activeQuests : [];
        const completedQuests = Array.isArray(d.completedQuests) ? d.completedQuests : [];
        const renderQuest = (q, done) => {
            if (typeof q === 'string') return `<div class="sv-list-item"><span class="sv-li-name">${e(q)}</span></div>`;
            const name = q.name || q.title || '';
            const pri = q.priority ? `<span class="sv-tag sv-tag-${q.priority}">${e(q.priority)}</span>` : '';
            const desc = q.description || q.desc || q.objective || '';
            return `<div class="sv-list-item">${done ? '<span class="sv-quest-done">✔</span>' : ''}<span class="sv-li-name">${e(name)}</span>${pri}${desc ? `<span class="sv-li-sub">${e(desc)}</span>` : ''}</div>`;
        };
        const questsInner = `
            ${activeQuests.length ? '<div class="sv-sub-label">ACTIVE</div>' + activeQuests.map(q => renderQuest(q, false)).join('') : ''}
            ${completedQuests.length ? '<div class="sv-sub-label">COMPLETED</div>' + completedQuests.map(q => renderQuest(q, true)).join('') : ''}
            ${(!activeQuests.length && !completedQuests.length) ? '<div class="sv-empty-list">No quests.</div>' : ''}`;
        const questsHtml = collapsible('quests', '◇', 'QUESTS', activeQuests.length + completedQuests.length, questsInner);

        // ── magic ───────────────────────────────────────────────
        const spells = Array.isArray(d.spells) ? d.spells : [];
        const renderSpell = sp => {
            if (typeof sp === 'string') return `<div class="sv-list-item"><span class="sv-li-name">${e(sp)}</span></div>`;
            const name = sp.name || sp.spellName || '';
            const school = sp.school ? `<span class="sv-spell-school sv-spell-${sp.school}">${e(sp.school)}</span>` : '';
            const meta = [sp.cost && `Cost: ${sp.cost}`, sp.level && `Lv.${sp.level}`, sp.description].filter(Boolean).map(e).join(' · ');
            return `<div class="sv-list-item"><span class="sv-li-name">${e(name)}</span>${school}${meta ? `<span class="sv-li-sub">${meta}</span>` : ''}</div>`;
        };
        const magicStats = [
            d.manaRegen !== undefined && `Mana Regen/Turn: ${d.manaRegen}`,
            d.spellPower !== undefined && `Spell Power: ${d.spellPower}`,
            d.magicResist !== undefined && `Magic Resist: ${d.magicResist}`,
        ].filter(Boolean);
        const magicInner = `
            ${magicStats.length ? '<div class="sv-sub-label">MANA MANAGEMENT</div><div class="sv-magic-stats">' + magicStats.map(s => `<span class="sv-magic-stat">${e(s)}</span>`).join('') + '</div>' : ''}
            ${spells.length ? '<div class="sv-sub-label">SPELLBOOK</div>' + spells.map(renderSpell).join('') : ''}
            ${d.magicNotes ? `<div class="sv-sub-label">MAGICAL NOTES</div><div class="sv-textarea-body">${e(d.magicNotes)}</div>` : ''}
            ${(!spells.length && !magicStats.length) ? '<div class="sv-empty-list">No spells.</div>' : ''}`;
        const magicHtml = collapsible('magic', '◈', 'MAGIC', spells.length, magicInner);

        // ── achievements ─────────────────────────────────────────
        const achievements = Array.isArray(d.achievements) ? d.achievements : [];
        const achHtml = collapsible('achievements', '★', 'ACHIEVEMENTS', achievements.length,
            achievements.map(a => {
                if (typeof a === 'string') return `<div class="sv-list-item sv-li-achievement"><span class="sv-li-name">★ ${e(a)}</span></div>`;
                const rarity = a.rarity ? `<span class="sv-rarity sv-rarity-${a.rarity}">${e(a.rarity)}</span>` : '';
                return `<div class="sv-list-item sv-li-achievement"><span class="sv-li-name">★ ${e(a.name || '')}</span>${rarity}${a.description ? `<span class="sv-li-sub">${e(a.description)}</span>` : ''}</div>`;
            }).join('')
        );

        // ── map ─────────────────────────────────────────────────
        const areas = Array.isArray(d.areas) ? d.areas : [];
        const mapInner = `
            <div class="sv-fields-grid" style="grid-template-columns:1fr 1fr">
                ${field('BOSS ENCOUNTERED', d.bossName)}
                ${field('BOSS STATUS', d.bossStatus)}
            </div>
            ${areas.length ? '<div class="sv-sub-label">EXPLORED AREAS</div>' + areas.map(a => {
            const name = typeof a === 'string' ? a : (a.name || '');
            const status = typeof a === 'object' ? (a.status || '') : '';
            return `<div class="sv-list-item"><span class="sv-li-name">${e(name)}</span>${status ? `<span class="sv-li-sub">${e(status)}</span>` : ''}</div>`;
        }).join('') : ''}
            ${d.mapNotes ? `<div class="sv-sub-label">MAP NOTES</div><div class="sv-textarea-body">${e(d.mapNotes)}</div>` : ''}`;
        const mapHtml = collapsible('map', '⊕', 'MAP', areas.length, mapInner);

        // ── safe room ───────────────────────────────────────────
        const srUpgrades = [
            ['Food Box (Kitchen)', d.upgradeFood],
            ['Storage Unit', d.upgradeStorage],
            ['De-Sleeving Box', d.upgradeDeSleeve],
            ["Deity's Box", d.upgradeDeity],
            ['Demolition Workshop', d.upgradeWorkshop],
            ['Second Scratch Pad', d.upgradeScratchpad],
        ];
        const bedroomList = Array.isArray(d.bedroomUpgrades) ? d.bedroomUpgrades : [];
        const trainingList = Array.isArray(d.trainingRooms) ? d.trainingRooms : [];
        const craftingList = Array.isArray(d.craftingTables) ? d.craftingTables : [];
        const fanEntries = Array.isArray(d.fanEntries) ? d.fanEntries : [];

        const safeRoomInner = `
            <div class="sv-sr-grid">
                ${field('ROOM TIER', d.safeRoomTier)}
                ${field('TITHE / OFFERING', d.safeRoomTithe)}
                ${field('SPONSOR NAME', d.sponsorName)}
                ${field('SPONSOR STATUS', d.sponsorStatus)}
                ${field('CONTRACT VALUE', d.sponsorValue)}
                ${field('PATRON NAME', d.patronName)}
                ${field('PATRON PERK', d.patronPerk)}
            </div>
            <div class="sv-sub-label">GENERAL UPGRADES</div>
            <div class="sv-upgrades-grid">
                ${srUpgrades.map(([l, v]) => check(l, v)).join('')}
            </div>
            ${d.safeRoomNotes ? `<div class="sv-sub-label">GENERAL NOTES</div><div class="sv-textarea-body">${e(d.safeRoomNotes)}</div>` : ''}
            ${d.sponsorNotes ? `<div class="sv-sub-label">SPONSOR NOTES</div><div class="sv-textarea-body">${e(d.sponsorNotes)}</div>` : ''}
            ${d.patronNotes ? `<div class="sv-sub-label">PATRON NOTES</div><div class="sv-textarea-body">${e(d.patronNotes)}</div>` : ''}
            ${bedroomList.length ? '<div class="sv-sub-label">BEDROOM UPGRADES</div>' + bedroomList.map(u => `<div class="sv-list-item"><span class="sv-li-name">${e(u.name || u)}</span>${u.bonus ? `<span class="sv-li-sub">${e(u.bonus)}</span>` : ''}</div>`).join('') : ''}
            ${trainingList.length ? '<div class="sv-sub-label">TRAINING ROOMS</div>' + trainingList.map(u => `<div class="sv-list-item"><span class="sv-li-name">${e(u.name || u)}</span>${u.bonus ? `<span class="sv-li-sub">${e(u.bonus)}</span>` : ''}</div>`).join('') : ''}
            ${craftingList.length ? '<div class="sv-sub-label">CRAFTING TABLES</div>' + craftingList.map(u => `<div class="sv-list-item"><span class="sv-li-name">${e(u.name || u)}</span></div>`).join('') : ''}
            ${(d.viewers || d.fameTier) ? `
                <div class="sv-sub-label">SOCIAL / FAN METRICS</div>
                <div class="sv-fields-grid" style="grid-template-columns:1fr 1fr">
                    ${field('VIEWERS', d.viewers)}
                    ${field('RATING', d.rating)}
                    ${field('TOTAL FANS', d.totalFans)}
                    ${field('HATERS', d.haters)}
                    ${field('FAME TIER', d.fameTier)}
                </div>
                ${d.socialNotes ? `<div class="sv-textarea-body" style="margin-top:.5rem">${e(d.socialNotes)}</div>` : ''}
            ` : ''}
            ${fanEntries.length ? '<div class="sv-sub-label">FAN BOARD</div>' + fanEntries.slice(-20).reverse().map(f => {
            const typeIcons = { fan: '💬', donation: '💰', threat: '⚠', sponsor: '⬡', hater: '👁' };
            return `<div class="sv-list-item"><span class="sv-li-name">${typeIcons[f.type] || '💬'} <strong>${e(f.source || f.name || '?')}</strong></span><span class="sv-li-sub">${e(f.message || f.msg || '')}</span></div>`;
        }).join('') : ''}`;

        const safeRoomCount = srUpgrades.filter(([, v]) => v).length;
        const safeRoomHtml = collapsible('saferoom', '⬡', 'SAFE ROOM', safeRoomCount, safeRoomInner);

        // ── factions ─────────────────────────────────────────────
        const factions = Array.isArray(d.factions) ? d.factions : [];
        const factionsHtml = collapsible('factions', '⚑', 'FACTIONS', factions.length,
            factions.map(f => {
                if (typeof f === 'string') return `<div class="sv-list-item"><span class="sv-li-name">${e(f)}</span></div>`;
                const name = f.name || '';
                const standing = f.standing !== undefined ? f.standing : '';
                const notes = f.notes || '';
                const bar = (standing !== '') ? `<div class="sv-faction-bar-wrap"><div class="sv-faction-bar" style="width:${Math.min(100, Math.max(0, (Number(standing) + 100) / 2))}%"></div></div><span class="sv-faction-num">${standing}</span>` : '';
                return `<div class="sv-list-item"><span class="sv-li-name">${e(name)}</span>${bar}${notes ? `<span class="sv-li-sub">${e(notes)}</span>` : ''}</div>`;
            }).join('')
        );

        // ── assemble ─────────────────────────────────────────────
        el.innerHTML = `
            <div class="sv-top-grid">
                <div style="display:flex;flex-direction:column;gap:.75rem">
                    ${identityHtml}
                    ${personalityHtml}
                </div>
                <div style="display:flex;flex-direction:column;gap:.75rem">
                    ${vitalsHtml}
                    ${combatHtml}
                    ${statusHtml}
                </div>
            </div>
            ${gearHtml}
            ${lootHtml}
            <div class="sv-sections-list">
                ${invHtml}
                ${skillsHtml}
                ${partyHtml}
                ${questsHtml}
                ${magicHtml}
                ${achHtml}
                ${mapHtml}
                ${safeRoomHtml}
                ${factionsHtml}
            </div>`;
    }

    function svToggle(id) {
        const body = document.querySelector(`#svc-${id} .sv-coll-body`);
        const icon = document.querySelector(`#svc-${id} .sv-coll-icon`);
        if (!body) return;
        body.classList.toggle('hidden');
        if (icon) icon.textContent = body.classList.contains('hidden') ? '▸' : '▾';
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
    // Works for both admin.php (tab="rawdata") and admin_dashboard.php (tab="inspector")
    async function jumpToInspector(uid, cid, charName) {
        const tabName = document.querySelector('[data-tab="inspector"]') ? 'inspector' : 'rawdata';
        const panelId = tabName === 'inspector' ? 'tab-inspector' : 'tab-rawdata';

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(panelId).classList.add('active');

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
        inspectorLoadChars, inspectorLoadJson, inspectorLoadSheet,
        inspectorFormatJson, inspectorSaveJson,
        setInspectorView, svToggle,
        jumpToInspector,
        loadAudit, loadAuditMore,
        openBanModal, confirmBan, unbanUser,
        openDeleteUserModal, confirmDeleteUser,
        openDeleteCharModal, confirmDeleteChar,
        closeModal,
    };

})();

document.addEventListener('DOMContentLoaded', () => Admin.init());