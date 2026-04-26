<?php
// ============================================================
//  dashboard.php  —  The Crawler Interface (main HUD)
// ============================================================
session_start();
if (empty($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}
$username = htmlspecialchars($_SESSION['username']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dungeon Crawler — Interface</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="css/hud.css" />
</head>
<body>
    <canvas id="particles-canvas"></canvas>

    <!-- ── Top Bar ─────────────────────────────────────────── -->
    <header class="hud-topbar">
        <div class="topbar-left">
            <span class="topbar-logo">⬡ CRAWLER INTERFACE</span>
        </div>
        <div class="topbar-center">
            <select class="char-select" id="charSelect">
                <option value="">— SELECT CRAWLER —</option>
            </select>
            <button class="icon-btn" id="newCharBtn" title="New character">＋</button>
            <button class="icon-btn danger hidden" id="delCharBtn" title="Delete character">✕</button>
        </div>
        <div class="topbar-right">
            <span class="topbar-user">⬡ <?= $username ?></span>
            <button class="hud-btn-sm" id="saveBtn">SAVE</button>
            <a class="hud-btn-sm danger" href="logout.php">LOGOUT</a>
        </div>
    </header>

    <div class="save-status" id="saveStatus"></div>

    <!-- ── Tab Nav ─────────────────────────────────────────── -->
    <nav class="tab-nav" id="tabNav">
        <button class="tab-btn active" data-tab="stats">
            <span class="tab-icon">◈</span> STATS
        </button>
        <button class="tab-btn" data-tab="inventory">
            <span class="tab-icon">⊞</span> INVENTORY
        </button>
        <button class="tab-btn" data-tab="skills">
            <span class="tab-icon">◉</span> SKILLS
        </button>
        <button class="tab-btn" data-tab="party">
            <span class="tab-icon">◎</span> PARTY
        </button>
        <button class="tab-btn" data-tab="quests">
            <span class="tab-icon">◇</span> QUESTS
        </button>
        <button class="tab-btn" data-tab="magic">
            <span class="tab-icon">◈</span> MAGIC
        </button>
        <button class="tab-btn" data-tab="achievements">
            <span class="tab-icon">★</span> ACHIEVEMENTS
        </button>
        <button class="tab-btn" data-tab="map">
            <span class="tab-icon">⊕</span> MAP
        </button>
        <button class="tab-btn" data-tab="saferoom">
            <span class="tab-icon">⌂</span> SAFE ROOM
        </button>
        <button class="tab-btn" data-tab="factions">
            <span class="tab-icon">⚑</span> FACTIONS
        </button>
    </nav>

    <!-- ══════════════════════════════════════════════════════
         MAIN HUD CONTENT
    ══════════════════════════════════════════════════════════ -->
    <main class="hud-main" id="hudMain">

        <!-- ── TAB: STATS ───────────────────────────────────── -->
        <section class="tab-panel active" id="tab-stats">
            <div class="panel-grid">

                <!-- Identity -->
                <div class="hud-card span-2">
                    <div class="card-header">◈ CRAWLER IDENTITY</div>
                    <div class="identity-grid">
                        <div class="id-field">
                            <label>CRAWLER NAME</label>
                            <input class="hud-field" type="text" data-field="charName" placeholder="Carl Shithead" />
                        </div>
                        <div class="id-field">
                            <label>CLASS / TITLE</label>
                            <input class="hud-field" type="text" data-field="classTitle" placeholder="System AI assigns floor 3+" />
                        </div>
                        <div class="id-field">
                            <label>SPECIALIZATION</label>
                            <input class="hud-field" type="text" data-field="classSpec" placeholder="Unlocks at level 6, 9, 12…" />
                        </div>
                        <div class="id-field">
                            <label>STARTING RACE <span class="hint-label">(floors 1–2)</span></label>
                            <select class="hud-field" data-field="startingRace">
                                <option value="">— Choose —</option>
                                <option value="Human">Human</option>
                                <option value="Elf">Elf</option>
                                <option value="Dwarf">Dwarf</option>
                            </select>
                        </div>
                        <div class="id-field">
                            <label>EVOLVED RACE <span class="hint-label">(floor 3+, system AI)</span></label>
                            <input class="hud-field" type="text" data-field="evolvedRace" placeholder="Assigned at floor 3…" />
                        </div>
                        <div class="id-field">
                            <label>CURRENT FLOOR</label>
                            <input class="hud-field" type="number" data-field="floor" placeholder="1" min="1" />
                        </div>
                        <div class="id-field">
                            <label>LEVEL</label>
                            <input class="hud-field" type="number" data-field="level" placeholder="1" min="1" />
                        </div>
                        <div class="id-field">
                            <label>EXPERIENCE</label>
                            <input class="hud-field" type="number" data-field="xp" placeholder="0" min="0" />
                        </div>
                    </div>
                </div>

                <!-- HP / Mana / Stamina bars -->
                <div class="hud-card">
                    <div class="card-header">◈ VITALS</div>
                    <div class="vitals-list">
                        <div class="vital-row">
                            <span class="vital-name hp">HP</span>
                            <input class="hud-field num" type="number" data-field="hpCurrent" placeholder="100" />
                            <span class="vital-sep">/</span>
                            <input class="hud-field num" type="number" data-field="hpMax" placeholder="100" />
                            <span class="vital-hint">= CON</span>
                        </div>
                        <div class="vital-row">
                            <span class="vital-name mana">MANA</span>
                            <input class="hud-field num" type="number" data-field="manaCurrent" placeholder="50" />
                            <span class="vital-sep">/</span>
                            <input class="hud-field num" type="number" data-field="manaMax" placeholder="50" />
                            <span class="vital-hint">= INT</span>
                        </div>
                        <div class="vital-row">
                            <span class="vital-name momentum">MOMENTUM</span>
                            <input class="hud-field num" type="number" data-field="momentumCurrent" placeholder="0" />
                            <span class="vital-sep">/</span>
                            <input class="hud-field num" type="number" data-field="momentumMax" placeholder="10" />
                        </div>
                        <div class="vital-row">
                            <span class="vital-name morale">MORALE</span>
                            <input class="hud-field num" type="number" data-field="moraleCurrent" placeholder="100" />
                            <span class="vital-sep">/</span>
                            <input class="hud-field num" type="number" data-field="moraleMax" placeholder="100" />
                        </div>
                    </div>
                </div>

                <!-- Combat stats -->
                <div class="hud-card">
                    <div class="card-header">◈ COMBAT</div>
                    <div class="stat-grid">
                        <div class="stat-row">
                            <span class="stat-name">STRENGTH</span>
                            <input class="hud-field num" type="number" data-field="strength" placeholder="10" />
                        </div>
                        <div class="stat-row">
                            <span class="stat-name">AGILITY</span>
                            <input class="hud-field num" type="number" data-field="agility" placeholder="10" />
                        </div>
                        <div class="stat-row">
                            <span class="stat-name">INTELLIGENCE</span>
                            <input class="hud-field num" type="number" data-field="intelligence" placeholder="10" />
                        </div>
                        <div class="stat-row">
                            <span class="stat-name">CONSTITUTION</span>
                            <input class="hud-field num" type="number" data-field="constitution" placeholder="10" />
                        </div>
                        <div class="stat-row">
                            <span class="stat-name">CHARISMA</span>
                            <input class="hud-field num" type="number" data-field="charisma" placeholder="10" />
                        </div>
                        <div class="stat-row">
                            <span class="stat-name">LUCK</span>
                            <input class="hud-field num" type="number" data-field="luck" placeholder="10" />
                        </div>
                        <div class="stat-row">
                            <span class="stat-name">AC / DEFENSE</span>
                            <input class="hud-field num" type="number" data-field="defense" placeholder="10" />
                        </div>
                        <div class="stat-row">
                            <span class="stat-name">INITIATIVE</span>
                            <input class="hud-field num" type="number" data-field="initiative" placeholder="0" />
                        </div>
                        <div class="stat-row">
                            <span class="stat-name">SPEED</span>
                            <input class="hud-field num" type="number" data-field="speed" placeholder="30" />
                        </div>
                    </div>
                </div>

                <!-- Status Effects -->
                <div class="hud-card">
                    <div class="card-header">◈ STATUS EFFECTS</div>
                    <div class="status-tags" id="statusTags"></div>
                    <div class="add-row">
                        <input class="hud-input sm" type="text" id="statusInput" placeholder="Add status…" />
                        <button class="hud-btn-sm" onclick="HUD.addTag('status', 'statusInput', 'statusTags')">ADD</button>
                    </div>
                </div>

                <!-- Equipped gear -->
                <div class="hud-card span-2">
                    <div class="card-header">◈ EQUIPPED GEAR</div>
                    <div class="gear-grid">
                        <div class="gear-slot"><label>HEAD</label><input class="hud-field" type="text" data-field="gearHead" placeholder="—" /></div>
                        <div class="gear-slot"><label>CHEST</label><input class="hud-field" type="text" data-field="gearChest" placeholder="—" /></div>
                        <div class="gear-slot"><label>HANDS</label><input class="hud-field" type="text" data-field="gearHands" placeholder="—" /></div>
                        <div class="gear-slot"><label>LEGS</label><input class="hud-field" type="text" data-field="gearLegs" placeholder="—" /></div>
                        <div class="gear-slot"><label>FEET</label><input class="hud-field" type="text" data-field="gearFeet" placeholder="—" /></div>
                        <div class="gear-slot"><label>MAIN HAND</label><input class="hud-field" type="text" data-field="gearMainHand" placeholder="—" /></div>
                        <div class="gear-slot"><label>OFF HAND</label><input class="hud-field" type="text" data-field="gearOffHand" placeholder="—" /></div>
                        <div class="gear-slot"><label>ACCESSORY 1</label><input class="hud-field" type="text" data-field="gearAcc1" placeholder="—" /></div>
                        <div class="gear-slot"><label>ACCESSORY 2</label><input class="hud-field" type="text" data-field="gearAcc2" placeholder="—" /></div>
                        <div class="gear-slot"><label>TRINKET</label><input class="hud-field" type="text" data-field="gearTrinket" placeholder="—" /></div>
                    </div>
                </div>

                <!-- Ratings & Viewer count -->
                <div class="hud-card">
                    <div class="card-header">◈ FAME & RESOURCES</div>
                    <div class="stat-grid">
                        <div class="stat-row"><span class="stat-name">PATRON DEITY</span><input class="hud-field" type="text" data-field="deity" placeholder="None" /></div>
                        <div class="stat-row"><span class="stat-name">GUILD / FACTION</span><input class="hud-field" type="text" data-field="faction" placeholder="None" /></div>
                        <div class="stat-row"><span class="stat-name">GOLD / COINS</span><input class="hud-field num" type="number" data-field="gold" placeholder="0" /></div>
                    </div>
                    <div class="card-header" style="margin-top:1rem">◈ PERSONALITY</div>
                    <div class="stat-grid">
                        <div class="stat-row"><span class="stat-name">CATCH PHRASE</span><input class="hud-field" type="text" data-field="catchPhrase" placeholder="e.g. Let's go gambling!" /></div>
                        <div class="stat-row"><span class="stat-name">SIGNATURE MOVE</span><input class="hud-field" type="text" data-field="signatureMove" placeholder="e.g. 360 backflip spear throw" /></div>
                    </div>
                    <div class="fame-mirror-note">Fan stats (viewers, rating, fame tier) live in the <strong>SAFE ROOM → SOCIAL</strong> tab</div>
                </div>

                <!-- Notes -->
                <div class="hud-card span-3">
                    <div class="card-header">◈ NOTES / BACKSTORY</div>
                    <textarea class="hud-textarea" data-field="backstory" placeholder="Enter your crawler's backstory, notes, or anything else…" rows="5"></textarea>
                </div>

            </div>
        </section>

        <!-- ── TAB: INVENTORY ───────────────────────────────── -->
        <section class="tab-panel" id="tab-inventory">
            <div class="panel-grid">
                <div class="hud-card span-3">
                    <div class="card-header">⊞ INVENTORY — GRID</div>
                    <div class="inv-toolbar">
                        <input class="hud-input" type="text" id="invItemName" placeholder="Item name…" style="flex:1" />
                        <input class="hud-input sm" type="number" id="invItemQty" placeholder="Qty" min="1" value="1" style="width:70px" />
                        <select class="hud-input sm" id="invItemRarity">
                            <option value="common">Common</option>
                            <option value="uncommon">Uncommon</option>
                            <option value="rare">Rare</option>
                            <option value="epic">Epic</option>
                            <option value="legendary">Legendary</option>
                            <option value="celestial">Celestial</option>
                        </select>
                        <input class="hud-input" type="text" id="invItemDesc" placeholder="Description (optional)" style="flex:2" />
                        <button class="hud-btn-sm" onclick="HUD.addItem()">ADD ITEM</button>
                    </div>
                    <div class="inv-grid" id="invGrid"></div>
                </div>

                <!-- Loot Boxes -->
                <div class="hud-card">
                    <div class="card-header">⊞ LOOT BOXES <span style="color:var(--clr-text-dim);font-size:.52rem;font-family:var(--font-mono);font-weight:normal">⚠ Open in safe areas only</span></div>
                    <div class="loot-tiers">
                        <div class="loot-tier bronze"><span>BRONZE</span><input class="hud-field num" type="number" data-field="lootBronze" placeholder="0" min="0" /></div>
                        <div class="loot-tier silver"><span>SILVER</span><input class="hud-field num" type="number" data-field="lootSilver" placeholder="0" min="0" /></div>
                        <div class="loot-tier gold"><span>GOLD</span><input class="hud-field num" type="number" data-field="lootGold" placeholder="0" min="0" /></div>
                        <div class="loot-tier platinum"><span>PLATINUM</span><input class="hud-field num" type="number" data-field="lootPlatinum" placeholder="0" min="0" /></div>
                        <div class="loot-tier legendary"><span>LEGENDARY</span><input class="hud-field num" type="number" data-field="lootLegendary" placeholder="0" min="0" /></div>
                        <div class="loot-tier celestial"><span>CELESTIAL</span><input class="hud-field num" type="number" data-field="lootCelestial" placeholder="0" min="0" /></div>
                    </div>
                    <div class="card-header" style="margin-top:1rem">⊞ SPECIAL BOXES</div>
                    <div class="loot-tiers">
                        <div class="loot-tier fan-box"><span>🎁 FAN BOXES</span><input class="hud-field num" type="number" data-field="lootFan" placeholder="0" min="0" /></div>
                        <div class="loot-tier hater-box"><span>💀 HATER BOXES</span><input class="hud-field num" type="number" data-field="lootHater" placeholder="0" min="0" /></div>
                    </div>
                </div>
            </div>
        </section>

        <!-- ── TAB: SKILLS ──────────────────────────────────── -->
        <section class="tab-panel" id="tab-skills">
            <div class="panel-grid">
                <!-- Active Skills -->
                <div class="hud-card span-2">
                    <div class="card-header">◉ ACTIVE SKILLS</div>
                    <div class="skill-add-row">
                        <input class="hud-input" type="text" id="activeSkillName" placeholder="Skill name…" />
                        <input class="hud-input" type="text" id="activeSkillDesc" placeholder="Description…" style="flex:2" />
                        <input class="hud-input sm" type="text" id="activeSkillCost" placeholder="Cost" style="width:100px" />
                        <input class="hud-input sm" type="number" id="activeSkillLevel" placeholder="LVL" min="1" value="1" style="width:65px" title="Skill level — increases through use" />
                        <button class="hud-btn-sm" onclick="HUD.addSkill('active')">ADD</button>
                    </div>
                    <div class="skills-list" id="activeSkillsList"></div>
                </div>

                <!-- Passive Skills -->
                <div class="hud-card">
                    <div class="card-header">◉ PASSIVE SKILLS</div>
                    <div class="skill-add-row">
                        <input class="hud-input" type="text" id="passiveSkillName" placeholder="Skill name…" />
                        <input class="hud-input" type="text" id="passiveSkillDesc" placeholder="Description…" style="flex:2" />
                        <input class="hud-input sm" type="number" id="passiveSkillLevel" placeholder="LVL" min="1" value="1" style="width:65px" title="Skill level — increases through use" />
                        <button class="hud-btn-sm" onclick="HUD.addSkill('passive')">ADD</button>
                    </div>
                    <div class="skills-list" id="passiveSkillsList"></div>
                </div>

                <!-- Hotlist -->
                <div class="hud-card span-3">
                    <div class="card-header">◉ HOTLIST — QUICK ACCESS</div>
                    <div class="hotlist-grid" id="hotlistGrid">
                        <?php for ($i = 1; $i <= 10; $i++): ?>
                        <div class="hotlist-slot">
                            <div class="hotlist-num"><?= $i ?></div>
                            <input class="hud-field" type="text" data-field="hotlist<?= $i ?>" placeholder="Empty" />
                        </div>
                        <?php endfor; ?>
                    </div>
                </div>
            </div>
        </section>

        <!-- ── TAB: PARTY ───────────────────────────────────── -->
        <section class="tab-panel" id="tab-party">
            <div class="panel-grid">
                <div class="hud-card span-2">
                    <div class="card-header">◎ PARTY MEMBERS</div>
                    <div class="party-add-row">
                        <input class="hud-input" type="text" id="partyMemberName" placeholder="Member name…" />
                        <input class="hud-input sm" type="text" id="partyMemberClass" placeholder="Class…" style="width:140px" />
                        <input class="hud-input sm" type="number" id="partyMemberHp" placeholder="HP" style="width:80px" />
                        <input class="hud-input sm" type="number" id="partyMemberLevel" placeholder="LVL" style="width:80px" />
                        <input class="hud-input sm" type="text" id="partyMemberStatus" placeholder="Status…" style="width:140px" />
                        <button class="hud-btn-sm" onclick="HUD.addPartyMember()">ADD</button>
                    </div>
                    <div class="party-list" id="partyList"></div>
                </div>

                <!-- Pets & Familiars -->
                <div class="hud-card">
                    <div class="card-header">◎ PETS & FAMILIARS</div>
                    <div class="party-add-row">
                        <input class="hud-input" type="text" id="petName" placeholder="Pet name…" />
                        <input class="hud-input sm" type="text" id="petType" placeholder="Type…" style="width:120px" />
                        <button class="hud-btn-sm" onclick="HUD.addPet()">ADD</button>
                    </div>
                    <div class="pet-list" id="petList"></div>
                </div>
            </div>
        </section>

        <!-- ── TAB: QUESTS ──────────────────────────────────── -->
        <section class="tab-panel" id="tab-quests">
            <div class="panel-grid">
                <!-- Active Quests -->
                <div class="hud-card span-2">
                    <div class="card-header">◇ ACTIVE QUESTS</div>
                    <div class="quest-add-row">
                        <input class="hud-input" type="text" id="questName" placeholder="Quest name…" style="flex:1" />
                        <input class="hud-input" type="text" id="questDesc" placeholder="Objective…" style="flex:2" />
                        <select class="hud-input sm" id="questPriority" style="width:120px">
                            <option value="normal">Normal</option>
                            <option value="urgent">Urgent</option>
                            <option value="main">Main Story</option>
                        </select>
                        <button class="hud-btn-sm" onclick="HUD.addQuest('active')">ADD</button>
                    </div>
                    <div class="quest-list" id="activeQuestList"></div>
                </div>

                <!-- Completed Quests -->
                <div class="hud-card">
                    <div class="card-header">◇ COMPLETED QUESTS</div>
                    <div class="quest-list" id="completedQuestList"></div>
                </div>
            </div>
        </section>

        <!-- ── TAB: MAGIC ───────────────────────────────────── -->
        <section class="tab-panel" id="tab-magic">
            <div class="panel-grid">
                <div class="hud-card span-2">
                    <div class="card-header">◈ SPELLBOOK</div>
                    <div class="skill-add-row">
                        <input class="hud-input" type="text" id="spellName" placeholder="Spell name…" />
                        <input class="hud-input" type="text" id="spellDesc" placeholder="Effect…" style="flex:2" />
                        <input class="hud-input sm" type="text" id="spellCost" placeholder="Mana cost" style="width:110px" />
                        <select class="hud-input sm" id="spellSchool" style="width:130px">
                            <option value="arcane">Arcane</option>
                            <option value="fire">Fire</option>
                            <option value="ice">Ice</option>
                            <option value="lightning">Lightning</option>
                            <option value="shadow">Shadow</option>
                            <option value="holy">Holy</option>
                            <option value="nature">Nature</option>
                            <option value="void">Void</option>
                        </select>
                        <input class="hud-input sm" type="number" id="spellLevel" placeholder="LVL" min="1" value="1" style="width:65px" title="Spell level — increases through repeated casting" />
                        <button class="hud-btn-sm" onclick="HUD.addSpell()">ADD</button>
                    </div>
                    <div class="skills-list" id="spellList"></div>
                </div>

                <!-- Mana management -->
                <div class="hud-card">
                    <div class="card-header">◈ MANA MANAGEMENT</div>
                    <div class="stat-grid">
                        <div class="stat-row"><span class="stat-name">MANA REGEN/TURN</span><input class="hud-field num" type="number" data-field="manaRegen" placeholder="0" /></div>
                        <div class="stat-row"><span class="stat-name">SPELL POWER</span><input class="hud-field num" type="number" data-field="spellPower" placeholder="0" /></div>
                        <div class="stat-row"><span class="stat-name">MAGIC RESIST</span><input class="hud-field num" type="number" data-field="magicResist" placeholder="0" /></div>
                    </div>
                    <div class="card-header" style="margin-top:1rem">◈ MAGICAL NOTES</div>
                    <textarea class="hud-textarea" data-field="magicNotes" placeholder="Curses, enchantments, magical conditions…" rows="4"></textarea>
                </div>
            </div>
        </section>

        <!-- ── TAB: ACHIEVEMENTS ────────────────────────────── -->
        <section class="tab-panel" id="tab-achievements">
            <div class="panel-grid">
                <div class="hud-card span-3">
                    <div class="card-header">★ ACHIEVEMENTS</div>
                    <div class="ach-add-row">
                        <input class="hud-input" type="text" id="achName" placeholder="Achievement name…" style="flex:1" />
                        <input class="hud-input" type="text" id="achDesc" placeholder="Description…" style="flex:2" />
                        <select class="hud-input sm" id="achRarity" style="width:130px">
                            <option value="common">Common</option>
                            <option value="rare">Rare</option>
                            <option value="epic">Epic</option>
                            <option value="legendary">Legendary</option>
                        </select>
                        <button class="hud-btn-sm" onclick="HUD.addAchievement()">UNLOCK</button>
                    </div>
                    <div class="ach-grid" id="achGrid"></div>
                </div>
            </div>
        </section>

        <!-- ── TAB: MAP ─────────────────────────────────────── -->
        <section class="tab-panel" id="tab-map">
            <div class="panel-grid">
                <div class="hud-card span-2">
                    <div class="card-header">⊕ DUNGEON MAP NOTES</div>
                    <div class="map-meta-grid">
                        <div class="id-field"><label>BOSS ENCOUNTERED</label><input class="hud-field" type="text" data-field="bossName" placeholder="—" /></div>
                        <div class="id-field"><label>BOSS STATUS</label><input class="hud-field" type="text" data-field="bossStatus" placeholder="Alive / Defeated" /></div>
                    </div>
                    <div class="card-header" style="margin-top:1rem">⊕ EXPLORED AREAS</div>
                    <div class="area-add-row" style="display:flex;gap:0.5rem;margin-bottom:0.75rem">
                        <input class="hud-input" type="text" id="areaName" placeholder="Area name…" style="flex:1" />
                        <input class="hud-input sm" type="text" id="areaStatus" placeholder="Cleared / Danger / Unknown" style="flex:1" />
                        <button class="hud-btn-sm" onclick="HUD.addArea()">ADD</button>
                    </div>
                    <div class="area-list" id="areaList"></div>
                    <div class="card-header" style="margin-top:1rem">⊕ MAP NOTES</div>
                    <textarea class="hud-textarea" data-field="mapNotes" placeholder="Traps spotted, secret doors, NPC locations, hazards…" rows="5"></textarea>
                </div>
            </div>
        </section>

        <!-- ── TAB: SAFE ROOM ────────────────────────────────── -->
        <section class="tab-panel" id="tab-saferoom">

            <!-- Safe Room sub-tab nav -->
            <nav class="sr-subnav" id="srSubnav">
                <button class="sr-tab active" data-srtab="general">⬡ GENERAL</button>
                <button class="sr-tab" data-srtab="bedroom">🛏 BEDROOM</button>
                <button class="sr-tab" data-srtab="training">⚔ TRAINING</button>
                <button class="sr-tab" data-srtab="crafting">⚒ CRAFTING</button>
                <button class="sr-tab" data-srtab="social">📡 SOCIAL</button>
            </nav>

            <!-- ── GENERAL ─────────────────────────────────── -->
            <div class="sr-panel active" id="srp-general">
                <div class="panel-grid">
                    <div class="hud-card span-2">
                        <div class="card-header">⬡ SAFE ROOM — GENERAL UPGRADES</div>
                        <div class="safe-upgrades">
                            <label class="upgrade-row"><input type="checkbox" data-field="upgradeFood" /> Food Box (Kitchen)</label>
                            <label class="upgrade-row"><input type="checkbox" data-field="upgradeStorage" /> Storage Unit</label>
                            <label class="upgrade-row"><input type="checkbox" data-field="upgradeDeSleeve" /> De-Sleeving Box</label>
                            <label class="upgrade-row"><input type="checkbox" data-field="upgradeDeity" /> Deity's Box</label>
                            <label class="upgrade-row"><input type="checkbox" data-field="upgradeWorkshop" /> Demolition Workshop</label>
                            <label class="upgrade-row"><input type="checkbox" data-field="upgradeScratchpad" /> Second Scratch Pad</label>
                        </div>
                        <div class="card-header" style="margin-top:1rem">⬡ SAFE ROOM LOCATION</div>
                        <div class="identity-grid" style="grid-template-columns:1fr 1fr">
                            <div class="id-field"><label>ROOM TIER</label><input class="hud-field" type="text" data-field="safeRoomTier" placeholder="Standard / Upgraded…" /></div>
                            <div class="id-field"><label>TITHE / OFFERING DUE</label><input class="hud-field" type="text" data-field="safeRoomTithe" placeholder="e.g. 50g per floor or 1 finger" /></div>
                        </div>
                        <div class="card-header" style="margin-top:1rem">⬡ GENERAL NOTES</div>
                        <textarea class="hud-textarea" data-field="safeRoomNotes" placeholder="Safe room condition, special features, what's stocked…" rows="3"></textarea>
                    </div>
                    <div class="hud-card">
                        <div class="card-header">⬡ SPONSOR
                            <span style="color:var(--clr-text-dim);font-size:.52rem;font-family:var(--font-mono);font-weight:normal">Sends loot boxes</span>
                        </div>
                        <div class="id-field" style="margin-bottom:.6rem"><label>SPONSOR NAME</label><input class="hud-field" type="text" data-field="sponsorName" placeholder="Sponsor name…" style="width:100%" /></div>
                        <div class="id-field" style="margin-bottom:.6rem"><label>RELATIONSHIP STATUS</label><input class="hud-field" type="text" data-field="sponsorStatus" placeholder="Friendly / Neutral / Strained…" style="width:100%" /></div>
                        <div class="id-field" style="margin-bottom:.6rem"><label>CONTRACT VALUE</label><input class="hud-field" type="text" data-field="sponsorValue" placeholder="0 gold / barter…" style="width:100%" /></div>
                        <textarea class="hud-textarea" data-field="sponsorNotes" placeholder="Contract terms, perks, obligations, sponsor personality…" rows="3"></textarea>

                        <div class="card-header" style="margin-top:1.1rem">⬡ PATRON
                            <span style="color:var(--clr-text-dim);font-size:.52rem;font-family:var(--font-mono);font-weight:normal">Floor-consistent perks (weaker but reliable)</span>
                        </div>
                        <div class="id-field" style="margin-bottom:.6rem"><label>PATRON NAME</label><input class="hud-field" type="text" data-field="patronName" placeholder="e.g. Gobblegoo Spell Book Club" style="width:100%" /></div>
                        <div class="id-field" style="margin-bottom:.6rem"><label>PERK PER FLOOR</label><input class="hud-field" type="text" data-field="patronPerk" placeholder="e.g. 1 free spell book each floor" style="width:100%" /></div>
                        <textarea class="hud-textarea" data-field="patronNotes" placeholder="Patron conditions, obligations, history…" rows="2"></textarea>
                    </div>
                </div>
            </div>

            <!-- ── BEDROOM ─────────────────────────────────── -->
            <div class="sr-panel" id="srp-bedroom">
                <div class="panel-grid">
                    <div class="hud-card span-3">
                        <div class="card-header">🛏 BEDROOM UPGRADES
                            <span style="color:var(--clr-text-dim);font-size:.55rem;font-family:var(--font-mono)">Upgrades give passive bonuses — note the effect in the bonus field</span>
                        </div>
                        <div class="sr-upgrade-add-row">
                            <input class="hud-input" type="text" id="bedName" placeholder="Upgrade name…" style="flex:2" />
                            <input class="hud-input sm" type="text" id="bedBonus" placeholder="Bonus / effect…" style="flex:2" />
                            <input class="hud-input sm" type="text" id="bedCost" placeholder="Gold cost" style="width:110px" />
                            <button class="hud-btn-sm" onclick="HUD.addSrUpgrade('bedroom')">ADD</button>
                        </div>
                        <!-- Pre-built bedroom upgrades render here + custom ones -->
                        <div class="sr-upgrade-list" id="bedroomList"></div>
                    </div>
                </div>
            </div>

            <!-- ── TRAINING ────────────────────────────────── -->
            <div class="sr-panel" id="srp-training">
                <div class="panel-grid">
                    <div class="hud-card span-3">
                        <div class="card-header">⚔ TRAINING ROOMS</div>
                        <div class="sr-upgrade-add-row">
                            <input class="hud-input" type="text" id="trainName" placeholder="Room name…" style="flex:2" />
                            <input class="hud-input sm" type="text" id="trainBonus" placeholder="Stat benefit…" style="flex:2" />
                            <input class="hud-input sm" type="text" id="trainCost" placeholder="Gold cost" style="width:110px" />
                            <button class="hud-btn-sm" onclick="HUD.addSrUpgrade('training')">ADD</button>
                        </div>
                        <div class="sr-upgrade-list" id="trainingList"></div>
                    </div>
                </div>
            </div>

            <!-- ── CRAFTING ────────────────────────────────── -->
            <div class="sr-panel" id="srp-crafting">
                <div class="panel-grid">
                    <div class="hud-card span-3">
                        <div class="card-header">⚒ CRAFTING TABLES
                            <span style="color:var(--clr-text-dim);font-size:.55rem;font-family:var(--font-mono)">Check to mark owned — expand to log crafted items</span>
                        </div>
                        <div class="sr-upgrade-add-row">
                            <input class="hud-input" type="text" id="craftName" placeholder="Table name…" style="flex:2" />
                            <input class="hud-input sm" type="text" id="craftCost" placeholder="Gold cost" style="width:110px" />
                            <button class="hud-btn-sm" onclick="HUD.addCraftingTable()">ADD TABLE</button>
                        </div>
                        <div class="sr-upgrade-list" id="craftingList"></div>
                    </div>
                </div>
            </div>

            <!-- ── SOCIAL ──────────────────────────────────── -->
            <div class="sr-panel" id="srp-social">
                <div class="panel-grid">
                    <div class="hud-card">
                        <div class="card-header">📡 FAN METRICS</div>
                        <div class="stat-grid">
                            <div class="stat-row"><span class="stat-name">VIEWER COUNT</span><input class="hud-field num" type="number" data-field="viewers" placeholder="0" /></div>
                            <div class="stat-row"><span class="stat-name">RATING SCORE</span><input class="hud-field num" type="number" data-field="rating" placeholder="0.0" step="0.1" /></div>
                            <div class="stat-row"><span class="stat-name">TOTAL FANS</span><input class="hud-field num" type="number" data-field="totalFans" placeholder="0" /></div>
                            <div class="stat-row"><span class="stat-name">HATERS</span><input class="hud-field num" type="number" data-field="haters" placeholder="0" /></div>
                            <div class="stat-row">
                                <span class="stat-name">FAME TIER</span>
                                <select class="hud-field" data-field="fameTier" style="width:auto;font-size:.7rem">
                                    <option value="">— Select —</option>
                                    <option value="Hated Dogwater">💀 Hated Dogwater</option>
                                    <option value="Steamy Poo Boy">💩 Steamy Poo Boy</option>
                                    <option value="Trash Boat">🗑 Trash Boat</option>
                                    <option value="Cringey Actor">😬 Cringey Actor</option>
                                    <option value="Neutral">😐 Neutral</option>
                                    <option value="Quirky Youtuber">🎬 Quirky Youtuber</option>
                                    <option value="Small Time Actor">🌱 Small Time Actor</option>
                                    <option value="Rising Star">⭐ Rising Star</option>
                                    <option value="Celebrity">🌟 Celebrity</option>
                                </select>
                            </div>
                        </div>
                        <div class="card-header" style="margin-top:1rem">📡 SOCIAL NOTES</div>
                        <textarea class="hud-textarea" data-field="socialNotes" placeholder="Notable fans, feuds, viral moments, deals made with fans…" rows="4"></textarea>
                    </div>

                    <!-- Fan board / interaction log -->
                    <div class="hud-card span-2">
                        <div class="card-header">📡 FAN BOARD — INTERACTION LOG</div>
                        <div class="sr-upgrade-add-row">
                            <input class="hud-input sm" type="text" id="fanName" placeholder="Fan / source…" style="width:160px" />
                            <input class="hud-input" type="text" id="fanMsg" placeholder="Message, donation, event…" style="flex:1" />
                            <select class="hud-input sm" id="fanType" style="width:120px">
                                <option value="fan">💬 Message</option>
                                <option value="donation">💰 Donation</option>
                                <option value="threat">⚠ Threat</option>
                                <option value="sponsor">⬡ Sponsor</option>
                                <option value="hater">👁 Hater</option>
                            </select>
                            <button class="hud-btn-sm" onclick="HUD.addFanEntry()">POST</button>
                        </div>
                        <div class="fan-feed" id="fanFeed"></div>
                    </div>
                </div>
            </div>

        </section>

        <!-- ── TAB: FACTIONS ─────────────────────────────────── -->
        <section class="tab-panel" id="tab-factions">

            <div class="faction-topbar">
                <div class="faction-add-row">
                    <input class="hud-input" type="text" id="factionNameInput"
                           placeholder="Faction name…" style="flex:1;max-width:320px" />
                    <button class="hud-btn-sm" onclick="HUD.addFaction()">⚑ ADD FACTION</button>
                </div>
                <span class="faction-count" id="factionCount"></span>
            </div>

            <div class="faction-list" id="factionList">
                <div class="faction-empty" id="factionEmpty">
                    <span style="font-size:1.5rem">⚑</span>
                    <p>No factions tracked yet. Add one above.</p>
                </div>
            </div>

        </section>

    </main>

    <!-- ══════════════════════════════════════════════════════
         NEW CHARACTER MODAL
    ══════════════════════════════════════════════════════════ -->
    <div class="modal-backdrop hidden" id="newCharModal">
        <div class="modal-box">
            <div class="modal-title">NEW CRAWLER</div>
            <div class="field-group">
                <label class="field-label">CRAWLER NAME</label>
                <input class="hud-input" type="text" id="newCharName" placeholder="Carl Shithead" maxlength="80" />
            </div>
            <div class="form-message" id="newCharMsg"></div>
            <div style="display:flex;gap:.5rem;margin-top:.75rem">
                <button class="hud-btn-sm danger" onclick="HUD.closeNewCharModal()">CANCEL</button>
                <button class="hud-btn" onclick="HUD.createCharacter()" style="flex:1">CREATE</button>
            </div>
        </div>
    </div>

    <!-- DELETE CONFIRM MODAL -->
    <div class="modal-backdrop hidden" id="delCharModal">
        <div class="modal-box">
            <div class="modal-title danger-title">DELETE CRAWLER</div>
            <p class="modal-hint" style="color:var(--clr-warn)">This is permanent. All data will be lost.</p>
            <p class="modal-hint">Type the character name to confirm:</p>
            <div class="field-group">
                <input class="hud-input" type="text" id="delCharConfirm" placeholder="Character name…" />
            </div>
            <div class="form-message" id="delCharMsg"></div>
            <div style="display:flex;gap:.5rem;margin-top:.75rem">
                <button class="hud-btn-sm" onclick="HUD.closeDelCharModal()">CANCEL</button>
                <button class="hud-btn danger" id="delCharConfirmBtn" onclick="HUD.confirmDelete()" style="flex:1" disabled>DELETE FOREVER</button>
            </div>
        </div>
    </div>

    <script src="js/particles.js"></script>
    <script src="js/hud.js"></script>
</body>
</html>