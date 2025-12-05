export function errorHandler(err, req, res, next) {
  console.error('Error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: '未授权访问' });
  }
  
  res.status(500).json({ error: '服务器内部错误' });
}
