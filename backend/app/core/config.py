import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

class Settings(BaseSettings):
    # 应用配置
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "default-secret-key")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24小时
    
    # 数据库配置
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://frp_user:frp_password@postgres:5432/frp_panel")
    
    # FRP配置
    FRPS_TOKEN: str = os.getenv("FRPS_TOKEN", "default-frps-token")
    FRPS_ADDR: str = os.getenv("FRPS_ADDR", "frps:7000")
    MAX_PORTS_PER_USER: int = 5
    MIN_PORT: int = 20000
    MAX_PORT: int = 21000
    
    # 邮件配置
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.example.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", 587))
    SMTP_USER: str = os.getenv("SMTP_USER", "your-email@example.com")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "your-email-password")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "noreply@example.com")
    
    # 监控配置
    MONITOR_INTERVAL: int = 60  # 秒
    
    class Config:
        case_sensitive = True

settings = Settings()