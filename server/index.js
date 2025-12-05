import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
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

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:5173'],
  credentials: true
}));

// 限流
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: '请求过于频繁，请稍后再试' }
});
app.use('/api/', limiter);

// 登录限流更严格
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: '登录尝试过多，请15分钟后再试' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use(express.json({ limit: '1mb' }));
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
