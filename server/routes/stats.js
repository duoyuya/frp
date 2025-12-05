import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

// 获取用户流量统计
router.get('/user/:userId', (req, res) => {
  const { userId } = req.params;
  const { hours = 24 } = req.query;
  const hoursNum = Math.min(parseInt(hours) || 24, 48);
  const since = Math.floor(Date.now() / 1000) - hoursNum * 3600;

  const db = getDb();
  
  const stats = db.prepare(`
    SELECT 
      strftime('%Y-%m-%d %H:00', recorded_at, 'unixepoch') as time_bucket,
      SUM(upload_bytes) as upload,
      SUM(download_bytes) as download
    FROM traffic_stats 
    WHERE user_id = ? AND recorded_at >= ?
    GROUP BY time_bucket
    ORDER BY time_bucket
  `).all(userId, since);

  const total = db.prepare(`
    SELECT 
      SUM(upload_bytes) as total_upload,
      SUM(download_bytes) as total_download
    FROM traffic_stats 
    WHERE user_id = ?
  `).get(userId);

  res.json({ stats, total });
});

// 获取全局流量统计
router.get('/global', (req, res) => {
  const { hours = 24 } = req.query;
  const hoursNum = Math.min(parseInt(hours) || 24, 48);
  const since = Math.floor(Date.now() / 1000) - hoursNum * 3600;

  const db = getDb();
  
  const stats = db.prepare(`
    SELECT 
      strftime('%Y-%m-%d %H:00', recorded_at, 'unixepoch') as time_bucket,
      SUM(upload_bytes) as upload,
      SUM(download_bytes) as download
    FROM traffic_stats 
    WHERE recorded_at >= ?
    GROUP BY time_bucket
    ORDER BY time_bucket
  `).all(since);

  const total = db.prepare(`
    SELECT 
      SUM(upload_bytes) as total_upload,
      SUM(download_bytes) as total_download
    FROM traffic_stats
  `).get();

  // 按用户统计
  const byUser = db.prepare(`
    SELECT 
      u.id, u.email,
      SUM(t.upload_bytes) as upload,
      SUM(t.download_bytes) as download
    FROM users u
    LEFT JOIN traffic_stats t ON u.id = t.user_id AND t.recorded_at >= ?
    WHERE u.is_admin = 0
    GROUP BY u.id
    ORDER BY (upload + download) DESC
    LIMIT 10
  `).all(since);

  res.json({ stats, total, byUser });
});

export default router;
