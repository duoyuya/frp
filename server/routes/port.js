import { Router } from 'express';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { updateFrpConfig } from '../utils/frp.js';

const router = Router();
const PORT_MIN = parseInt(process.env.USER_PORT_MIN) || 10000;
const PORT_MAX = parseInt(process.env.USER_PORT_MAX) || 60000;
const PORT_LIMIT = parseInt(process.env.USER_PORT_LIMIT) || 5;

router.use(authMiddleware);

// 获取用户端口
router.get('/', (req, res) => {
  const db = getDb();
  const ports = db.prepare(`
    SELECT id, port, name, protocol, is_active, created_at FROM ports WHERE user_id = ?
  `).all(req.user.id);
  
  res.json({ ports, limit: PORT_LIMIT });
});

// 申请端口
router.post('/', (req, res, next) => {
  try {
    const { port, name, protocol = 'tcp' } = req.body;
    const portNum = parseInt(port);

    if (!portNum || portNum < PORT_MIN || portNum > PORT_MAX) {
      return res.status(400).json({ error: `端口范围: ${PORT_MIN}-${PORT_MAX}` });
    }

    if (!['tcp', 'udp'].includes(protocol)) {
      return res.status(400).json({ error: '协议只支持 tcp 或 udp' });
    }

    const db = getDb();
    
    // 检查端口数量限制
    const count = db.prepare('SELECT COUNT(*) as count FROM ports WHERE user_id = ?').get(req.user.id);
    if (count.count >= PORT_LIMIT) {
      return res.status(400).json({ error: `最多只能申请 ${PORT_LIMIT} 个端口` });
    }

    // 检查端口是否已被占用
    const existing = db.prepare('SELECT id FROM ports WHERE port = ?').get(portNum);
    if (existing) {
      return res.status(400).json({ error: '该端口已被占用' });
    }

    const result = db.prepare(`
      INSERT INTO ports (user_id, port, name, protocol) VALUES (?, ?, ?, ?)
    `).run(req.user.id, portNum, name || `端口${portNum}`, protocol);

    updateFrpConfig();

    res.json({ 
      message: '端口申请成功',
      port: { id: result.lastInsertRowid, port: portNum, name, protocol }
    });
  } catch (err) {
    next(err);
  }
});

// 修改端口
router.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;

    const db = getDb();
    const port = db.prepare('SELECT * FROM ports WHERE id = ? AND user_id = ?').get(id, req.user.id);
    
    if (!port) {
      return res.status(404).json({ error: '端口不存在' });
    }

    db.prepare('UPDATE ports SET name = ?, is_active = ? WHERE id = ?')
      .run(name ?? port.name, is_active ?? port.is_active, id);

    updateFrpConfig();

    res.json({ message: '端口更新成功' });
  } catch (err) {
    next(err);
  }
});

// 删除端口
router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;

    const db = getDb();
    const port = db.prepare('SELECT * FROM ports WHERE id = ? AND user_id = ?').get(id, req.user.id);
    
    if (!port) {
      return res.status(404).json({ error: '端口不存在' });
    }

    db.prepare('DELETE FROM ports WHERE id = ?').run(id);
    updateFrpConfig();

    res.json({ message: '端口删除成功' });
  } catch (err) {
    next(err);
  }
});

// 随机获取可用端口
router.get('/random', (req, res) => {
  const db = getDb();
  const usedPorts = db.prepare('SELECT port FROM ports').all().map(p => p.port);
  
  let attempts = 0;
  let randomPort;
  
  do {
    randomPort = Math.floor(Math.random() * (PORT_MAX - PORT_MIN + 1)) + PORT_MIN;
    attempts++;
  } while (usedPorts.includes(randomPort) && attempts < 100);

  if (attempts >= 100) {
    return res.status(500).json({ error: '无法找到可用端口' });
  }

  res.json({ port: randomPort });
});

export default router;
