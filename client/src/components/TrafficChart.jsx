import { useEffect, useRef } from 'react';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function TrafficChart({ data, title }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!data?.length || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    const maxValue = Math.max(
      ...data.map(d => Math.max(d.upload || 0, d.download || 0)),
      1
    );

    // 绘制网格
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      ctx.fillStyle = '#9ca3af';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      const value = maxValue - (maxValue / 4) * i;
      ctx.fillText(formatBytes(value), padding.left - 8, y + 4);
    }

    // 绘制上传线
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = padding.left + (chartWidth / (data.length - 1 || 1)) * i;
      const y = padding.top + chartHeight - (d.upload / maxValue) * chartHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 绘制下载线
    ctx.strokeStyle = '#10b981';
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = padding.left + (chartWidth / (data.length - 1 || 1)) * i;
      const y = padding.top + chartHeight - (d.download / maxValue) * chartHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // X轴标签
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const step = Math.ceil(data.length / 6);
    data.forEach((d, i) => {
      if (i % step === 0) {
        const x = padding.left + (chartWidth / (data.length - 1 || 1)) * i;
        const label = d.time_bucket?.split(' ')[1] || '';
        ctx.fillText(label, x, height - 10);
      }
    });

  }, [data]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-primary-500"></span>
            上传
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            下载
          </span>
        </div>
      </div>
      <canvas ref={canvasRef} className="w-full h-48"></canvas>
    </div>
  );
}
