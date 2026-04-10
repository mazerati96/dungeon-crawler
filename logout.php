<?php
// ============================================================
//  logout.php  —  destroy session and redirect to login
// ============================================================
session_start();
session_unset();
session_destroy();
header('Location: login.php');
exit;