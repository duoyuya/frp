import jwt from 'jsonwebtoken';
import { getDb } from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-this';

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, isAdmin: user.is_admin },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export function authMiddleware(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const decoded = verifyToken(token);
    const db = getDb();
    const user = db.prepare('SELECT id, email, is_admin, is_active FROM users WHERE id = ?').get(decoded.id);
    
    if (!user || !user.is_active) {
      return res.status(401).json({ error: '账号已禁用或不存在' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期' });
  }
}

export function adminMiddleware(req, res, next) {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
}
