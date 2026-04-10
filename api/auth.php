<?php
// ============================================================
//  api/auth.php  —  handles login & register POST requests
//  Returns JSON: { success: bool, message: string }
// ============================================================

session_start();
header('Content-Type: application/json');
require_once __DIR__ . '/../config/db.php';

$action = $_POST['action'] ?? '';

// ── Register ─────────────────────────────────────────────────
if ($action === 'register') {
    $username = trim($_POST['username'] ?? '');
    $email    = trim($_POST['email']    ?? '');
    $password =       $_POST['password'] ?? '';

    if (!$username || !$email || !$password) {
        echo json_encode(['success' => false, 'message' => 'All fields required.']);
        exit;
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'message' => 'Invalid email address.']);
        exit;
    }
    if (strlen($password) < 8) {
        echo json_encode(['success' => false, 'message' => 'Password must be at least 8 characters.']);
        exit;
    }
    if (!preg_match('/^[a-zA-Z0-9_]{3,40}$/', $username)) {
        echo json_encode(['success' => false, 'message' => 'Username: 3-40 chars, letters/numbers/underscore only.']);
        exit;
    }

    $db   = get_db();
    $hash = password_hash($password, PASSWORD_BCRYPT);

    try {
        $stmt = $db->prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)');
        $stmt->execute([$username, $email, $hash]);
        $uid = $db->lastInsertId();

        $_SESSION['user_id']  = $uid;
        $_SESSION['username'] = $username;
        echo json_encode(['success' => true, 'message' => 'Account created.']);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            echo json_encode(['success' => false, 'message' => 'Username or email already in use.']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Server error. Try again.']);
        }
    }
    exit;
}

// ── Login ────────────────────────────────────────────────────
if ($action === 'login') {
    $identifier = trim($_POST['identifier'] ?? '');   // username or email
    $password   =       $_POST['password']  ?? '';

    if (!$identifier || !$password) {
        echo json_encode(['success' => false, 'message' => 'Enter your credentials.']);
        exit;
    }

    $db   = get_db();
    $stmt = $db->prepare('SELECT id, username, password FROM users WHERE username = ? OR email = ? LIMIT 1');
    $stmt->execute([$identifier, $identifier]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password'])) {
        echo json_encode(['success' => false, 'message' => 'Invalid credentials.']);
        exit;
    }

    session_regenerate_id(true);
    $_SESSION['user_id']  = $user['id'];
    $_SESSION['username'] = $user['username'];
    echo json_encode(['success' => true, 'message' => 'Authenticated.']);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Unknown action.']);