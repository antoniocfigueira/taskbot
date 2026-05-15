CREATE DATABASE IF NOT EXISTS clickbot
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE clickbot;

DESCRIBE chat_history;

ALTER TABLE chat_history ADD COLUMN session_id VARCHAR(100) NULL AFTER id;

CREATE TABLE IF NOT EXISTS chat_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  error_text TEXT NOT NULL,
  error_type ENUM('UI', 'API', 'Database') NOT NULL,
  severity INT NOT NULL,
  fix_suggestion TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  priority ENUM('URGENT', 'HIGH', 'MEDIUM', 'LOW') DEFAULT 'MEDIUM',
  space ENUM('Desenvolvimento', 'Design', 'Marketing') NULL,
  due_date DATE NULL,
  assignee VARCHAR(100) NULL,
  status ENUM('open', 'done') DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
