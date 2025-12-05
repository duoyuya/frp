import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// 获取用户信息
router.get('/profile', (req, res) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT id, email, created_at FROM users WHERE id = ?
  `).get(req.user.id);
  
  const ports = db.prepare(`
    SELECT id, port, name, protocol, is_active, created_at FROM ports WHERE user_id = ?
  `).all(req.user.id);

  res.json({ user, ports });
});

// 修改密码
router.post('/change-password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: '新密码至少8位' });
    }

    const db = getDb();
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
    
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(400).json({ error: '当前密码错误' });
    }

    const hashedPass = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password = ?, updated_at = strftime(\'%s\', \'now\') WHERE id = ?')
      .run(hashedPass, req.user.id);

    res.json({ message: '密码修改成功' });
  } catch (err) {
    next(err);
  }
});

// 获取用户流量统计
router.get('/traffic', (req, res) => {
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
  `).all(req.user.id, since);

  const total = db.prepare(`
    SELECT 
      SUM(upload_bytes) as total_upload,
      SUM(download_bytes) as total_download
    FROM traffic_stats 
    WHERE user_id = ?
  `).get(req.user.id);

  res.json({ stats, total });
});

export default router;
