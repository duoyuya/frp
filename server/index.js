import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { initDatabase } from './db/index.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import portRoutes from './routes/port.js';
import statsRoutes from './routes/stats.js';
import { errorHandler } from './middleware/error.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// 简单安全头
app.disable('x-powered-by');
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173'],
  credentials: true
}));

// 简单限流 (内存友好)
const rateLimit = new Map();
app.use('/api/', (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const windowMs = 60000;
  const max = 60;
  
  if (!rateLimit.has(ip)) {
    rateLimit.set(ip, { count: 1, start: now });
  } else {
    const data = rateLimit.get(ip);
    if (now - data.start > windowMs) {
      rateLimit.set(ip, { count: 1, start: now });
    } else if (data.count >= max) {
      return res.status(429).json({ error: '请求过于频繁' });
    } else {
      data.count++;
    }
  }
  next();
});

// 定期清理限流记录
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimit) {
    if (now - data.start > 60000) rateLimit.delete(ip);
  }
}, 60000);

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ports', portRoutes);
app.use('/api/stats', statsRoutes);

// 静态文件
app.use(express.static(path.join(__dirname, '../dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.use(errorHandler);

// 初始化
async function start() {
  try {
    await initDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`服务器运行在端口 ${PORT}`);
    });
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
}

start();
