#!/bin/bash
set -e

# 脚本版本
VERSION="2.2.0"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查root权限
check_root() {
    if [ "$(id -u)" != "0" ]; then
        log_error "请使用root用户运行此脚本"
        exit 1
    fi
}

# 显示帮助信息
show_help() {
    echo "FRP Panel 一键管理脚本 v$VERSION"
    echo "Usage: $0 [command]"
    echo "Commands:"
    echo "  install   - 安装FRP Panel"
    echo "  update    - 更新FRP Panel"
    echo "  uninstall - 卸载FRP Panel"
    echo "  help      - 显示帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 install   - 安装FRP Panel"
    echo "  $0 update    - 更新FRP Panel"
    echo "  $0 uninstall - 卸载FRP Panel"
}

# 检查依赖
check_dependencies() {
    log_info "检查系统依赖..."
    
    local dependencies=("curl" "git" "docker" "docker-compose")
    local missing_deps=()
    
    for dep in "${dependencies[@]}"; do
        if ! command -v $dep &> /dev/null; then
            missing_deps+=($dep)
        fi
    done
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_info "缺少以下依赖: ${missing_deps[*]}"
        read -p "是否自动安装这些依赖? (y/n) [y]: " install_deps
        install_deps=${install_deps:-y}
        
        if [ "$install_deps" = "y" ] || [ "$install_deps" = "Y" ]; then
            install_missing_dependencies "${missing_deps[@]}"
        else
            log_error "缺少必要的依赖，无法继续"
            exit 1
        fi
    else
        log_success "所有依赖都已安装"
    fi
}

# 安装缺失的依赖
install_missing_dependencies() {
    log_info "正在安装缺失的依赖..."
    
    if command -v apt &> /dev/null; then
        apt-get update
        apt-get install -y "$@"
        
        # 安装Docker
        if [[ " $* " =~ " docker " ]] && ! command -v docker &> /dev/null; then
            curl -fsSL https://get.docker.com | sh
            systemctl start docker
            systemctl enable docker
        fi
        
        # 安装Docker Compose
        if [[ " $* " =~ " docker-compose " ]] && ! command -v docker-compose &> /dev/null; then
            COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
            curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            chmod +x /usr/local/bin/docker-compose
        fi
        
    elif command -v yum &> /dev/null; then
        yum install -y "$@"
        
        # 安装Docker
        if [[ " $* " =~ " docker " ]] && ! command -v docker &> /dev/null; then
            curl -fsSL https://get.docker.com | sh
            systemctl start docker
            systemctl enable docker
        fi
        
        # 安装Docker Compose
        if [[ " $* " =~ " docker-compose " ]] && ! command -v docker-compose &> /dev/null; then
            COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
            curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            chmod +x /usr/local/bin/docker-compose
        fi
        
    else
        log_error "不支持的Linux发行版"
        exit 1
    fi
    
    log_success "依赖安装完成"
}

# 检查Docker镜像拉取能力
check_docker_pull() {
    log_info "检查Docker镜像拉取能力..."
    
    # 尝试拉取一个小的公开镜像测试
    if docker pull hello-world:latest &> /dev/null; then
        log_success "Docker镜像拉取功能正常"
        return 0
    else
        log_error "Docker镜像拉取功能异常"
        log_info "请检查Docker服务是否正常运行"
        log_info "请检查网络连接是否正常"
        exit 1
    fi
}

# 获取用户配置
get_user_config() {
    log_info "请配置FRP Panel设置"
    echo "----------------------------------------"
    
    # FRP主端口
    read -p "FRP主端口 (默认: 7000): " frp_main_port
    frp_main_port=${frp_main_port:-7000}
    
    # FRP管理面板端口
    read -p "FRP管理面板端口 (默认: 7500): " frp_dashboard_port
    frp_dashboard_port=${frp_dashboard_port:-7500}
    
    # FRP管理面板账号
    read -p "FRP管理面板用户名 (默认: admin): " frp_admin_user
    frp_admin_user=${frp_admin_user:-admin}
    
    # FRP管理面板密码
    read -s -p "FRP管理面板密码 (默认: 随机生成): " frp_admin_password
    echo
    if [ -z "$frp_admin_password" ]; then
        frp_admin_password=$(openssl rand -hex 8)
        log_info "生成的FRP管理面板密码: $frp_admin_password"
    fi
    
    # Web服务端口
    read -p "Web服务端口 (默认: 80): " web_port
    web_port=${web_port:-80}
    
    # HTTPS端口
    read -p "HTTPS端口 (默认: 443): " https_port
    https_port=${https_port:-443}
    
    # 用户端口范围
    read -p "用户端口范围起始 (默认: 20000): " min_user_port
    min_user_port=${min_user_port:-20000}
    
    read -p "用户端口范围结束 (默认: 21000): " max_user_port
    max_user_port=${max_user_port:-21000}
    
    # 管理员邮箱
    read -p "管理员邮箱 (默认: admin@example.com): " admin_email
    admin_email=${admin_email:-admin@example.com}
    
    # 管理员密码
    read -s -p "管理员密码 (默认: 随机生成): " admin_password
    echo
    if [ -z "$admin_password" ]; then
        admin_password=$(openssl rand -hex 8)
        log_info "生成的管理员密码: $admin_password"
    fi
    
    # Docker镜像加速
    read -p "是否使用Docker镜像加速? (y/n) [n]: " use_mirror
    use_mirror=${use_mirror:-n}
    
    docker_mirror=""
    if [ "$use_mirror" = "y" ] || [ "$use_mirror" = "Y" ]; then
        read -p "请输入Docker镜像加速源: " docker_mirror
        if [ -z "$docker_mirror" ]; then
            log_error "镜像加速源不能为空"
            exit 1
        fi
    fi
    
    # 保存配置
    cat > .user_config << EOF
FRP_MAIN_PORT=$frp_main_port
FRP_DASHBOARD_PORT=$frp_dashboard_port
FRP_ADMIN_USER=$frp_admin_user
FRP_ADMIN_PASSWORD=$frp_admin_password
WEB_PORT=$web_port
HTTPS_PORT=$https_port
MIN_USER_PORT=$min_user_port
MAX_USER_PORT=$max_user_port
ADMIN_EMAIL=$admin_email
ADMIN_PASSWORD=$admin_password
USE_MIRROR=$use_mirror
DOCKER_MIRROR=$docker_mirror
EOF
    
    log_success "配置已保存"
}

# 加载用户配置
load_user_config() {
    if [ -f .user_config ]; then
        source .user_config
        return 0
    fi
    return 1
}

# 配置Docker镜像加速
configure_docker_mirror() {
    if [ "$USE_MIRROR" = "y" ] || [ "$USE_MIRROR" = "Y" ] && [ -n "$DOCKER_MIRROR" ]; then
        log_info "配置Docker镜像加速: $DOCKER_MIRROR"
        
        # 创建或修改daemon.json
        mkdir -p /etc/docker
        if [ -f /etc/docker/daemon.json ]; then
            # 备份原有配置
            cp /etc/docker/daemon.json /etc/docker/daemon.json.bak
            
            # 修改配置
            jq --arg mirror "$DOCKER_MIRROR" '.registry-mirrors += [$mirror]' /etc/docker/daemon.json > /etc/docker/daemon.json.tmp
            mv /etc/docker/daemon.json.tmp /etc/docker/daemon.json
        else
            cat > /etc/docker/daemon.json << EOF
{
  "registry-mirrors": ["$DOCKER_MIRROR"]
}
EOF
        fi
        
        # 重启Docker服务
        systemctl daemon-reload
        systemctl restart docker
        
        log_success "Docker镜像加速已配置"
    fi
}

# 生成配置文件
generate_config() {
    log_info "生成配置文件..."
    
    # 创建配置目录
    mkdir -p config nginx/{conf.d,ssl}
    
    # 生成FRPS配置
    local frps_token=$(openssl rand -hex 16)
    cat > config/frps.ini << EOF
[common]
bind_addr = 0.0.0.0
bind_port = $FRP_MAIN_PORT
dashboard_addr = 0.0.0.0
dashboard_port = $FRP_DASHBOARD_PORT
dashboard_user = $FRP_ADMIN_USER
dashboard_pwd = $FRP_ADMIN_PASSWORD
token = $frps_token
log_file = /var/log/frps/frps.log
log_level = info
log_max_days = 3
max_pool_count = 50
tcp_mux = true
EOF
    
    # 生成环境变量文件
    if [ ! -f .env ]; then
        local db_password=$(openssl rand -hex 12)
        local secret_key=$(openssl rand -hex 32)
        
        cat > .env << EOF
# 数据库配置
DB_PASSWORD=$db_password

# 应用配置
SECRET_KEY=$secret_key
FRPS_TOKEN=$frps_token
MAX_PORTS_PER_USER=5
MIN_PORT=$MIN_USER_PORT
MAX_PORT=$MAX_USER_PORT

# 邮件配置（请修改为您的SMTP信息）
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-email-password
SMTP_FROM=noreply@example.com
EOF
        log_warning "请编辑.env文件配置邮件服务信息"
    fi
    
    # 生成Nginx配置
    cat > nginx/nginx.conf << EOF
user  nginx;
worker_processes  auto;

error_log  /var/log/nginx/error.log warn;
pid        /var/run/nginx.pid;

events {
    worker_connections  1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format  main  '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                      '\$status \$body_bytes_sent "\$http_referer" '
                      '"\$http_user_agent" "\$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    sendfile        on;
    #tcp_nopush     on;

    keepalive_timeout  65;

    #gzip  on;

    include /etc/nginx/conf.d/*.conf;
}
EOF
    
    # 生成Nginx站点配置
    cat > nginx/conf.d/default.conf << EOF
server {
    listen $WEB_PORT;
    server_name localhost;
    
    # 前端静态文件
    location / {
        root   /var/www/html;
        index  index.html;
        try_files \$uri \$uri/ /index.html;
    }
    
    # 后端API
    location /api {
        proxy_pass http://backend:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # FRP管理面板
    location /frps {
        proxy_pass http://frps:$FRP_DASHBOARD_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF
    
    log_success "配置文件生成完成"
}

# 启动服务
start_services() {
    log_info "启动服务..."
    
    # 检查Docker镜像拉取能力
    check_docker_pull
    
    # 配置Docker镜像加速
    configure_docker_mirror
    
    # 构建并启动容器
    docker-compose up -d --build
    
    # 等待数据库初始化
    log_info "等待数据库初始化..."
    sleep 30
    
    # 初始化数据库
    log_info "初始化数据库..."
    docker-compose exec backend alembic upgrade head
    
    # 创建管理员用户
    log_info "创建管理员用户..."
    docker-compose exec backend python -c "
from app.database import SessionLocal
from app.models import User
from app.core.security import get_password_hash

db = SessionLocal()
# 检查管理员用户是否已存在
existing_user = db.query(User).filter(User.email == '$ADMIN_EMAIL').first()
if existing_user:
    print('管理员用户已存在')
else:
    admin = User(
        email='$ADMIN_EMAIL',
        hashed_password=get_password_hash('$ADMIN_PASSWORD'),
        is_active=True,
        is_admin=True,
        email_verified=True
    )
    db.add(admin)
    db.commit()
    print('管理员用户创建完成')
"
    
    log_success "管理员用户创建完成"
    log_info "管理员邮箱: $ADMIN_EMAIL"
    log_info "管理员密码: $ADMIN_PASSWORD"
    log_info "FRP管理面板用户名: $FRP_ADMIN_USER"
    log_info "FRP管理面板密码: $FRP_ADMIN_PASSWORD"
    log_warning "请立即登录并修改管理员密码"
}

# 安装FRP Panel
install_frp_panel() {
    log_info "====================================="
    log_info "FRP Panel 安装程序 v$VERSION"
    log_info "====================================="
    echo
    
    # 检查root权限
    check_root
    
    # 检查依赖
    check_dependencies
    
    # 获取用户配置
    get_user_config
    
    # 生成配置文件
    generate_config
    
    # 启动服务
    start_services
    
    # 显示完成信息
    show_completion
}

# 更新FRP Panel
update_frp_panel() {
    log_info "====================================="
    log_info "FRP Panel 更新程序 v$VERSION"
    log_info "====================================="
    echo
    
    # 检查root权限
    check_root
    
    # 检查是否已安装
    if [ ! -f docker-compose.yml ] || [ ! -f .user_config ]; then
        log_error "未检测到已安装的FRP Panel"
        log_info "请先执行安装: $0 install"
        exit 1
    fi
    
    # 加载用户配置
    if ! load_user_config; then
        log_error "无法加载用户配置"
        exit 1
    fi
    
    # 检查Docker镜像拉取能力
    check_docker_pull
    
    log_info "正在更新FRP Panel..."
    
    # 拉取最新代码
    if [ -d ".git" ]; then
        log_info "拉取最新代码..."
        git pull
    else
        log_warning "不是git仓库，无法自动更新代码"
        log_info "请手动更新代码后再运行此命令"
        exit 1
    fi
    
    # 配置Docker镜像加速
    configure_docker_mirror
    
    # 停止现有服务
    log_info "停止现有服务..."
    docker-compose down
    
    # 拉取最新镜像
    log_info "拉取最新镜像..."
    docker-compose pull
    
    # 启动服务
    log_info "启动更新后的服务..."
    docker-compose up -d
    
    # 数据库迁移
    log_info "执行数据库迁移..."
    docker-compose exec backend alembic upgrade head
    
    log_success "FRP Panel 更新完成！"
}

# 卸载FRP Panel
uninstall_frp_panel() {
    log_info "====================================="
    log_info "FRP Panel 卸载程序 v$VERSION"
    log_info "====================================="
    echo
    
    # 检查root权限
    check_root
    
    # 确认卸载
    read -p "确定要卸载FRP Panel吗? 这将删除所有数据! (y/n) [n]: " confirm
    confirm=${confirm:-n}
    
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        log_info "卸载已取消"
        exit 0
    fi
    
    # 停止并删除容器
    log_info "停止并删除容器..."
    if [ -f docker-compose.yml ]; then
        docker-compose down -v --rmi all --remove-orphans
    fi
    
    # 删除数据卷
    log_info "删除数据卷..."
    docker volume rm frp-panel_postgres_data frp-panel_frps_logs frp-panel_backend_logs frp-panel_frontend_build frp-panel_monitor_logs 2>/dev/null || true
    
    # 删除配置文件
    log_info "删除配置文件..."
    rm -rf config nginx .env .user_config
    
    # 恢复Docker配置
    if [ -f /etc/docker/daemon.json.bak ]; then
        read -p "是否恢复Docker配置? (y/n) [y]: " restore_docker
        restore_docker=${restore_docker:-y}
        
        if [ "$restore_docker" = "y" ] || [ "$restore_docker" = "Y" ]; then
            log_info "恢复Docker配置..."
            mv /etc/docker/daemon.json.bak /etc/docker/daemon.json
            systemctl daemon-reload
            systemctl restart docker
        fi
    fi
    
    log_success "FRP Panel 已成功卸载"
    log_warning "所有数据已被删除，请确保已备份重要数据"
}

# 显示完成信息
show_completion() {
    local ip_address=$(curl -s ifconfig.me)
    
    log_success "====================================="
    log_success "FRP Panel 安装完成！"
    log_success "====================================="
    echo
    log_info "访问地址: http://$ip_address:$WEB_PORT"
    log_info "FRP管理面板: http://$ip_address:$FRP_DASHBOARD_PORT"
    log_info "FRP管理面板用户名: $FRP_ADMIN_USER"
    log_info "FRP管理面板密码: $FRP_ADMIN_PASSWORD"
    log_info "管理员邮箱: $ADMIN_EMAIL"
    log_info "管理员密码: $ADMIN_PASSWORD"
    echo
    log_info "重要提示:"
    log_info "1. 请编辑.env文件配置邮件服务"
    log_info "2. 请登录系统后修改管理员密码"
    log_info "3. 系统使用端口范围: $MIN_USER_PORT-$MAX_USER_PORT"
    echo
    log_success "安装完成，祝您使用愉快！"
}

# 主函数
main() {
    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi
    
    case "$1" in
        install)
            install_frp_panel
            ;;
        update)
            update_frp_panel
            ;;
        uninstall)
            uninstall_frp_panel
            ;;
        help)
            show_help
            ;;
        *)
            log_error "无效的命令: $1"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"