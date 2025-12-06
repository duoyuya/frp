# 构建阶段
FROM node:18-alpine AS build
WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖（使用国内镜像加速）
RUN npm install --registry=https://registry.npmmirror.com

# 复制项目文件
COPY . .

# 构建项目
RUN npm run build

# 生产环境
FROM nginx:alpine

# 复制构建产物
COPY --from=build /app/dist /var/www/html

# 复制nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动nginx
CMD ["nginx", "-g", "daemon off;"]