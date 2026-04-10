-- ============================================================
--  dungeon-crawler / sql/schema.sql
--  Run this once in your Hostinger MySQL panel.
--  If upgrading from v1, run the ALTER TABLE lines at the bottom.
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(40)  NOT NULL UNIQUE,
    email       VARCHAR(120) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    is_admin    TINYINT(1)   NOT NULL DEFAULT 0,
    is_banned   TINYINT(1)   NOT NULL DEFAULT 0,
    ban_reason  VARCHAR(255)          DEFAULT NULL,
    last_login  TIMESTAMP             DEFAULT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Characters
CREATE TABLE IF NOT EXISTS characters (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED NOT NULL,
    name        VARCHAR(80)  NOT NULL DEFAULT 'New Crawler',
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Character sheet data (JSON blob per character)
CREATE TABLE IF NOT EXISTS character_data (
    character_id  INT UNSIGNED PRIMARY KEY,
    sheet_json    MEDIUMTEXT   NOT NULL DEFAULT '{}',
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id     INT UNSIGNED          DEFAULT NULL,
    username    VARCHAR(40)           DEFAULT NULL,
    action      VARCHAR(60)  NOT NULL,
    detail      VARCHAR(255)          DEFAULT NULL,
    ip          VARCHAR(45)           DEFAULT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user    (user_id),
    INDEX idx_action  (action),
    INDEX idx_created (created_at)
);

-- UPGRADE from v1 (skip on fresh install):
-- ALTER TABLE users ADD COLUMN is_admin   TINYINT(1) NOT NULL DEFAULT 0   AFTER password;
-- ALTER TABLE users ADD COLUMN is_banned  TINYINT(1) NOT NULL DEFAULT 0   AFTER is_admin;
-- ALTER TABLE users ADD COLUMN ban_reason VARCHAR(255)        DEFAULT NULL AFTER is_banned;
-- ALTER TABLE users ADD COLUMN last_login TIMESTAMP           DEFAULT NULL AFTER ban_reason;