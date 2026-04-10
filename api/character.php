<?php
// ============================================================
//  api/character.php  —  CRUD for character sheet data
//
//  All responses are JSON.
//  Requires an active session (user_id).
//
//  Actions (POST param "action"):
//    list       → return all characters for current user
//    create     → create new character, return id + name
//    load       → return sheet_json for a character id
//    save       → upsert sheet_json for a character id
//    rename     → rename a character
//    delete     → delete a character
// ============================================================

session_start();
header('Content-Type: application/json');
require_once __DIR__ . '/../config/db.php';

// Auth gate
if (empty($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Not authenticated.']);
    exit;
}

$uid    = (int) $_SESSION['user_id'];
$action = $_POST['action'] ?? $_GET['action'] ?? '';
$db     = get_db();

// ── list ─────────────────────────────────────────────────────
if ($action === 'list') {
    $stmt = $db->prepare('SELECT id, name, updated_at FROM characters WHERE user_id = ? ORDER BY updated_at DESC');
    $stmt->execute([$uid]);
    echo json_encode(['success' => true, 'characters' => $stmt->fetchAll()]);
    exit;
}

// ── create ───────────────────────────────────────────────────
if ($action === 'create') {
    $name = trim($_POST['name'] ?? 'New Crawler');
    if (!$name) $name = 'New Crawler';

    $stmt = $db->prepare('INSERT INTO characters (user_id, name) VALUES (?, ?)');
    $stmt->execute([$uid, $name]);
    $cid = $db->lastInsertId();

    // Seed empty sheet data
    $stmt2 = $db->prepare('INSERT INTO character_data (character_id, sheet_json) VALUES (?, ?)');
    $stmt2->execute([$cid, '{}']);

    echo json_encode(['success' => true, 'id' => $cid, 'name' => $name]);
    exit;
}

// ── Helpers that need a character id ─────────────────────────
$cid = (int) ($_POST['id'] ?? $_GET['id'] ?? 0);

function owns_character(PDO $db, int $uid, int $cid): bool {
    $s = $db->prepare('SELECT id FROM characters WHERE id = ? AND user_id = ?');
    $s->execute([$cid, $uid]);
    return (bool) $s->fetch();
}

if (!$cid || !owns_character($db, $uid, $cid)) {
    echo json_encode(['success' => false, 'message' => 'Character not found.']);
    exit;
}

// ── load ─────────────────────────────────────────────────────
if ($action === 'load') {
    $stmt = $db->prepare('SELECT sheet_json FROM character_data WHERE character_id = ?');
    $stmt->execute([$cid]);
    $row  = $stmt->fetch();
    $data = $row ? json_decode($row['sheet_json'], true) : [];
    echo json_encode(['success' => true, 'data' => $data]);
    exit;
}

// ── save ─────────────────────────────────────────────────────
if ($action === 'save') {
    $raw  = $_POST['sheet_json'] ?? '{}';
    // Validate JSON
    json_decode($raw);
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo json_encode(['success' => false, 'message' => 'Invalid JSON payload.']);
        exit;
    }

    $stmt = $db->prepare('
        INSERT INTO character_data (character_id, sheet_json)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE sheet_json = VALUES(sheet_json)
    ');
    $stmt->execute([$cid, $raw]);
    echo json_encode(['success' => true]);
    exit;
}

// ── rename ───────────────────────────────────────────────────
if ($action === 'rename') {
    $name = trim($_POST['name'] ?? '');
    if (!$name) { echo json_encode(['success' => false, 'message' => 'Name required.']); exit; }
    $stmt = $db->prepare('UPDATE characters SET name = ? WHERE id = ?');
    $stmt->execute([$name, $cid]);
    echo json_encode(['success' => true]);
    exit;
}

// ── delete ───────────────────────────────────────────────────
if ($action === 'delete') {
    $stmt = $db->prepare('DELETE FROM characters WHERE id = ?');
    $stmt->execute([$cid]);
    echo json_encode(['success' => true]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Unknown action.']);