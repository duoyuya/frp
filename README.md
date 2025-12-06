# FRP Panel - 内网穿透管理平台

一个现代化的 FRP 内网穿透管理面板，支持用户注册、端口管理、流量统计等功能。

## 功能特性

- 🔐 用户系统：邮箱注册、邮箱验证、密码找回
- 🚀 端口管理：每用户最多5个端口，支持TCP/UDP
- 📊 流量统计：1/12/24/48小时流量趋势图
- 👨‍💼 管理后台：用户管理、端口管理、全局统计
- 🐳 Docker部署：一键部署，资源占用低
- 🔒 安全优先：限流、JWT认证、密码加密

## 快速部署

```bash
# 下载
curl -sSL https://raw.githubusercontent.com/duoyuya/frp/refs/heads/main/install.sh -o install.sh
# 赋权
chmod +x install.sh
# 运行
sudo ./install.sh
```

## 手动部署

```bash
# 拉取镜像
docker pull ghcr.io/duoyuya/frp:latest

# 运行
docker run -d \
  --name frp-panel \
  -p 3000:3000 \
  -p 7000:7000 \
  -p 7500:7500 \
  -p 10000-60000:10000-60000 \
  -v frp-data:/app/data \
  -v frp-config:/app/frp \
  -e JWT_SECRET=your-secret \
  -e ADMIN_PASSWORD=your-password \
  -e FRP_TOKEN=your-frp-token \
  ghcr.io/YOUR_USERNAME/frp-panel:latest
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 3000 | 面板端口 |
| JWT_SECRET | - | JWT密钥(必须修改) |
| ADMIN_USERNAME | admin | 管理员账号 |
| ADMIN_PASSWORD | admin123456 | 管理员密码 |
| FRP_BIND_PORT | 7000 | FRP服务端口 |
| FRP_TOKEN | - | FRP认证Token |
| FRP_DASHBOARD_PORT | 7500 | FRP控制台端口 |
| USER_PORT_MIN | 10000 | 用户端口最小值 |
| USER_PORT_MAX | 60000 | 用户端口最大值 |
| USER_PORT_LIMIT | 5 | 每用户端口数限制 |
| SMTP_* | - | 邮件服务配置 |

## 客户端配置

登录面板后，在端口管理页面可以看到客户端配置示例。

## License

MIT

