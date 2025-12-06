#!/bin/bash
set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_info "====================================="
log_info "FRP Panel 构建测试脚本"
log_info "====================================="
echo

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    log_error "Docker未安装，请先安装Docker"
    exit 1
fi

# 检查Docker Compose是否安装
if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

# 测试前端构建
log_info "测试前端构建..."
if docker-compose -f docker-compose.test.yml build frontend-test; then
    log_success "前端构建测试通过"
else
    log_error "前端构建测试失败"
    exit 1
fi

# 测试后端构建
log_info "测试后端构建..."
if docker-compose -f docker-compose.test.yml build backend-test; then
    log_success "后端构建测试通过"
else
    log_error "后端构建测试失败"
    exit 1
fi

# 测试监控服务构建
log_info "测试监控服务构建..."
if docker-compose -f docker-compose.test.yml build monitor-test; then
    log_success "监控服务构建测试通过"
else
    log_error "监控服务构建测试失败"
    exit 1
fi

echo
log_success "====================================="
log_success "所有构建测试通过！"
log_success "====================================="
log_info "项目可以正常构建和部署"