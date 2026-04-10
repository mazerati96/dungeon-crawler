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

    // Dynamic arrays stored in sheetData
    const ARRAY_KEYS = ['inventory', 'activeSkills', 'passiveSkills', 'party', 'pets',
        'activeQuests', 'completedQuests', 'spells', 'achievements', 'areas', 'statusTags'];
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
    function collectFields() {
        document.querySelectorAll('[data-field]').forEach(el => {
            const k = el.dataset.field;
            if (el.type === 'checkbox') {
                sheetData[k] = el.checked;
            } else {
                sheetData[k] = el.value;
            }
        });
    }

    // ── Write sheetData back into inputs ─────────────────────
    function populateFields() {
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
        activeCharId = id;
        delCharBtn.classList.toggle('hidden', !id);

        if (!id) { sheetData = {}; clearAllDynamic(); populateFields(); return; }

        const res = await api({ action: 'load', id });
        if (!res.success) return;

        sheetData = res.data || {};
        ARRAY_KEYS.forEach(k => { if (!Array.isArray(sheetData[k])) sheetData[k] = []; });

        populateFields();
        renderAllDynamic();
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
            'activeQuestList', 'completedQuestList', 'spellList', 'achGrid', 'areaList', 'statusTags']
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
        const name = document.getElementById(nameId).value.trim();
        const desc = document.getElementById(descId).value.trim();
        const cost = costId ? document.getElementById(costId)?.value.trim() : '';
        if (!name) return;

        const key = type === 'active' ? 'activeSkills' : 'passiveSkills';
        sheetData[key] = sheetData[key] || [];
        sheetData[key].push({ name, desc, cost });
        document.getElementById(nameId).value = '';
        document.getElementById(descId).value = '';
        if (costId) document.getElementById(costId).value = '';
        markDirty();
        renderSkills(type);
    }

    function renderSkills(type) {
        const key = type === 'active' ? 'activeSkills' : 'passiveSkills';
        const listId = type === 'active' ? 'activeSkillsList' : 'passiveSkillsList';
        const list = document.getElementById(listId);
        list.innerHTML = '';
        (sheetData[key] || []).forEach((s, i) => {
            const el = document.createElement('div');
            el.className = 'skill-item';
            el.innerHTML = `
                <div class="skill-info">
                    <div class="skill-name">${esc(s.name)}</div>
                    ${s.desc ? `<div class="skill-desc">${esc(s.desc)}</div>` : ''}
                    ${s.cost ? `<div class="skill-cost">Cost: ${esc(s.cost)}</div>` : ''}
                </div>
                <button class="remove-btn" onclick="HUD.removeFromArray('${key}', ${i})">✕</button>`;
            list.appendChild(el);
        });
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
        if (!name) return;
        sheetData.spells = sheetData.spells || [];
        sheetData.spells.push({ name, desc, cost, school });
        document.getElementById('spellName').value = '';
        document.getElementById('spellDesc').value = '';
        document.getElementById('spellCost').value = '';
        markDirty();
        renderSpells();
    }

    function renderSpells() {
        const list = document.getElementById('spellList');
        list.innerHTML = '';
        (sheetData.spells || []).forEach((s, i) => {
            const el = document.createElement('div');
            el.className = 'skill-item';
            el.innerHTML = `
                <div class="skill-info">
                    <div class="skill-name">${esc(s.name)} <small style="color:var(--clr-label);font-size:.65rem">[${s.school}]</small></div>
                    ${s.desc ? `<div class="skill-desc">${esc(s.desc)}</div>` : ''}
                    ${s.cost ? `<div class="skill-cost">Mana: ${esc(s.cost)}</div>` : ''}
                </div>
                <button class="remove-btn" onclick="HUD.removeFromArray('spells', ${i})">✕</button>`;
            list.appendChild(el);
        });
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

        // Character switcher
        charSelect.addEventListener('change', () => loadCharacter(charSelect.value));
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
        openNewCharModal, closeNewCharModal, createCharacter,
        openDelCharModal, closeDelCharModal, confirmDelete,
    };
})();

document.addEventListener('DOMContentLoaded', () => HUD.init());