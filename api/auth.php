<?php
// ============================================================
//  api/auth.php  —  login, register, logout (JSON responses)
//  Now handles: is_admin passkey, is_banned block, audit log
// ============================================================

session_start();
header('Content-Type: application/json');
require_once __DIR__ . '/../config/db.php';

define('ADMIN_PASSKEY', 'SystemAIAdmin');

// ── Audit helper ─────────────────────────────────────────────
function audit(PDO $db, ?int $uid, ?string $username, string $action, ?string $detail = null): void {
    $ip = $_SERVER['HTTP_X_FORWARDED_FOR']
        ?? $_SERVER['REMOTE_ADDR']
        ?? null;
    if ($ip) $ip = substr($ip, 0, 45);
    $s = $db->prepare(
        'INSERT INTO audit_log (user_id, username, action, detail, ip) VALUES (?,?,?,?,?)'
    );
    $s->execute([$uid, $username, $action, $detail, $ip]);
}

$action = $_POST['action'] ?? '';

// ── Register ─────────────────────────────────────────────────
if ($action === 'register') {
    $username  = trim($_POST['username']   ?? '');
    $email     = trim($_POST['email']      ?? '');
    $password  =      $_POST['password']   ?? '';
    $passkey   = trim($_POST['admin_key']  ?? '');

    if (!$username || !$email || !$password) {
        echo json_encode(['success' => false, 'message' => 'All fields required.']); exit;
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'Invalid email address.']); exit;
    }
    if (strlen($password) < 8) {
        echo json_encode(['success' => false, 'message' => 'Password must be at least 8 characters.']); exit;
    }
    if (!preg_match('/^[a-zA-Z0-9_]{3,40}$/', $username)) {
        echo json_encode(['success' => false, 'message' => 'Username: 3-40 chars, letters/numbers/underscore only.']); exit;
    }

    // Validate passkey if provided
    $isAdmin = 0;
    if ($passkey !== '') {
        if ($passkey !== ADMIN_PASSKEY) {
            echo json_encode(['success' => false, 'message' => 'Invalid System AI key.']); exit;
        }
        $isAdmin = 1;
    }

    $db   = get_db();
    $hash = password_hash($password, PASSWORD_BCRYPT);

    try {
        $stmt = $db->prepare(
            'INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$username, $email, $hash, $isAdmin]);
        $uid = (int) $db->lastInsertId();

        session_regenerate_id(true);
        $_SESSION['user_id']   = $uid;
        $_SESSION['username']  = $username;
        $_SESSION['is_admin']  = $isAdmin;

        audit($db, $uid, $username, 'register', $isAdmin ? 'Admin account created' : 'User registered');

        echo json_encode([
            'success'  => true,
            'message'  => 'Account created.',
            'is_admin' => (bool) $isAdmin,
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            echo json_encode(['success' => false, 'message' => 'Username or email already in use.']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Server error. Try again.']);
        }
    }
    exit;
}

// ── Login ─────────────────────────────────────────────────────
if ($action === 'login') {
    $identifier = trim($_POST['identifier'] ?? '');
    $password   =      $_POST['password']   ?? '';

    if (!$identifier || !$password) {
        echo json_encode(['success' => false, 'message' => 'Enter your credentials.']); exit;
    }

    $db   = get_db();
    $stmt = $db->prepare(
        'SELECT id, username, password, is_admin, is_banned, ban_reason
         FROM users WHERE username = ? OR email = ? LIMIT 1'
    );
    $stmt->execute([$identifier, $identifier]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        echo json_encode(['success' => false, 'message' => 'Invalid credentials.']); exit;
    }

    if ($user['is_banned']) {
        $reason = $user['ban_reason'] ? ' Reason: ' . $user['ban_reason'] : '';
        audit($db, $user['id'], $user['username'], 'login_banned', 'Blocked login attempt');
        echo json_encode(['success' => false, 'message' => 'Your account has been suspended.' . $reason]);
        exit;
    }

    // Update last_login
    $db->prepare('UPDATE users SET last_login = NOW() WHERE id = ?')->execute([$user['id']]);

    session_regenerate_id(true);
    $_SESSION['user_id']  = (int) $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['is_admin'] = (int) $user['is_admin'];

    audit($db, $user['id'], $user['username'], 'login', $user['is_admin'] ? 'Admin login' : null);

    echo json_encode([
        'success'  => true,
        'message'  => 'Authenticated.',
        'is_admin' => (bool) $user['is_admin'],
    ]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Unknown action.']);