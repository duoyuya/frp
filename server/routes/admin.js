import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { updateFrpConfig } from '../utils/frp.js';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

// 获取所有用户
router.get('/users', (req, res) => {
  const { page = 1, limit = 20, search = '' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const db = getDb();
  
  let query = `
    SELECT u.id, u.email, u.is_active, u.is_admin, u.created_at,
           COUNT(p.id) as port_count
    FROM users u
    LEFT JOIN ports p ON u.id = p.user_id
  `;
  
  const params = [];
  if (search) {
    query += ' WHERE u.email LIKE ?';
    params.push(`%${search}%`);
  }
  
  query += ' GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  const users = db.prepare(query).all(...params);
  
  let countQuery = 'SELECT COUNT(*) as total FROM users';
  if (search) {
    countQuery += ' WHERE email LIKE ?';
  }
  const { total } = db.prepare(countQuery).get(search ? `%${search}%` : undefined);

  res.json({ users, total, page: parseInt(page), limit: parseInt(limit) });
});

// 获取用户详情
router.get('/users/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  
  const user = db.prepare(`
    SELECT id, email, is_active, is_admin, created_at FROM users WHERE id = ?
  `).get(id);
  
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const ports = db.prepare(`
    SELECT id, port, name, protocol, is_active, created_at FROM ports WHERE user_id = ?
  `).all(id);

  res.json({ user, ports });
});

// 修改用户状态
router.put('/users/:id', (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  const db = getDb();
  const user = db.prepare('SELECT id, is_admin FROM users WHERE id = ?').get(id);
  
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  if (user.is_admin) {
    return res.status(400).json({ error: '不能修改管理员状态' });
  }

  db.prepare('UPDATE users SET is_active = ?, updated_at = strftime(\'%s\', \'now\') WHERE id = ?')
    .run(is_active ? 1 : 0, id);

  res.json({ message: '用户状态已更新' });
});

// 删除用户
router.delete('/users/:id', (req, res) => {
  const { id } = req.params;

  const db = getDb();
  const user = db.prepare('SELECT id, is_admin FROM users WHERE id = ?').get(id);
  
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  if (user.is_admin) {
    return res.status(400).json({ error: '不能删除管理员' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  updateFrpConfig();

  res.json({ message: '用户已删除' });
});

// 修改用户端口
router.put('/users/:userId/ports/:portId', (req, res) => {
  const { userId, portId } = req.params;
  const { port, name, is_active } = req.body;

  const db = getDb();
  const existingPort = db.prepare('SELECT * FROM ports WHERE id = ? AND user_id = ?').get(portId, userId);
  
  if (!existingPort) {
    return res.status(404).json({ error: '端口不存在' });
  }

  if (port && port !== existingPort.port) {
    const conflict = db.prepare('SELECT id FROM ports WHERE port = ? AND id != ?').get(port, portId);
    if (conflict) {
      return res.status(400).json({ error: '端口已被占用' });
    }
  }

  db.prepare('UPDATE ports SET port = ?, name = ?, is_active = ? WHERE id = ?')
    .run(port ?? existingPort.port, name ?? existingPort.name, is_active ?? existingPort.is_active, portId);

  updateFrpConfig();

  res.json({ message: '端口已更新' });
});

// 删除用户端口
router.delete('/users/:userId/ports/:portId', (req, res) => {
  const { userId, portId } = req.params;

  const db = getDb();
  const port = db.prepare('SELECT * FROM ports WHERE id = ? AND user_id = ?').get(portId, userId);
  
  if (!port) {
    return res.status(404).json({ error: '端口不存在' });
  }

  db.prepare('DELETE FROM ports WHERE id = ?').run(portId);
  updateFrpConfig();

  res.json({ message: '端口已删除' });
});

// 获取系统统计
router.get('/stats', (req, res) => {
  const db = getDb();
  
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 0').get();
  const activeUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1 AND is_admin = 0').get();
  const portCount = db.prepare('SELECT COUNT(*) as count FROM ports').get();
  const activePortCount = db.prepare('SELECT COUNT(*) as count FROM ports WHERE is_active = 1').get();

  const totalTraffic = db.prepare(`
    SELECT SUM(upload_bytes) as upload, SUM(download_bytes) as download FROM traffic_stats
  `).get();

  res.json({
    users: { total: userCount.count, active: activeUsers.count },
    ports: { total: portCount.count, active: activePortCount.count },
    traffic: { upload: totalTraffic.upload || 0, download: totalTraffic.download || 0 }
  });
});

export default router;
