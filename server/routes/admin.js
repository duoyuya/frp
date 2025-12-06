import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, getSettings, updateSettings, getFrpToken } from '../db/index.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { updateFrpConfig, generateClientConfig } from '../utils/frp.js';

const router = Router();

router.use(authMiddleware);
router.use(adminMiddleware);

// 获取系统设置
router.get('/settings', (req, res) => {
  res.json(getSettings());
});

// 更新系统设置
router.put('/settings', (req, res) => {
  const { allow_register, require_email_verify, server_ip, default_port_limit, default_bandwidth_limit } = req.body;
  const settings = updateSettings({ 
    allow_register: allow_register !== undefined ? !!allow_register : undefined,
    require_email_verify: require_email_verify !== undefined ? !!require_email_verify : undefined,
    server_ip: server_ip !== undefined ? server_ip : undefined,
    default_port_limit: default_port_limit !== undefined ? parseInt(default_port_limit) : undefined,
    default_bandwidth_limit: default_bandwidth_limit !== undefined ? parseInt(default_bandwidth_limit) : undefined
  });
  res.json(settings);
});

// 创建用户
router.post('/users', async (req, res) => {
  try {
    const { email, password, is_active = true, is_admin = false, port_limit, bandwidth_limit } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: '请输入有效的邮箱地址' });
    }
    
    if (!password || password.length < 8) {
      return res.status(400).json({ error: '密码至少8位' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: '该邮箱已存在' });
    }

    const settings = getSettings();
    const hashedPass = await bcrypt.hash(password, 10);
    db.prepare('INSERT INTO users (email, password, is_admin, is_active, verify_token, port_limit, bandwidth_limit) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(email, hashedPass, is_admin ? 1 : 0, is_active ? 1 : 0, null, port_limit || settings.default_port_limit, bandwidth_limit || settings.default_bandwidth_limit);

    res.json({ message: '用户创建成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 获取所有用户
router.get('/users', (req, res) => {
  const { page = 1, limit = 20, search = '' } = req.query;
  const db = getDb();
  
  let users = db.prepare('SELECT * FROM users').all() || [];
  
  // 搜索过滤
  if (search) {
    users = users.filter(u => u.email.toLowerCase().includes(search.toLowerCase()));
  }
  
  // 添加端口数量
  const ports = db.prepare('SELECT * FROM ports').all() || [];
  users = users.map(u => ({
    ...u,
    port_count: ports.filter(p => p.user_id === u.id).length
  }));
  
  // 排序
  users.sort((a, b) => b.created_at - a.created_at);
  
  const total = users.length;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  users = users.slice(offset, offset + parseInt(limit));

  res.json({ users, total, page: parseInt(page), limit: parseInt(limit) });
});

// 获取用户详情
router.get('/users/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  
  const user = db.prepare('SELECT id, email, is_active, is_admin, port_limit, bandwidth_limit, created_at FROM users WHERE id = ?').get(id);
  
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const ports = db.prepare('SELECT id, port, name, protocol, local_ip, local_port, is_active, created_at FROM ports WHERE user_id = ?').all(id);

  res.json({ user, ports });
});

// 修改用户
router.put('/users/:id', (req, res) => {
  const { id } = req.params;
  const { is_active, is_admin, port_limit, bandwidth_limit } = req.body;

  const db = getDb();
  const user = db.prepare('SELECT id, is_admin FROM users WHERE id = ?').get(id);
  
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  if (user.is_admin && is_active === 0) {
    return res.status(400).json({ error: '不能禁用管理员' });
  }

  // 更新用户信息
  const userData = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (userData) {
    if (is_active !== undefined) userData.is_active = is_active ? 1 : 0;
    if (is_admin !== undefined) userData.is_admin = is_admin ? 1 : 0;
    if (port_limit !== undefined) userData.port_limit = parseInt(port_limit);
    if (bandwidth_limit !== undefined) userData.bandwidth_limit = parseInt(bandwidth_limit);
    userData.updated_at = Math.floor(Date.now() / 1000);
  }

  updateFrpConfig();
  res.json({ message: '用户已更新' });
});

// 重置用户密码
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ error: '密码至少8位' });
    }

    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const hashedPass = await bcrypt.hash(password, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPass, id);

    res.json({ message: '密码已重置' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 设置/取消管理员
router.post('/users/:id/toggle-admin', (req, res) => {
  const { id } = req.params;

  const db = getDb();
  const user = db.prepare('SELECT id, is_admin FROM users WHERE id = ?').get(id);
  
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  // 不能取消自己的管理员权限
  if (user.id === req.user.id && user.is_admin) {
    return res.status(400).json({ error: '不能取消自己的管理员权限' });
  }

  db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(user.is_admin ? 0 : 1, id);

  res.json({ message: user.is_admin ? '已取消管理员权限' : '已设为管理员' });
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

  db.prepare('DELETE FROM users WHERE id = ?').run(parseInt(id));
  updateFrpConfig();

  res.json({ message: '用户已删除' });
});

// 获取用户配置文件
router.get('/users/:id/config', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const ports = db.prepare('SELECT * FROM ports WHERE user_id = ? AND is_active = 1').all(id);
  const config = generateClientConfig(user, ports);
  
  res.json({ config });
});

// 修改用户端口
router.put('/users/:userId/ports/:portId', (req, res) => {
  const { userId, portId } = req.params;
  const { port, name, local_ip, local_port, is_active } = req.body;

  const db = getDb();
  const existingPort = db.prepare('SELECT * FROM ports WHERE id = ? AND user_id = ?').get(portId, userId);
  
  if (!existingPort) {
    return res.status(404).json({ error: '端口不存在' });
  }

  if (port && port !== existingPort.port) {
    const conflict = db.prepare('SELECT id FROM ports WHERE port = ?').get(port);
    if (conflict && conflict.id != portId) {
      return res.status(400).json({ error: '端口已被占用' });
    }
  }

  db.prepare('UPDATE ports SET port = ?, name = ?, local_ip = ?, local_port = ?, is_active = ? WHERE id = ?')
    .run(port ?? existingPort.port, name ?? existingPort.name, local_ip ?? existingPort.local_ip, local_port ?? existingPort.local_port, is_active ?? existingPort.is_active, portId);

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

// 为用户添加端口
router.post('/users/:userId/ports', (req, res) => {
  const { userId } = req.params;
  const { port, name, protocol = 'tcp', local_ip = '127.0.0.1', local_port } = req.body;

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  // 检查端口数量限制
  const userPorts = db.prepare('SELECT * FROM ports WHERE user_id = ?').all(userId);
  if (userPorts.length >= user.port_limit) {
    return res.status(400).json({ error: `已达到端口上限 (${user.port_limit})` });
  }

  // 检查端口是否被占用
  const conflict = db.prepare('SELECT id FROM ports WHERE port = ?').get(port);
  if (conflict) {
    return res.status(400).json({ error: '端口已被占用' });
  }

  // 检查端口范围
  const minPort = parseInt(process.env.USER_PORT_MIN || 10000);
  const maxPort = parseInt(process.env.USER_PORT_MAX || 60000);
  if (port < minPort || port > maxPort) {
    return res.status(400).json({ error: `端口必须在 ${minPort}-${maxPort} 范围内` });
  }

  db.prepare('INSERT INTO ports (user_id, port, name, protocol, local_ip, local_port) VALUES (?, ?, ?, ?, ?, ?)')
    .run(parseInt(userId), port, name || `端口${port}`, protocol, local_ip, local_port || port);

  updateFrpConfig();
  res.json({ message: '端口添加成功' });
});

// 获取系统统计
router.get('/stats', (req, res) => {
  const db = getDb();
  
  const users = db.prepare('SELECT * FROM users').all() || [];
  const ports = db.prepare('SELECT * FROM ports').all() || [];
  const traffic = db.prepare('SELECT * FROM traffic_stats').all() || [];

  const userCount = users.filter(u => !u.is_admin).length;
  const activeUsers = users.filter(u => u.is_active && !u.is_admin).length;
  const portCount = ports.length;
  const activePortCount = ports.filter(p => p.is_active).length;

  const totalUpload = traffic.reduce((s, t) => s + (t.upload_bytes || 0), 0);
  const totalDownload = traffic.reduce((s, t) => s + (t.download_bytes || 0), 0);

  res.json({
    users: { total: userCount, active: activeUsers },
    ports: { total: portCount, active: activePortCount },
    traffic: { upload: totalUpload, download: totalDownload }
  });
});

// 获取FRP Token (用于客户端配置)
router.get('/frp-token', (req, res) => {
  res.json({ token: getFrpToken() });
});

// ========== 公告管理 ==========

// 获取所有公告
router.get('/announcements', (req, res) => {
  const db = getDb();
  const announcements = db.prepare('SELECT * FROM announcements').all() || [];
  res.json({ announcements });
});

// 创建公告
router.post('/announcements', (req, res) => {
  const { title, content, is_active = true } = req.body;
  
  if (!title || !content) {
    return res.status(400).json({ error: '标题和内容不能为空' });
  }

  const db = getDb();
  const result = db.prepare('INSERT INTO announcements (title, content, is_active) VALUES (?, ?, ?)')
    .run(title, content, is_active ? 1 : 0);

  res.json({ message: '公告创建成功', id: result.lastInsertRowid });
});

// 更新公告
router.put('/announcements/:id', (req, res) => {
  const { id } = req.params;
  const { title, content, is_active } = req.body;

  const db = getDb();
  const ann = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);
  
  if (!ann) {
    return res.status(404).json({ error: '公告不存在' });
  }

  db.prepare('UPDATE announcements SET title = ?, content = ?, is_active = ? WHERE id = ?')
    .run(title ?? ann.title, content ?? ann.content, is_active ?? ann.is_active, id);

  res.json({ message: '公告已更新' });
});

// 删除公告
router.delete('/announcements/:id', (req, res) => {
  const { id } = req.params;

  const db = getDb();
  const ann = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);
  
  if (!ann) {
    return res.status(404).json({ error: '公告不存在' });
  }

  db.prepare('DELETE FROM announcements WHERE id = ?').run(parseInt(id));
  res.json({ message: '公告已删除' });
});

export default router;
