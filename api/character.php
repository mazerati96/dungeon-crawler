<?php
// ============================================================
//  api/character.php  —  CRUD for character sheet data
//  Now logs saves and deletes to audit_log
// ============================================================

session_start();
header('Content-Type: application/json');
require_once __DIR__ . '/../config/db.php';

if (empty($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not authenticated.']); exit;
}

$uid    = (int) $_SESSION['user_id'];
$uname  = $_SESSION['username'] ?? '';
$action = $_POST['action'] ?? $_GET['action'] ?? '';
$db     = get_db();

function audit_char(PDO $db, ?int $uid, ?string $username, string $action, ?string $detail = null): void {
    $ip = substr($_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '', 0, 45);
    $db->prepare('INSERT INTO audit_log (user_id, username, action, detail, ip) VALUES (?,?,?,?,?)')
       ->execute([$uid, $username, $action, $detail, $ip]);
}

// ── list ─────────────────────────────────────────────────────
if ($action === 'list') {
    $stmt = $db->prepare(
        'SELECT id, name, updated_at FROM characters WHERE user_id = ? ORDER BY updated_at DESC'
    );
    $stmt->execute([$uid]);
    echo json_encode(['success' => true, 'characters' => $stmt->fetchAll()]);
    exit;
}

// ── create ───────────────────────────────────────────────────
if ($action === 'create') {
    $name = trim($_POST['name'] ?? 'New Crawler') ?: 'New Crawler';
    $stmt = $db->prepare('INSERT INTO characters (user_id, name) VALUES (?, ?)');
    $stmt->execute([$uid, $name]);
    $cid = (int) $db->lastInsertId();
    $db->prepare('INSERT INTO character_data (character_id, sheet_json) VALUES (?, ?)')->execute([$cid, '{}']);
    audit_char($db, $uid, $uname, 'create_char', "Created character: $name (id=$cid)");
    echo json_encode(['success' => true, 'id' => $cid, 'name' => $name]);
    exit;
}

// ── helpers needing a character id ───────────────────────────
$cid = (int) ($_POST['id'] ?? $_GET['id'] ?? 0);

function owns_character(PDO $db, int $uid, int $cid): bool {
    $s = $db->prepare('SELECT id FROM characters WHERE id = ? AND user_id = ?');
    $s->execute([$cid, $uid]);
    return (bool) $s->fetch();
}

// Admins may access any character
$isAdmin = !empty($_SESSION['is_admin']);
if (!$cid || (!$isAdmin && !owns_character($db, $uid, $cid))) {
    echo json_encode(['success' => false, 'message' => 'Character not found.']); exit;
}

// ── load ─────────────────────────────────────────────────────
if ($action === 'load') {
    // LIMIT 1 guards against duplicate rows that may exist from the old
    // broken INSERT-only save path (see save fix below).
    $stmt = $db->prepare(
        'SELECT sheet_json FROM character_data WHERE character_id = ? ORDER BY id DESC LIMIT 1'
    );
    $stmt->execute([$cid]);
    $row  = $stmt->fetch();
    $data = $row ? json_decode($row['sheet_json'], true) : [];
    echo json_encode(['success' => true, 'data' => $data]);
    exit;
}

// ── save ─────────────────────────────────────────────────────
if ($action === 'save') {
    $raw = $_POST['sheet_json'] ?? '{}';
    json_decode($raw);
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo json_encode(['success' => false, 'message' => 'Invalid JSON.']); exit;
    }

    // BUG FIX: The previous ON DUPLICATE KEY UPDATE only fires when
    // character_data.character_id has a UNIQUE or PRIMARY KEY constraint.
    // Without that constraint every save silently did a plain INSERT,
    // piling up duplicate rows.  The SELECT on load has no ORDER BY, so
    // it returned whichever row MySQL picked first — usually the empty {}
    // created at character creation — making every save appear to vanish
    // after a page reload.
    //
    // Fix: try UPDATE first.  If it touches 0 rows the character_data row
    // is missing entirely, so INSERT it.  This is correct regardless of
    // whether the UNIQUE constraint exists on the table.
    $upd = $db->prepare('UPDATE character_data SET sheet_json = ? WHERE character_id = ?');
    $upd->execute([$raw, $cid]);
    if ($upd->rowCount() === 0) {
        $db->prepare('INSERT INTO character_data (character_id, sheet_json) VALUES (?, ?)')
           ->execute([$cid, $raw]);
    }

    audit_char($db, $uid, $uname, 'save_sheet', "Saved character id=$cid");
    echo json_encode(['success' => true]);
    exit;
}

// ── rename ───────────────────────────────────────────────────
if ($action === 'rename') {
    $name = trim($_POST['name'] ?? '');
    if (!$name) { echo json_encode(['success' => false, 'message' => 'Name required.']); exit; }
    $db->prepare('UPDATE characters SET name = ? WHERE id = ?')->execute([$name, $cid]);
    echo json_encode(['success' => true]);
    exit;
}

// ── delete ───────────────────────────────────────────────────
if ($action === 'delete') {
    // get name for audit
    $row = $db->prepare('SELECT name FROM characters WHERE id = ?');
    $row->execute([$cid]);
    $charName = $row->fetchColumn() ?: 'unknown';

    // BUG FIX: Always delete character_data rows first.
    // The old code only deleted from `characters`, leaving orphan rows in
    // character_data.  MySQL auto-increment IDs get reused after many
    // create/delete cycles, so a brand-new character could silently inherit
    // a deleted character's sheet data — the data-bleeding between crawlers.
    // Delete in child-first order to avoid foreign key constraint errors.
    $db->prepare('DELETE FROM character_data WHERE character_id = ?')->execute([$cid]);
    $db->prepare('DELETE FROM characters WHERE id = ?')->execute([$cid]);

    audit_char($db, $uid, $uname, 'delete_char', "Deleted character: $charName (id=$cid)");
    echo json_encode(['success' => true]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Unknown action.']);