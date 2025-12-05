import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import { getDb } from '../db/index.js';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { sendVerifyEmail, sendResetEmail } from '../utils/email.js';

const router = Router();

// 注册
router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ error: '请输入有效的邮箱地址' });
    }
    
    if (!password || password.length < 8) {
      return res.status(400).json({ error: '密码至少8位' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: '该邮箱已注册' });
    }

    const hashedPass = await bcrypt.hash(password, 10);
    const verifyToken = uuidv4();
    
    db.prepare(`
      INSERT INTO users (email, password, verify_token) VALUES (?, ?, ?)
    `).run(email, hashedPass, verifyToken);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    try {
      await sendVerifyEmail(email, verifyToken, baseUrl);
    } catch (emailErr) {
      console.error('发送验证邮件失败:', emailErr);
    }

    res.json({ message: '注册成功，请查收验证邮件' });
  } catch (err) {
    next(err);
  }
});

// 验证邮箱
router.get('/verify', (req, res) => {
  const { token } = req.query;
  
  if (!token) {
    return res.status(400).json({ error: '无效的验证链接' });
  }

  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE verify_token = ?').get(token);
  
  if (!user) {
    return res.status(400).json({ error: '验证链接无效或已过期' });
  }

  db.prepare('UPDATE users SET is_active = 1, verify_token = NULL WHERE id = ?').run(user.id);
  res.json({ message: '邮箱验证成功，请登录' });
});

// 登录
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    
    if (!user) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: '请先验证邮箱' });
    }

    const token = generateToken(user);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      user: { id: user.id, email: user.email, isAdmin: !!user.is_admin }
    });
  } catch (err) {
    next(err);
  }
});

// 登出
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: '已登出' });
});

// 获取当前用户
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    user: { id: req.user.id, email: req.user.email, isAdmin: !!req.user.is_admin }
  });
});

// 忘记密码
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    
    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    
    // 不透露用户是否存在
    if (!user) {
      return res.json({ message: '如果邮箱存在，重置链接已发送' });
    }

    const resetToken = uuidv4();
    const expires = Math.floor(Date.now() / 1000) + 3600; // 1小时
    
    db.prepare('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?')
      .run(resetToken, expires, user.id);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    try {
      await sendResetEmail(email, resetToken, baseUrl);
    } catch (emailErr) {
      console.error('发送重置邮件失败:', emailErr);
    }

    res.json({ message: '如果邮箱存在，重置链接已发送' });
  } catch (err) {
    next(err);
  }
});

// 重置密码
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    
    if (!password || password.length < 8) {
      return res.status(400).json({ error: '密码至少8位' });
    }

    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    const user = db.prepare(
      'SELECT id FROM users WHERE reset_token = ? AND reset_expires > ?'
    ).get(token, now);
    
    if (!user) {
      return res.status(400).json({ error: '重置链接无效或已过期' });
    }

    const hashedPass = await bcrypt.hash(password, 10);
    db.prepare(
      'UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?'
    ).run(hashedPass, user.id);

    res.json({ message: '密码重置成功' });
  } catch (err) {
    next(err);
  }
});

export default router;
