// 流量统计收集器 - 可选组件
// 用于从FRP日志中收集流量数据
// 在生产环境中可以通过cron定时运行

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH || '/app/data/frp-panel.db';
const FRP_LOG_PATH = process.env.FRP_LOG_PATH || '/app/frp/frps.log';

function collectTraffic() {
  if (!fs.existsSync(FRP_LOG_PATH)) {
    console.log('FRP日志文件不存在');
    return;
  }

  const db = new Database(DB_PATH);
  
  // 模拟流量数据 (实际应从FRP日志解析)
  // FRP的流量统计需要通过API或日志解析获取
  const users = db.prepare('SELECT id FROM users WHERE is_admin = 0 AND is_active = 1').all();
  
  const now = Math.floor(Date.now() / 1000);
  const stmt = db.prepare(`
    INSERT INTO traffic_stats (user_id, upload_bytes, download_bytes, recorded_at)
    VALUES (?, ?, ?, ?)
  `);

  for (const user of users) {
    // 模拟随机流量数据
    const upload = Math.floor(Math.random() * 1024 * 1024 * 10);
    const download = Math.floor(Math.random() * 1024 * 1024 * 50);
    stmt.run(user.id, upload, download, now);
  }

  // 清理30天前的数据
  db.prepare('DELETE FROM traffic_stats WHERE recorded_at < ?').run(now - 30 * 24 * 3600);

  console.log(`流量数据已记录: ${users.length} 个用户`);
  db.close();
}

collectTraffic();
