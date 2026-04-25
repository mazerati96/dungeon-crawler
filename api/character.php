<?php
// ============================================================
//  api/character.php  —  CRUD for character sheet data
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

$isAdmin = !empty($_SESSION['is_admin']);
if (!$cid || (!$isAdmin && !owns_character($db, $uid, $cid))) {
    echo json_encode(['success' => false, 'message' => 'Character not found.']); exit;
}

// ── load ─────────────────────────────────────────────────────
if ($action === 'load') {
    $stmt = $db->prepare('SELECT sheet_json FROM character_data WHERE character_id = ?');
    $stmt->execute([$cid]);
    $row = $stmt->fetch();
    // Return the raw JSON string directly — never decode/re-encode.
    // json_decode('{}', true) returns a PHP [] which json_encode turns back
    // into '[]', causing JS to treat sheetData as an Array and JSON.stringify
    // to silently drop all named properties on save.
    $raw = ($row && !empty($row['sheet_json'])) ? $row['sheet_json'] : '{}';
    // Ensure it's a JSON object, not array — if somehow '[]' got stored, reset it
    if (trim($raw) === '[]') $raw = '{}';
    echo json_encode(['success' => true, 'raw' => $raw]);
    exit;
}

// ── save ─────────────────────────────────────────────────────
if ($action === 'save') {
    $raw = $_POST['sheet_json'] ?? '{}';
    json_decode($raw);
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo json_encode(['success' => false, 'message' => 'Invalid JSON.']); exit;
    }
    // ON DUPLICATE KEY UPDATE works correctly here because character_id is
    // the PRIMARY KEY of character_data, so there is always exactly one row
    // per character and the UPDATE path is always taken after creation.
    $db->prepare(
        'INSERT INTO character_data (character_id, sheet_json)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE sheet_json = VALUES(sheet_json)'
    )->execute([$cid, $raw]);
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
    $row = $db->prepare('SELECT name FROM characters WHERE id = ?');
    $row->execute([$cid]);
    $charName = $row->fetchColumn() ?: 'unknown';
    // Delete character_data first (child row) to avoid FK constraint errors,
    // and to prevent orphan rows from polluting recycled character IDs.
    $db->prepare('DELETE FROM character_data WHERE character_id = ?')->execute([$cid]);
    $db->prepare('DELETE FROM characters WHERE id = ?')->execute([$cid]);
    audit_char($db, $uid, $uname, 'delete_char', "Deleted character: $charName (id=$cid)");
    echo json_encode(['success' => true]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Unknown action.']);