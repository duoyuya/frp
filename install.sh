#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
DEFAULT_PANEL_PORT=3000
DEFAULT_FRP_PORT=7000
DEFAULT_FRP_DASHBOARD_PORT=7500
DEFAULT_ADMIN_USER="admin"
DEFAULT_ADMIN_PASS="admin123456"
DEFAULT_FRP_TOKEN="frp-token-$(openssl rand -hex 8)"
DEFAULT_JWT_SECRET="jwt-secret-$(openssl rand -hex 16)"
DEFAULT_PORT_MIN=10000
DEFAULT_PORT_MAX=60000

INSTALL_DIR="/opt/frp-panel"
COMPOSE_FILE="$INSTALL_DIR/docker-compose.yml"
ENV_FILE="$INSTALL_DIR/.env"

print_banner() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════╗"
    echo "║       FRP Panel 一键部署脚本              ║"
    echo "║       内网穿透管理平台                    ║"
    echo "╚═══════════════════════════════════════════╝"
    echo -e "${NC}"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}请使用 root 用户运行此脚本${NC}"
        exit 1
    fi
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${YELLOW}Docker 未安装，正在安装...${NC}"
        curl -fsSL https://get.docker.com | sh
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo -e "${YELLOW}Docker Compose 未安装，正在安装...${NC}"
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
            -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi
}

get_mirror() {
    echo -e "${YELLOW}是否使用镜像加速拉取? (适用于国内服务器)${NC}"
    echo "1) 不使用加速 (默认)"
    echo "2) 使用自定义加速源"
    read -p "请选择 [1-2]: " mirror_choice
    
    case $mirror_choice in
        2)
            read -p "请输入加速源地址 (如: ghcr.nju.edu.cn): " MIRROR_URL
            if [ -n "$MIRROR_URL" ]; then
                IMAGE_PREFIX="$MIRROR_URL"
                echo -e "${GREEN}将使用加速源: $MIRROR_URL${NC}"
            fi
            ;;
        *)
            IMAGE_PREFIX="ghcr.io"
            ;;
    esac
}

get_config() {
    echo -e "\n${BLUE}=== 配置设置 ===${NC}\n"
    
    read -p "面板端口 [$DEFAULT_PANEL_PORT]: " PANEL_PORT
    PANEL_PORT=${PANEL_PORT:-$DEFAULT_PANEL_PORT}
    
    read -p "FRP服务端口 [$DEFAULT_FRP_PORT]: " FRP_PORT
    FRP_PORT=${FRP_PORT:-$DEFAULT_FRP_PORT}
    
    read -p "FRP控制台端口 [$DEFAULT_FRP_DASHBOARD_PORT]: " FRP_DASHBOARD_PORT
    FRP_DASHBOARD_PORT=${FRP_DASHBOARD_PORT:-$DEFAULT_FRP_DASHBOARD_PORT}
    
    read -p "管理员账号 [$DEFAULT_ADMIN_USER]: " ADMIN_USER
    ADMIN_USER=${ADMIN_USER:-$DEFAULT_ADMIN_USER}
    
    read -p "管理员密码 [$DEFAULT_ADMIN_PASS]: " ADMIN_PASS
    ADMIN_PASS=${ADMIN_PASS:-$DEFAULT_ADMIN_PASS}
    
    read -p "FRP Token [随机生成]: " FRP_TOKEN
    FRP_TOKEN=${FRP_TOKEN:-$DEFAULT_FRP_TOKEN}
    
    read -p "JWT密钥 [随机生成]: " JWT_SECRET
    JWT_SECRET=${JWT_SECRET:-$DEFAULT_JWT_SECRET}
    
    read -p "用户端口范围最小值 [$DEFAULT_PORT_MIN]: " PORT_MIN
    PORT_MIN=${PORT_MIN:-$DEFAULT_PORT_MIN}
    
    read -p "用户端口范围最大值 [$DEFAULT_PORT_MAX]: " PORT_MAX
    PORT_MAX=${PORT_MAX:-$DEFAULT_PORT_MAX}
    
    echo -e "\n${BLUE}=== 邮件配置 (可选) ===${NC}\n"
    read -p "SMTP服务器: " SMTP_HOST
    read -p "SMTP端口 [587]: " SMTP_PORT
    SMTP_PORT=${SMTP_PORT:-587}
    read -p "SMTP用户名: " SMTP_USER
    read -p "SMTP密码: " SMTP_PASS
    read -p "发件人邮箱: " SMTP_FROM
}

create_compose_file() {
    mkdir -p "$INSTALL_DIR"
    
    cat > "$COMPOSE_FILE" << EOF
version: '3.8'

services:
  frp-panel:
    image: ghcr.io/duoyuya/frp:latest
    container_name: frp-panel
    restart: unless-stopped
    ports:
      - "\${PANEL_PORT}:3000"
      - "\${FRP_BIND_PORT}:7000"
      - "\${FRP_DASHBOARD_PORT}:7500"
      - "\${USER_PORT_MIN}-\${USER_PORT_MAX}:\${USER_PORT_MIN}-\${USER_PORT_MAX}"
    volumes:
      - frp-data:/app/data
      - frp-config:/app/frp
    environment:
      - NODE_ENV=production
      - PORT=3000
      - JWT_SECRET=\${JWT_SECRET}
      - ADMIN_USERNAME=\${ADMIN_USERNAME}
      - ADMIN_PASSWORD=\${ADMIN_PASSWORD}
      - SMTP_HOST=\${SMTP_HOST}
      - SMTP_PORT=\${SMTP_PORT}
      - SMTP_USER=\${SMTP_USER}
      - SMTP_PASS=\${SMTP_PASS}
      - SMTP_FROM=\${SMTP_FROM}
      - FRP_BIND_PORT=\${FRP_BIND_PORT}
      - FRP_TOKEN=\${FRP_TOKEN}
      - FRP_DASHBOARD_PORT=\${FRP_DASHBOARD_PORT}
      - USER_PORT_MIN=\${USER_PORT_MIN}
      - USER_PORT_MAX=\${USER_PORT_MAX}
      - USER_PORT_LIMIT=5
      - DB_PATH=/app/data/frp-panel.db
    mem_limit: 512m
    cpus: 0.5

volumes:
  frp-data:
  frp-config:
EOF
}

create_env_file() {
    cat > "$ENV_FILE" << EOF
GITHUB_USER=duoyuya
PANEL_PORT=$PANEL_PORT
FRP_BIND_PORT=$FRP_PORT
FRP_DASHBOARD_PORT=$FRP_DASHBOARD_PORT
ADMIN_USERNAME=$ADMIN_USER
ADMIN_PASSWORD=$ADMIN_PASS
FRP_TOKEN=$FRP_TOKEN
JWT_SECRET=$JWT_SECRET
USER_PORT_MIN=$PORT_MIN
USER_PORT_MAX=$PORT_MAX
SMTP_HOST=$SMTP_HOST
SMTP_PORT=$SMTP_PORT
SMTP_USER=$SMTP_USER
SMTP_PASS=$SMTP_PASS
SMTP_FROM=$SMTP_FROM
EOF
    chmod 600 "$ENV_FILE"
}

install() {
    print_banner
    check_root
    check_docker
    get_mirror
    get_config
    create_compose_file
    create_env_file
    
    echo -e "\n${YELLOW}正在拉取镜像...${NC}"
    cd "$INSTALL_DIR"
    docker-compose pull || docker compose pull
    
    echo -e "${YELLOW}正在启动服务...${NC}"
    docker-compose up -d || docker compose up -d
    
    echo -e "\n${GREEN}════════════════════════════════════════${NC}"
    echo -e "${GREEN}安装完成!${NC}"
    echo -e "${GREEN}════════════════════════════════════════${NC}"
    echo -e "面板地址: http://YOUR_IP:$PANEL_PORT"
    echo -e "管理员账号: $ADMIN_USER"
    echo -e "管理员密码: $ADMIN_PASS"
    echo -e "FRP端口: $FRP_PORT"
    echo -e "FRP Token: $FRP_TOKEN"
    echo -e "\n配置文件: $ENV_FILE"
}

update() {
    print_banner
    check_root
    
    if [ ! -f "$COMPOSE_FILE" ]; then
        echo -e "${RED}未找到安装，请先运行安装${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}是否使用镜像加速? (适用于国内服务器)${NC}"
    echo "1) 不使用加速 (默认)"
    echo "2) 使用自定义加速源"
    read -p "请选择 [1-2]: " mirror_choice
    
    case $mirror_choice in
        2)
            read -p "请输入加速源地址: " MIRROR_URL
            if [ -n "$MIRROR_URL" ]; then
                sed -i "s|ghcr.io|$MIRROR_URL|g" "$COMPOSE_FILE"
            fi
            ;;
    esac
    
    cd "$INSTALL_DIR"
    echo -e "${YELLOW}正在拉取最新镜像...${NC}"
    docker-compose pull || docker compose pull
    
    echo -e "${YELLOW}正在重启服务...${NC}"
    docker-compose up -d || docker compose up -d
    
    echo -e "${GREEN}更新完成!${NC}"
}

uninstall() {
    print_banner
    check_root
    
    echo -e "${RED}警告: 这将删除所有数据!${NC}"
    read -p "确定要卸载吗? (输入 yes 确认): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo "已取消"
        exit 0
    fi
    
    if [ -f "$COMPOSE_FILE" ]; then
        cd "$INSTALL_DIR"
        docker-compose down -v || docker compose down -v
    fi
    
    rm -rf "$INSTALL_DIR"
    
    echo -e "${GREEN}卸载完成!${NC}"
}

show_menu() {
    print_banner
    echo "请选择操作:"
    echo "1) 安装"
    echo "2) 更新"
    echo "3) 卸载"
    echo "4) 查看状态"
    echo "5) 查看日志"
    echo "6) 重启服务"
    echo "0) 退出"
    echo ""
    read -p "请输入选项 [0-6]: " choice
    
    case $choice in
        1) install ;;
        2) update ;;
        3) uninstall ;;
        4)
            cd "$INSTALL_DIR" 2>/dev/null && (docker-compose ps || docker compose ps) || echo "服务未安装"
            ;;
        5)
            cd "$INSTALL_DIR" 2>/dev/null && (docker-compose logs -f --tail=100 || docker compose logs -f --tail=100) || echo "服务未安装"
            ;;
        6)
            cd "$INSTALL_DIR" 2>/dev/null && (docker-compose restart || docker compose restart) && echo -e "${GREEN}重启完成${NC}" || echo "服务未安装"
            ;;
        0) exit 0 ;;
        *) echo -e "${RED}无效选项${NC}" ;;
    esac
}

# Main
case "${1:-}" in
    install) install ;;
    update) update ;;
    uninstall) uninstall ;;
    *) show_menu ;;
esac
