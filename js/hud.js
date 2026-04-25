// ============================================================
//  js/hud.js  —  Dungeon Crawler Interface
//
//  Responsibilities:
//    - Tab switching
//    - Character load / save (via api/character.php)
//    - Autosave on field change (debounced)
//    - All dynamic list management (inventory, skills, party,
//      quests, spells, achievements, areas, pets)
//    - New / Delete character modals
// ============================================================

const HUD = (() => {

    // ── State ────────────────────────────────────────────────
    let activeCharId = null;
    let sheetData = {};
    let saveTimer = null;
    let isDirty = false;
    let loadingId = 0;   // incremented each loadCharacter call; stale responses are ignored

    // Dynamic arrays stored in sheetData
    const ARRAY_KEYS = ['inventory', 'activeSkills', 'passiveSkills', 'party', 'pets',
        'activeQuests', 'completedQuests', 'spells', 'achievements', 'areas', 'statusTags',
        'srBedroom', 'srTraining', 'srCrafting', 'fanFeed'];
    ARRAY_KEYS.forEach(k => { /* ensure they exist after load */ });

    // ── DOM refs ─────────────────────────────────────────────
    const charSelect = document.getElementById('charSelect');
    const newCharBtn = document.getElementById('newCharBtn');
    const delCharBtn = document.getElementById('delCharBtn');
    const saveBtn = document.getElementById('saveBtn');
    const saveStatus = document.getElementById('saveStatus');
    const newCharModal = document.getElementById('newCharModal');
    const delCharModal = document.getElementById('delCharModal');
    const newCharInput = document.getElementById('newCharName');
    const newCharMsg = document.getElementById('newCharMsg');
    const delConfirm = document.getElementById('delCharConfirm');
    const delMsg = document.getElementById('delCharMsg');
    const delConfirmBtn = document.getElementById('delCharConfirmBtn');

    // ── API helper ───────────────────────────────────────────
    async function api(params) {
        const body = new URLSearchParams(params);
        const res = await fetch('api/character.php', { method: 'POST', body });
        return res.json();
    }

    // ── Status bar ───────────────────────────────────────────
    function setStatus(state) {
        saveStatus.className = 'save-status ' + (state || '');
        if (state === 'saved' || state === 'error') {
            setTimeout(() => saveStatus.className = 'save-status', 1800);
        }
    }

    // ── Save ─────────────────────────────────────────────────
    async function save() {
        if (!activeCharId) return;
        setStatus('saving');
        const data = await api({
            action: 'save',
            id: activeCharId,
            sheet_json: JSON.stringify(sheetData),
        });
        setStatus(data.success ? 'saved' : 'error');
        isDirty = false;
    }

    function markDirty() {
        isDirty = true;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(save, 2200);
    }

    // ── Read all data-field inputs into sheetData ────────────
    // First occurrence wins — prevents any duplicate data-field from clobbering earlier values
    function collectFields() {
        const seen = new Set();
        document.querySelectorAll('[data-field]').forEach(el => {
            const k = el.dataset.field;
            if (seen.has(k)) return;
            seen.add(k);
            if (el.type === 'checkbox') {
                sheetData[k] = el.checked;
            } else {
                sheetData[k] = el.value;
            }
        });
    }

    // ── Write sheetData back into inputs ─────────────────────
    function populateFields() {
        // Clear every field first — prevents previous character's values
        // lingering in the DOM when the new character doesn't have that key
        document.querySelectorAll('[data-field]').forEach(el => {
            if (el.type === 'checkbox') {
                el.checked = false;
            } else if (el.tagName === 'SELECT') {
                el.value = '';
            } else {
                el.value = '';
            }
        });
        // Now write from sheetData
        document.querySelectorAll('[data-field]').forEach(el => {
            const k = el.dataset.field;
            if (!(k in sheetData)) return;
            if (el.type === 'checkbox') {
                el.checked = !!sheetData[k];
            } else {
                el.value = sheetData[k] ?? '';
            }
        });
    }

    // ── Bind change events ───────────────────────────────────
    function bindFields() {
        document.querySelectorAll('[data-field]').forEach(el => {
            const evt = (el.tagName === 'TEXTAREA' || el.type === 'checkbox') ? 'change' : 'input';
            el.addEventListener(evt, () => {
                collectFields();
                markDirty();
            });
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

                // When entering the Safe Room tab, ensure the active sr-panel is visible.
                // The tab-panel switch above removes 'active' from all children including sr-panels.
                if (tabId === 'saferoom') {
                    const activeSrTab = document.querySelector('.sr-tab.active');
                    const srtab = activeSrTab?.dataset.srtab || 'general';
                    document.querySelectorAll('.sr-panel').forEach(p => p.classList.remove('active'));
                    document.getElementById('srp-' + srtab)?.classList.add('active');
                }
            });
        });

        // Safe Room sub-tabs
        document.querySelectorAll('.sr-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const srtab = btn.dataset.srtab;
                document.querySelectorAll('.sr-tab').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.sr-panel').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('srp-' + srtab)?.classList.add('active');
            });
        });
    }

    // ── Load character list ──────────────────────────────────
    async function loadCharList() {
        const data = await api({ action: 'list' });
        if (!data.success) return;

        charSelect.innerHTML = '<option value="">— SELECT CRAWLER —</option>';
        data.characters.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.text = c.name;
            charSelect.appendChild(opt);
        });

        if (data.characters.length > 0) {
            charSelect.value = data.characters[0].id;
            loadCharacter(data.characters[0].id);
        }
    }

    // ── Load a character ─────────────────────────────────────
    async function loadCharacter(id) {
        // Save any unsaved work on the current character before switching
        if (isDirty && activeCharId) {
            clearTimeout(saveTimer);
            await save();
        } else {
            clearTimeout(saveTimer);
        }
        isDirty = false;

        // Race-condition guard: each call gets a unique ticket.
        // If another loadCharacter starts while we await the API,
        // our response is stale and must be discarded.
        // This was the core bug: the initial auto-load response arrived
        // AFTER a user-triggered switch and silently overwrote it.
        const myLoadId = ++loadingId;

        activeCharId = id;
        delCharBtn.classList.toggle('hidden', !id);

        if (!id) { sheetData = {}; clearAllDynamic(); populateFields(); return; }

        try {
            const res = await api({ action: 'load', id });

            if (myLoadId !== loadingId) return; // stale response — discard

            if (!res.success) {
                console.error('[HUD] loadCharacter: API returned failure for id', id, res);
                setStatus('error');
                return;
            }

            // Parse raw JSON string from server — avoids the PHP [] decode bug.
            // Never use res.data directly: json_decode('{}', true) in PHP returns
            // a PHP array which json_encode turns into '[]', making sheetData an
            // Array in JS, causing JSON.stringify to silently drop all named properties.
            let parsed;
            try {
                parsed = JSON.parse(res.raw || '{}');
            } catch (e) {
                parsed = {};
            }
            // Final safety net: if somehow an array arrived, reset to object
            if (Array.isArray(parsed)) parsed = {};
            sheetData = parsed;
            ARRAY_KEYS.forEach(k => { if (!Array.isArray(sheetData[k])) sheetData[k] = []; });
            seedSrDefaults();

            populateFields();
            renderAllDynamic();
        } catch (err) {
            if (myLoadId !== loadingId) return;
            console.error('[HUD] loadCharacter: unexpected error for id', id, err);
            setStatus('error');
        }
    }

    // ═══════════════════════════════════════════════════════
    // DYNAMIC LIST RENDERERS
    // ═══════════════════════════════════════════════════════

    // ── Generic remove ───────────────────────────────────────
    function removeFromArray(key, idx) {
        sheetData[key].splice(idx, 1);
        markDirty();
        renderAllDynamic();
    }

    function clearAllDynamic() {
        ['invGrid', 'activeSkillsList', 'passiveSkillsList', 'partyList', 'petList',
            'activeQuestList', 'completedQuestList', 'spellList', 'achGrid', 'areaList', 'statusTags',
            'bedroomList', 'trainingList', 'craftingList', 'fanFeed']
            .forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    }

    function renderAllDynamic() {
        renderInventory();
        renderSkills('active');
        renderSkills('passive');
        renderParty();
        renderPets();
        renderQuests('active');
        renderQuests('completed');
        renderSpells();
        renderAchievements();
        renderAreas();
        renderStatusTags();
        renderSrUpgrades('bedroom');
        renderSrUpgrades('training');
        renderCraftingTables();
        renderFanFeed();
    }

    // ── Inventory ────────────────────────────────────────────
    function addItem() {
        const name = document.getElementById('invItemName').value.trim();
        const qty = parseInt(document.getElementById('invItemQty').value) || 1;
        const rarity = document.getElementById('invItemRarity').value;
        const desc = document.getElementById('invItemDesc').value.trim();
        if (!name) return;

        sheetData.inventory = sheetData.inventory || [];
        sheetData.inventory.push({ name, qty, rarity, desc });
        document.getElementById('invItemName').value = '';
        document.getElementById('invItemDesc').value = '';
        document.getElementById('invItemQty').value = '1';
        markDirty();
        renderInventory();
    }

    function renderInventory() {
        const grid = document.getElementById('invGrid');
        grid.innerHTML = '';
        (sheetData.inventory || []).forEach((item, i) => {
            const el = document.createElement('div');
            el.className = `inv-item rarity-${item.rarity}`;
            el.innerHTML = `
                <div class="inv-item-name">${esc(item.name)}</div>
                ${item.desc ? `<div class="inv-item-desc">${esc(item.desc)}</div>` : ''}
                <div class="inv-item-footer">
                    <span class="rarity-label ${item.rarity}">${item.rarity.toUpperCase()}</span>
                    <span class="inv-item-qty">×${item.qty}</span>
                    <button class="remove-btn" onclick="HUD.removeFromArray('inventory', ${i})">✕</button>
                </div>`;
            grid.appendChild(el);
        });
    }

    // ── Skills ───────────────────────────────────────────────
    function addSkill(type) {
        const nameId = type === 'active' ? 'activeSkillName' : 'passiveSkillName';
        const descId = type === 'active' ? 'activeSkillDesc' : 'passiveSkillDesc';
        const costId = type === 'active' ? 'activeSkillCost' : null;
        const levelId = type === 'active' ? 'activeSkillLevel' : 'passiveSkillLevel';
        const name = document.getElementById(nameId).value.trim();
        const desc = document.getElementById(descId).value.trim();
        const cost = costId ? document.getElementById(costId)?.value.trim() : '';
        const level = parseInt(document.getElementById(levelId)?.value) || 1;
        if (!name) return;

        const key = type === 'active' ? 'activeSkills' : 'passiveSkills';
        sheetData[key] = sheetData[key] || [];
        sheetData[key].push({ name, desc, cost, level });
        document.getElementById(nameId).value = '';
        document.getElementById(descId).value = '';
        if (costId) document.getElementById(costId).value = '';
        if (levelId) document.getElementById(levelId).value = '1';
        markDirty();
        renderSkills(type);
    }

    function renderSkills(type) {
        const key = type === 'active' ? 'activeSkills' : 'passiveSkills';
        const listId = type === 'active' ? 'activeSkillsList' : 'passiveSkillsList';
        const list = document.getElementById(listId);
        list.innerHTML = '';
        (sheetData[key] || []).forEach((s, i) => {
            const lvl = s.level || 1;
            const el = document.createElement('div');
            el.className = 'skill-item';
            el.innerHTML = `
                <div class="skill-level-block">
                    <button class="skill-lvl-btn" onclick="HUD.bumpSkillLevel('${key}', ${i}, -1)" title="Level down">−</button>
                    <span class="skill-lvl-badge" title="Skill level — increases through use">LV${lvl}</span>
                    <button class="skill-lvl-btn" onclick="HUD.bumpSkillLevel('${key}', ${i}, 1)" title="Level up">＋</button>
                </div>
                <div class="skill-info">
                    <div class="skill-name">${esc(s.name)}</div>
                    ${s.desc ? `<div class="skill-desc">${esc(s.desc)}</div>` : ''}
                    ${s.cost ? `<div class="skill-cost">Cost: ${esc(s.cost)}</div>` : ''}
                </div>
                <button class="remove-btn" onclick="HUD.removeFromArray('${key}', ${i})">✕</button>`;
            list.appendChild(el);
        });
    }

    function bumpSkillLevel(key, idx, delta) {
        const skill = sheetData[key]?.[idx];
        if (!skill) return;
        skill.level = Math.max(1, (skill.level || 1) + delta);
        markDirty();
        renderSkills(key === 'activeSkills' ? 'active' : 'passive');
    }

    // ── Party ────────────────────────────────────────────────
    function addPartyMember() {
        const name = document.getElementById('partyMemberName').value.trim();
        const cls = document.getElementById('partyMemberClass').value.trim();
        const hp = document.getElementById('partyMemberHp').value;
        const level = document.getElementById('partyMemberLevel').value;
        const status = document.getElementById('partyMemberStatus').value.trim();
        if (!name) return;

        sheetData.party = sheetData.party || [];
        sheetData.party.push({ name, cls, hp, level, status });
        ['partyMemberName', 'partyMemberClass', 'partyMemberHp', 'partyMemberLevel', 'partyMemberStatus']
            .forEach(id => document.getElementById(id).value = '');
        markDirty();
        renderParty();
    }

    function renderParty() {
        const list = document.getElementById('partyList');
        list.innerHTML = '';
        (sheetData.party || []).forEach((m, i) => {
            const el = document.createElement('div');
            el.className = 'party-member';
            el.innerHTML = `
                <span class="party-member-name">${esc(m.name)}</span>
                <span class="party-member-meta">${esc(m.cls)} ${m.level ? `Lv.${m.level}` : ''}</span>
                <span class="party-member-hp">${m.hp ? `HP: ${m.hp}` : ''}</span>
                <span class="party-member-status">${esc(m.status)}</span>
                <button class="remove-btn" onclick="HUD.removeFromArray('party', ${i})">✕</button>`;
            list.appendChild(el);
        });
    }

    // ── Pets ─────────────────────────────────────────────────
    function addPet() {
        const name = document.getElementById('petName').value.trim();
        const type = document.getElementById('petType').value.trim();
        if (!name) return;
        sheetData.pets = sheetData.pets || [];
        sheetData.pets.push({ name, type });
        document.getElementById('petName').value = '';
        document.getElementById('petType').value = '';
        markDirty();
        renderPets();
    }

    function renderPets() {
        const list = document.getElementById('petList');
        list.innerHTML = '';
        (sheetData.pets || []).forEach((p, i) => {
            const el = document.createElement('div');
            el.className = 'pet-card';
            el.innerHTML = `
                <span style="flex:1;color:var(--clr-glow)">${esc(p.name)}</span>
                <span style="color:var(--clr-text-dim);font-size:.72rem">${esc(p.type)}</span>
                <button class="remove-btn" onclick="HUD.removeFromArray('pets', ${i})">✕</button>`;
            list.appendChild(el);
        });
    }

    // ── Quests ───────────────────────────────────────────────
    function addQuest(status) {
        const name = document.getElementById('questName').value.trim();
        const desc = document.getElementById('questDesc').value.trim();
        const priority = document.getElementById('questPriority').value;
        if (!name) return;

        const key = status === 'active' ? 'activeQuests' : 'completedQuests';
        sheetData[key] = sheetData[key] || [];
        sheetData[key].push({ name, desc, priority });
        document.getElementById('questName').value = '';
        document.getElementById('questDesc').value = '';
        markDirty();
        renderQuests('active');
        renderQuests('completed');
    }

    function completeQuest(idx) {
        const q = (sheetData.activeQuests || []).splice(idx, 1)[0];
        if (!q) return;
        sheetData.completedQuests = sheetData.completedQuests || [];
        sheetData.completedQuests.unshift(q);
        markDirty();
        renderQuests('active');
        renderQuests('completed');
    }

    function renderQuests(status) {
        const key = status === 'active' ? 'activeQuests' : 'completedQuests';
        const listId = status === 'active' ? 'activeQuestList' : 'completedQuestList';
        const list = document.getElementById(listId);
        list.innerHTML = '';

        (sheetData[key] || []).forEach((q, i) => {
            const el = document.createElement('div');
            el.className = 'quest-item';
            const completeBtn = status === 'active'
                ? `<button class="quest-complete-btn" onclick="HUD.completeQuest(${i})">COMPLETE</button>`
                : '';
            el.innerHTML = `
                <div class="quest-info">
                    <div class="quest-name">${esc(q.name)}</div>
                    ${q.desc ? `<div class="quest-desc">${esc(q.desc)}</div>` : ''}
                    <div class="quest-priority ${q.priority}">${q.priority.toUpperCase()}</div>
                </div>
                ${completeBtn}
                <button class="remove-btn" onclick="HUD.removeFromArray('${key}', ${i})">✕</button>`;
            list.appendChild(el);
        });
    }

    // ── Spells ───────────────────────────────────────────────
    function addSpell() {
        const name = document.getElementById('spellName').value.trim();
        const desc = document.getElementById('spellDesc').value.trim();
        const cost = document.getElementById('spellCost').value.trim();
        const school = document.getElementById('spellSchool').value;
        const level = parseInt(document.getElementById('spellLevel')?.value) || 1;
        if (!name) return;
        sheetData.spells = sheetData.spells || [];
        sheetData.spells.push({ name, desc, cost, school, level });
        document.getElementById('spellName').value = '';
        document.getElementById('spellDesc').value = '';
        document.getElementById('spellCost').value = '';
        if (document.getElementById('spellLevel')) document.getElementById('spellLevel').value = '1';
        markDirty();
        renderSpells();
    }

    function renderSpells() {
        const list = document.getElementById('spellList');
        list.innerHTML = '';
        (sheetData.spells || []).forEach((s, i) => {
            const lvl = s.level || 1;
            const el = document.createElement('div');
            el.className = 'skill-item';
            el.innerHTML = `
                <div class="skill-level-block">
                    <button class="skill-lvl-btn" onclick="HUD.bumpSpellLevel(${i}, -1)" title="Level down">−</button>
                    <span class="skill-lvl-badge spell-lvl" title="Spell level — increases through repeated casting">LV${lvl}</span>
                    <button class="skill-lvl-btn" onclick="HUD.bumpSpellLevel(${i}, 1)" title="Level up">＋</button>
                </div>
                <div class="skill-info">
                    <div class="skill-name">${esc(s.name)} <small style="color:var(--clr-label);font-size:.65rem">[${s.school}]</small></div>
                    ${s.desc ? `<div class="skill-desc">${esc(s.desc)}</div>` : ''}
                    ${s.cost ? `<div class="skill-cost">Mana: ${esc(s.cost)}</div>` : ''}
                </div>
                <button class="remove-btn" onclick="HUD.removeFromArray('spells', ${i})">✕</button>`;
            list.appendChild(el);
        });
    }

    function bumpSpellLevel(idx, delta) {
        const spell = sheetData.spells?.[idx];
        if (!spell) return;
        spell.level = Math.max(1, (spell.level || 1) + delta);
        markDirty();
        renderSpells();
    }

    // ── Achievements ─────────────────────────────────────────
    function addAchievement() {
        const name = document.getElementById('achName').value.trim();
        const desc = document.getElementById('achDesc').value.trim();
        const rarity = document.getElementById('achRarity').value;
        if (!name) return;
        sheetData.achievements = sheetData.achievements || [];
        sheetData.achievements.push({ name, desc, rarity });
        document.getElementById('achName').value = '';
        document.getElementById('achDesc').value = '';
        markDirty();
        renderAchievements();
    }

    function renderAchievements() {
        const grid = document.getElementById('achGrid');
        grid.innerHTML = '';
        (sheetData.achievements || []).forEach((a, i) => {
            const el = document.createElement('div');
            el.className = 'ach-item';
            el.innerHTML = `
                <div class="ach-name">${esc(a.name)}</div>
                ${a.desc ? `<div class="ach-desc">${esc(a.desc)}</div>` : ''}
                <div class="ach-rarity ${a.rarity}">${a.rarity.toUpperCase()}</div>
                <button class="remove-btn" style="position:absolute;bottom:.4rem;right:.4rem" onclick="HUD.removeFromArray('achievements', ${i})">✕</button>`;
            grid.appendChild(el);
        });
    }

    // ── Areas ────────────────────────────────────────────────
    function addArea() {
        const name = document.getElementById('areaName').value.trim();
        const status = document.getElementById('areaStatus').value.trim();
        if (!name) return;
        sheetData.areas = sheetData.areas || [];
        sheetData.areas.push({ name, status });
        document.getElementById('areaName').value = '';
        document.getElementById('areaStatus').value = '';
        markDirty();
        renderAreas();
    }

    function renderAreas() {
        const list = document.getElementById('areaList');
        list.innerHTML = '';
        (sheetData.areas || []).forEach((a, i) => {
            const el = document.createElement('div');
            el.className = 'area-item';
            el.innerHTML = `
                <span class="area-name">${esc(a.name)}</span>
                <span class="area-status">${esc(a.status)}</span>
                <button class="remove-btn" onclick="HUD.removeFromArray('areas', ${i})">✕</button>`;
            list.appendChild(el);
        });
    }

    // ── Status Tags ──────────────────────────────────────────
    function addTag(key, inputId, containerId) {
        const val = document.getElementById(inputId).value.trim();
        if (!val) return;
        sheetData[key] = sheetData[key] || [];
        sheetData[key].push(val);
        document.getElementById(inputId).value = '';
        markDirty();
        renderStatusTags();
    }

    function renderStatusTags() {
        const container = document.getElementById('statusTags');
        container.innerHTML = '';
        (sheetData.statusTags || []).forEach((tag, i) => {
            const el = document.createElement('div');
            el.className = 'status-tag';
            el.innerHTML = `${esc(tag)} <span class="tag-remove" onclick="HUD.removeFromArray('statusTags', ${i})">✕</span>`;
            container.appendChild(el);
        });
    }

    // ── New Character Modal ───────────────────────────────────
    function openNewCharModal() {
        newCharMsg.textContent = '';
        newCharInput.value = '';
        newCharModal.classList.remove('hidden');
        setTimeout(() => newCharInput.focus(), 50);
    }

    function closeNewCharModal() {
        newCharModal.classList.add('hidden');
    }

    async function createCharacter() {
        const name = newCharInput.value.trim();
        if (!name) { newCharMsg.textContent = 'Enter a name.'; return; }
        const data = await api({ action: 'create', name });
        if (!data.success) { newCharMsg.textContent = data.message || 'Error.'; return; }

        closeNewCharModal();
        await loadCharList();
        charSelect.value = data.id;
        loadCharacter(data.id);
    }

    // ── Delete Character Modal ────────────────────────────────
    function openDelCharModal() {
        if (!activeCharId) return;
        delMsg.textContent = '';
        delConfirm.value = '';
        delConfirmBtn.disabled = true;
        delCharModal.classList.remove('hidden');
        setTimeout(() => delConfirm.focus(), 50);
    }

    function closeDelCharModal() {
        delCharModal.classList.add('hidden');
    }

    async function confirmDelete() {
        const selected = charSelect.options[charSelect.selectedIndex];
        if (delConfirm.value !== selected?.text) {
            delMsg.textContent = 'Name does not match.';
            return;
        }
        const data = await api({ action: 'delete', id: activeCharId });
        if (!data.success) { delMsg.textContent = data.message || 'Error.'; return; }

        closeDelCharModal();
        activeCharId = null;
        sheetData = {};
        clearAllDynamic();
        populateFields();
        await loadCharList();
    }

    // ═══════════════════════════════════════════════════════
    // SAFE ROOM — Bedroom & Training upgrades
    // ═══════════════════════════════════════════════════════

    // Seed default upgrades if the array is empty on first load
    const SR_BEDROOM_DEFAULTS = [
        { owned: false, name: 'Basic Cot', bonus: 'No bonus', cost: '' },
        { owned: false, name: 'Standard Bed', bonus: '+5 HP restored each rest', cost: '200' },
        { owned: false, name: 'Upgraded Mattress', bonus: '+10 HP restored each rest', cost: '500' },
        { owned: false, name: 'Luxury Bed Suite', bonus: '+20 HP + full Morale reset each rest', cost: '2000' },
        { owned: false, name: 'Ambient Lighting', bonus: '+5 Morale on rest', cost: '300' },
        { owned: false, name: 'Decor Package', bonus: '+10 Morale on rest', cost: '800' },
        { owned: false, name: 'Soundproofing', bonus: 'Immunity to ambush during rest', cost: '1200' },
        { owned: false, name: 'Personal Armory', bonus: 'Store 10 extra weapon slots', cost: '1500' },
    ];

    const SR_TRAINING_DEFAULTS = [
        { owned: false, name: 'Combat Dummy', bonus: '+1 Strength per session', cost: '500' },
        { owned: false, name: 'Agility Course', bonus: '+1 Agility per session', cost: '500' },
        { owned: false, name: 'Meditation Chamber', bonus: '+1 Intelligence / Mana cap', cost: '700' },
        { owned: false, name: 'Resistance Training Rig', bonus: '+1 Constitution per session', cost: '600' },
        { owned: false, name: 'Shooting Range', bonus: '+1 ranged accuracy', cost: '800' },
        { owned: false, name: 'Magic Practice Arena', bonus: '+5 Spell Power per session', cost: '1000' },
        { owned: false, name: 'Sparring Ring', bonus: '+2 Initiative', cost: '900' },
        { owned: false, name: 'Endurance Track', bonus: '+10 Momentum cap', cost: '750' },
    ];

    const SR_CRAFTING_DEFAULTS = [
        { owned: false, name: "Blacksmith's Forge", cost: '1000', log: [] },
        { owned: false, name: "Alchemist's Lab", cost: '1200', log: [] },
        { owned: false, name: "Enchanting Table", cost: '1500', log: [] },
        { owned: false, name: "Demolition Workshop", cost: '800', log: [] },
        { owned: false, name: "Leatherworking Station", cost: '600', log: [] },
        { owned: false, name: "Jeweler's Bench", cost: '900', log: [] },
        { owned: false, name: "Rune Carving Table", cost: '1300', log: [] },
        { owned: false, name: "Tinker's Workshop", cost: '700', log: [] },
        { owned: false, name: "Toxicology Station", cost: '1100', log: [] },
        { owned: false, name: "Cooking Station", cost: '400', log: [] },
        { owned: false, name: "Scroll Scriptorium", cost: '1000', log: [] },
        { owned: false, name: "Explosive Lab", cost: '1400', log: [] },
    ];

    function seedSrDefaults() {
        if (!sheetData.srBedroom?.length) sheetData.srBedroom = SR_BEDROOM_DEFAULTS.map(x => ({ ...x }));
        if (!sheetData.srTraining?.length) sheetData.srTraining = SR_TRAINING_DEFAULTS.map(x => ({ ...x }));
        if (!sheetData.srCrafting?.length) sheetData.srCrafting = SR_CRAFTING_DEFAULTS.map(x => ({ ...x, log: [] }));
    }

    // Add custom upgrade (bedroom or training)
    function addSrUpgrade(type) {
        const nameId = type === 'bedroom' ? 'bedName' : 'trainName';
        const bonusId = type === 'bedroom' ? 'bedBonus' : 'trainBonus';
        const costId = type === 'bedroom' ? 'bedCost' : 'trainCost';
        const key = type === 'bedroom' ? 'srBedroom' : 'srTraining';

        const name = document.getElementById(nameId)?.value.trim();
        const bonus = document.getElementById(bonusId)?.value.trim();
        const cost = document.getElementById(costId)?.value.trim();
        if (!name) return;

        sheetData[key].push({ owned: false, name, bonus, cost });
        document.getElementById(nameId).value = '';
        document.getElementById(bonusId).value = '';
        document.getElementById(costId).value = '';
        markDirty();
        renderSrUpgrades(type);
    }

    function toggleSrOwned(key, idx) {
        sheetData[key][idx].owned = !sheetData[key][idx].owned;
        markDirty();
        renderSrUpgrades(key === 'srBedroom' ? 'bedroom' : 'training');
    }

    function renderSrUpgrades(type) {
        const key = type === 'bedroom' ? 'srBedroom' : 'srTraining';
        const listEl = document.getElementById(type === 'bedroom' ? 'bedroomList' : 'trainingList');
        if (!listEl) return;
        listEl.innerHTML = '';

        (sheetData[key] || []).forEach((item, i) => {
            const el = document.createElement('div');
            el.className = 'sr-upgrade-row' + (item.owned ? ' owned' : '');
            el.innerHTML = `
                <label class="sr-owned-check" title="Mark as owned">
                    <input type="checkbox" ${item.owned ? 'checked' : ''}
                           onchange="HUD.toggleSrOwned('${key}', ${i})" />
                    <span class="sr-check-box"></span>
                </label>
                <div class="sr-upgrade-info">
                    <span class="sr-upgrade-name">${esc(item.name)}</span>
                    ${item.bonus ? `<span class="sr-upgrade-bonus">▸ ${esc(item.bonus)}</span>` : ''}
                </div>
                <span class="sr-upgrade-cost">${item.cost ? `⬡ ${esc(item.cost)}g` : ''}</span>
                <button class="remove-btn" onclick="HUD.removeFromArray('${key}', ${i})">✕</button>`;
            listEl.appendChild(el);
        });
    }

    // ═══════════════════════════════════════════════════════
    // SAFE ROOM — Crafting tables
    // ═══════════════════════════════════════════════════════

    function addCraftingTable() {
        const name = document.getElementById('craftName')?.value.trim();
        const cost = document.getElementById('craftCost')?.value.trim();
        if (!name) return;
        sheetData.srCrafting.push({ owned: false, name, cost, log: [] });
        document.getElementById('craftName').value = '';
        document.getElementById('craftCost').value = '';
        markDirty();
        renderCraftingTables();
    }

    function toggleCraftOwned(idx) {
        sheetData.srCrafting[idx].owned = !sheetData.srCrafting[idx].owned;
        markDirty();
        renderCraftingTables();
    }

    function addCraftLogEntry(idx) {
        const input = document.getElementById(`craftLogInput-${idx}`);
        const val = input?.value.trim();
        if (!val) return;
        sheetData.srCrafting[idx].log = sheetData.srCrafting[idx].log || [];
        sheetData.srCrafting[idx].log.push({ item: val, date: new Date().toLocaleDateString() });
        input.value = '';
        markDirty();
        renderCraftingTables();
    }

    function removeCraftLogEntry(tableIdx, logIdx) {
        sheetData.srCrafting[tableIdx].log.splice(logIdx, 1);
        markDirty();
        renderCraftingTables();
    }

    function renderCraftingTables() {
        const listEl = document.getElementById('craftingList');
        if (!listEl) return;
        listEl.innerHTML = '';

        (sheetData.srCrafting || []).forEach((table, i) => {
            const el = document.createElement('div');
            el.className = 'craft-table-block' + (table.owned ? ' owned' : '');

            const logItems = (table.log || []).map((entry, li) => `
                <div class="craft-log-entry">
                    <span class="craft-log-item">${esc(entry.item)}</span>
                    <span class="craft-log-date">${esc(entry.date)}</span>
                    <button class="remove-btn" onclick="HUD.removeCraftLogEntry(${i}, ${li})">✕</button>
                </div>`).join('');

            el.innerHTML = `
                <div class="craft-table-header">
                    <label class="sr-owned-check" title="Mark as owned">
                        <input type="checkbox" ${table.owned ? 'checked' : ''}
                               onchange="HUD.toggleCraftOwned(${i})" />
                        <span class="sr-check-box"></span>
                    </label>
                    <span class="craft-table-name">${esc(table.name)}</span>
                    <span class="sr-upgrade-cost">${table.cost ? `⬡ ${esc(table.cost)}g` : ''}</span>
                    <button class="craft-expand-btn" onclick="this.closest('.craft-table-block').classList.toggle('expanded')">
                        CRAFTED ▾
                    </button>
                    <button class="remove-btn" onclick="HUD.removeFromArray('srCrafting', ${i})">✕</button>
                </div>
                <div class="craft-log-wrap">
                    <div class="craft-log-add">
                        <input class="hud-input sm" type="text" id="craftLogInput-${i}" placeholder="Item crafted…" style="flex:1" />
                        <button class="hud-btn-sm" onclick="HUD.addCraftLogEntry(${i})">LOG</button>
                    </div>
                    <div class="craft-log-list">
                        ${logItems || '<div class="craft-log-empty">Nothing crafted yet.</div>'}
                    </div>
                </div>`;
            listEl.appendChild(el);
        });
    }

    // ═══════════════════════════════════════════════════════
    // SAFE ROOM — Fan Feed
    // ═══════════════════════════════════════════════════════

    const FAN_TYPE_ICONS = {
        fan: '💬', donation: '💰', threat: '⚠', sponsor: '⬡', hater: '👁'
    };

    function addFanEntry() {
        const name = document.getElementById('fanName')?.value.trim();
        const msg = document.getElementById('fanMsg')?.value.trim();
        const type = document.getElementById('fanType')?.value || 'fan';
        if (!msg) return;

        sheetData.fanFeed = sheetData.fanFeed || [];
        sheetData.fanFeed.unshift({
            name: name || 'Anonymous',
            msg,
            type,
            date: new Date().toLocaleString(),
        });
        document.getElementById('fanName').value = '';
        document.getElementById('fanMsg').value = '';
        markDirty();
        renderFanFeed();
    }

    function renderFanFeed() {
        const feed = document.getElementById('fanFeed');
        if (!feed) return;
        feed.innerHTML = '';

        if (!(sheetData.fanFeed || []).length) {
            feed.innerHTML = '<div class="fan-empty">No fan interactions logged yet.</div>';
            return;
        }

        sheetData.fanFeed.forEach((entry, i) => {
            const el = document.createElement('div');
            el.className = `fan-entry fan-type-${entry.type}`;
            el.innerHTML = `
                <span class="fan-icon">${FAN_TYPE_ICONS[entry.type] || '💬'}</span>
                <div class="fan-body">
                    <span class="fan-name">${esc(entry.name)}</span>
                    <span class="fan-msg">${esc(entry.msg)}</span>
                    <span class="fan-date">${esc(entry.date)}</span>
                </div>
                <button class="remove-btn" onclick="HUD.removeFromArray('fanFeed', ${i})">✕</button>`;
            feed.appendChild(el);
        });
    }

    // ── Utility ──────────────────────────────────────────────
    function esc(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ── Init ─────────────────────────────────────────────────
    function init() {
        initTabs();
        bindFields();

        // Character switcher — async so errors surface and aren't silently swallowed
        charSelect.addEventListener('change', async () => {
            await loadCharacter(charSelect.value);
        });
        newCharBtn.addEventListener('click', openNewCharModal);
        delCharBtn.addEventListener('click', openDelCharModal);
        saveBtn.addEventListener('click', save);

        // Delete confirm enable
        delConfirm.addEventListener('input', () => {
            const selected = charSelect.options[charSelect.selectedIndex];
            delConfirmBtn.disabled = delConfirm.value !== selected?.text;
        });

        // Modal enter key
        newCharInput.addEventListener('keydown', e => { if (e.key === 'Enter') createCharacter(); });

        // Close modals on backdrop click
        newCharModal.addEventListener('click', e => { if (e.target === newCharModal) closeNewCharModal(); });
        delCharModal.addEventListener('click', e => { if (e.target === delCharModal) closeDelCharModal(); });

        // Ctrl+S save
        document.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
        });

        loadCharList();
    }

    // Public API
    return {
        init, save, loadCharacter,
        addItem, addSkill, addPartyMember, addPet, addQuest, completeQuest,
        addSpell, addAchievement, addArea, addTag,
        removeFromArray,
        bumpSkillLevel, bumpSpellLevel,
        addSrUpgrade, toggleSrOwned,
        addCraftingTable, toggleCraftOwned, addCraftLogEntry, removeCraftLogEntry,
        addFanEntry,
        openNewCharModal, closeNewCharModal, createCharacter,
        openDelCharModal, closeDelCharModal, confirmDelete,
    };
})();

document.addEventListener('DOMContentLoaded', () => HUD.init());