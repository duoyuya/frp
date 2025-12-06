import initSqlJs from 'sql.js';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

let db;
let SQL;
const dbPath = process.env.DB_PATH || './data/frp-panel.db';

export function getDb() {
  return {
    prepare: (sql) => ({
      run: (...params) => {
        db.run(sql, params);
        return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0][0] };
      },
      get: (...params) => {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      all: (...params) => {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      }
    }),
    exec: (sql) => db.run(sql)
  };
}

function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// 定期保存数据库
setInterval(saveDb, 30000);

export async function initDatabase() {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // 用户表
  db.run(`
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
  db.run(`
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
  db.run(`
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
  db.run(`CREATE INDEX IF NOT EXISTS idx_traffic_user ON traffic_stats(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_traffic_time ON traffic_stats(recorded_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ports_user ON ports(user_id)`);

  // 创建默认管理员
  const adminEmail = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123456';
  
  const stmt = db.prepare('SELECT id FROM users WHERE is_admin = 1');
  const hasAdmin = stmt.step();
  stmt.free();
  
  if (!hasAdmin) {
    const hashedPass = await bcrypt.hash(adminPass, 10);
    db.run('INSERT INTO users (email, password, is_admin, is_active) VALUES (?, ?, 1, 1)', 
      [adminEmail, hashedPass]);
    console.log('默认管理员已创建');
  }

  saveDb();
  console.log('数据库初始化完成');
  
  // 退出时保存
  process.on('exit', saveDb);
  process.on('SIGINT', () => { saveDb(); process.exit(); });
  process.on('SIGTERM', () => { saveDb(); process.exit(); });
}
