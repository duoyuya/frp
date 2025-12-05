import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

let db;

export function getDb() {
  return db;
}

export async function initDatabase() {
  const dbPath = process.env.DB_PATH || './data/frp-panel.db';
  const dbDir = path.dirname(dbPath);
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // 用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 0,
      verify_token TEXT,
      reset_token TEXT,
      reset_expires INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);

  // 端口表
  db.exec(`
    CREATE TABLE IF NOT EXISTS ports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      port INTEGER UNIQUE NOT NULL,
      name TEXT,
      protocol TEXT DEFAULT 'tcp',
      is_active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 流量统计表
  db.exec(`
    CREATE TABLE IF NOT EXISTS traffic_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      port_id INTEGER,
      upload_bytes INTEGER DEFAULT 0,
      download_bytes INTEGER DEFAULT 0,
      recorded_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (port_id) REFERENCES ports(id) ON DELETE SET NULL
    )
  `);

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_traffic_user ON traffic_stats(user_id);
    CREATE INDEX IF NOT EXISTS idx_traffic_time ON traffic_stats(recorded_at);
    CREATE INDEX IF NOT EXISTS idx_ports_user ON ports(user_id);
  `);

  // 创建默认管理员
  const adminEmail = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123456';
  
  const existingAdmin = db.prepare('SELECT id FROM users WHERE is_admin = 1').get();
  if (!existingAdmin) {
    const hashedPass = await bcrypt.hash(adminPass, 10);
    db.prepare(`
      INSERT INTO users (email, password, is_admin, is_active) VALUES (?, ?, 1, 1)
    `).run(adminEmail, hashedPass);
    console.log('默认管理员已创建');
  }

  console.log('数据库初始化完成');
  return db;
}
