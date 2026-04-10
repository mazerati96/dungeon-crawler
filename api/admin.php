<?php
// ============================================================
//  api/admin.php  —  System AI admin actions
//
//  ALL endpoints require is_admin session flag.
//  Actions: stats, users, characters, sheet_json,
//           audit, ban, unban, delete_user, delete_char,
//           edit_sheet, logout_audit
// ============================================================

session_start();
header('Content-Type: application/json');
require_once __DIR__ . '/../config/db.php';

// Admin gate
if (empty($_SESSION['user_id']) || empty($_SESSION['is_admin'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Forbidden.']);
    exit;
}

$adminId    = (int) $_SESSION['user_id'];
$adminName  = $_SESSION['username'] ?? 'admin';
$action     = $_POST['action'] ?? $_GET['action'] ?? '';
$db         = get_db();

function admin_audit(PDO $db, int $adminId, string $adminName, string $action, ?string $detail): void {
    $ip = substr($_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '', 0, 45);
    $db->prepare('INSERT INTO audit_log (user_id, username, action, detail, ip) VALUES (?,?,?,?,?)')
       ->execute([$adminId, $adminName, $action, $detail, $ip]);
}

// ══════════════════════════════════════════════════════════════
//  GET ACTIONS  (use GET or POST)
// ══════════════════════════════════════════════════════════════

// ── stats ─────────────────────────────────────────────────────
if ($action === 'stats') {
    $total_users      = $db->query('SELECT COUNT(*) FROM users WHERE is_admin = 0')->fetchColumn();
    $total_admins     = $db->query('SELECT COUNT(*) FROM users WHERE is_admin = 1')->fetchColumn();
    $total_banned     = $db->query('SELECT COUNT(*) FROM users WHERE is_banned = 1')->fetchColumn();
    $total_chars      = $db->query('SELECT COUNT(*) FROM characters')->fetchColumn();
    $total_actions    = $db->query('SELECT COUNT(*) FROM audit_log')->fetchColumn();

    $recent_signups   = $db->query(
        'SELECT username, created_at FROM users WHERE is_admin = 0
         ORDER BY created_at DESC LIMIT 5'
    )->fetchAll();

    $recent_logins    = $db->query(
        'SELECT username, last_login FROM users
         WHERE last_login IS NOT NULL ORDER BY last_login DESC LIMIT 5'
    )->fetchAll();

    $action_counts    = $db->query(
        'SELECT action, COUNT(*) AS cnt FROM audit_log
         GROUP BY action ORDER BY cnt DESC LIMIT 10'
    )->fetchAll();

    echo json_encode([
        'success' => true,
        'stats'   => compact(
            'total_users', 'total_admins', 'total_banned',
            'total_chars', 'total_actions',
            'recent_signups', 'recent_logins', 'action_counts'
        ),
    ]);
    exit;
}

// ── users ─────────────────────────────────────────────────────
if ($action === 'users') {
    $stmt = $db->query(
        'SELECT u.id, u.username, u.email, u.is_admin, u.is_banned, u.ban_reason,
                u.last_login, u.created_at,
                COUNT(c.id) AS char_count
         FROM users u
         LEFT JOIN characters c ON c.user_id = u.id
         GROUP BY u.id
         ORDER BY u.created_at DESC'
    );
    echo json_encode(['success' => true, 'users' => $stmt->fetchAll()]);
    exit;
}

// ── characters for a user ─────────────────────────────────────
if ($action === 'user_chars') {
    $uid  = (int) ($_GET['uid'] ?? $_POST['uid'] ?? 0);
    $stmt = $db->prepare(
        'SELECT c.id, c.name, c.created_at, c.updated_at
         FROM characters c WHERE c.user_id = ? ORDER BY c.updated_at DESC'
    );
    $stmt->execute([$uid]);
    echo json_encode(['success' => true, 'characters' => $stmt->fetchAll()]);
    exit;
}

// ── sheet JSON for a character ────────────────────────────────
if ($action === 'sheet_json') {
    $cid  = (int) ($_GET['cid'] ?? $_POST['cid'] ?? 0);
    $stmt = $db->prepare('SELECT sheet_json FROM character_data WHERE character_id = ?');
    $stmt->execute([$cid]);
    $row  = $stmt->fetch();
    $data = $row ? json_decode($row['sheet_json'], true) : null;
    echo json_encode(['success' => true, 'data' => $data]);
    exit;
}

// ── audit log ─────────────────────────────────────────────────
if ($action === 'audit') {
    $limit  = min((int) ($_GET['limit'] ?? 100), 500);
    $offset = (int) ($_GET['offset'] ?? 0);
    $filter = trim($_GET['filter'] ?? '');

    if ($filter) {
        $stmt = $db->prepare(
            'SELECT * FROM audit_log WHERE action LIKE ? OR username LIKE ? OR detail LIKE ?
             ORDER BY created_at DESC LIMIT ? OFFSET ?'
        );
        $f = "%$filter%";
        $stmt->execute([$f, $f, $f, $limit, $offset]);
    } else {
        $stmt = $db->prepare(
            'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?'
        );
        $stmt->execute([$limit, $offset]);
    }

    $total = $db->query('SELECT COUNT(*) FROM audit_log')->fetchColumn();
    echo json_encode(['success' => true, 'logs' => $stmt->fetchAll(), 'total' => (int) $total]);
    exit;
}

// ══════════════════════════════════════════════════════════════
//  POST ACTIONS  (mutations)
// ══════════════════════════════════════════════════════════════

// ── ban user ──────────────────────────────────────────────────
if ($action === 'ban') {
    $uid    = (int) ($_POST['uid'] ?? 0);
    $reason = trim($_POST['reason'] ?? '');
    if (!$uid || $uid === $adminId) {
        echo json_encode(['success' => false, 'message' => 'Invalid target.']); exit;
    }
    // Cannot ban another admin
    $target = $db->prepare('SELECT username, is_admin FROM users WHERE id = ?');
    $target->execute([$uid]);
    $tUser  = $target->fetch();
    if (!$tUser) { echo json_encode(['success' => false, 'message' => 'User not found.']); exit; }
    if ($tUser['is_admin']) { echo json_encode(['success' => false, 'message' => 'Cannot ban an admin.']); exit; }

    $db->prepare('UPDATE users SET is_banned = 1, ban_reason = ? WHERE id = ?')->execute([$reason, $uid]);
    admin_audit($db, $adminId, $adminName, 'ban_user', "Banned {$tUser['username']} (id=$uid). Reason: $reason");
    echo json_encode(['success' => true]);
    exit;
}

// ── unban user ────────────────────────────────────────────────
if ($action === 'unban') {
    $uid = (int) ($_POST['uid'] ?? 0);
    if (!$uid) { echo json_encode(['success' => false, 'message' => 'Invalid target.']); exit; }
    $target = $db->prepare('SELECT username FROM users WHERE id = ?');
    $target->execute([$uid]);
    $tUser  = $target->fetch();
    if (!$tUser) { echo json_encode(['success' => false, 'message' => 'User not found.']); exit; }
    $db->prepare('UPDATE users SET is_banned = 0, ban_reason = NULL WHERE id = ?')->execute([$uid]);
    admin_audit($db, $adminId, $adminName, 'unban_user', "Unbanned {$tUser['username']} (id=$uid)");
    echo json_encode(['success' => true]);
    exit;
}

// ── delete user ───────────────────────────────────────────────
if ($action === 'delete_user') {
    $uid = (int) ($_POST['uid'] ?? 0);
    if (!$uid || $uid === $adminId) {
        echo json_encode(['success' => false, 'message' => 'Invalid target.']); exit;
    }
    $target = $db->prepare('SELECT username, is_admin FROM users WHERE id = ?');
    $target->execute([$uid]);
    $tUser  = $target->fetch();
    if (!$tUser) { echo json_encode(['success' => false, 'message' => 'User not found.']); exit; }
    if ($tUser['is_admin']) { echo json_encode(['success' => false, 'message' => 'Cannot delete an admin account.']); exit; }
    $db->prepare('DELETE FROM users WHERE id = ?')->execute([$uid]);
    admin_audit($db, $adminId, $adminName, 'delete_user', "Deleted user {$tUser['username']} (id=$uid)");
    echo json_encode(['success' => true]);
    exit;
}

// ── delete character ──────────────────────────────────────────
if ($action === 'delete_char') {
    $cid  = (int) ($_POST['cid'] ?? 0);
    if (!$cid) { echo json_encode(['success' => false, 'message' => 'Invalid target.']); exit; }
    $row  = $db->prepare('SELECT c.name, u.username FROM characters c JOIN users u ON u.id = c.user_id WHERE c.id = ?');
    $row->execute([$cid]);
    $char = $row->fetch();
    if (!$char) { echo json_encode(['success' => false, 'message' => 'Character not found.']); exit; }
    $db->prepare('DELETE FROM characters WHERE id = ?')->execute([$cid]);
    admin_audit($db, $adminId, $adminName, 'admin_delete_char',
        "Deleted character \"{$char['name']}\" (id=$cid) owned by {$char['username']}");
    echo json_encode(['success' => true]);
    exit;
}

// ── edit sheet (admin overwrite) ──────────────────────────────
if ($action === 'edit_sheet') {
    $cid = (int) ($_POST['cid'] ?? 0);
    $raw = $_POST['sheet_json'] ?? '';
    json_decode($raw);
    if (!$cid || json_last_error() !== JSON_ERROR_NONE) {
        echo json_encode(['success' => false, 'message' => 'Invalid data.']); exit;
    }
    $db->prepare(
        'INSERT INTO character_data (character_id, sheet_json)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE sheet_json = VALUES(sheet_json)'
    )->execute([$cid, $raw]);
    admin_audit($db, $adminId, $adminName, 'admin_edit_sheet', "Edited sheet for character id=$cid");
    echo json_encode(['success' => true]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Unknown action.']);