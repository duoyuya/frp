import requests
import time
import logging
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import os

from app.database import SessionLocal, engine
from app import models, crud
from app.core.config import settings

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("/app/logs/monitor.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 创建数据库表
models.Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_frp_stats():
    """
    获取FRP服务端统计信息
    """
    try:
        url = f"http://{settings.FRPS_ADDR.replace('7000', '7500')}/api/proxies"
        response = requests.get(url, auth=('admin', 'admin'), timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"获取FRP统计信息失败: {str(e)}")
        return None

def update_traffic_stats():
    """
    更新流量统计信息
    """
    db = next(get_db())
    
    try:
        stats = get_frp_stats()
        if not stats:
            return
        
        # 处理每个代理的流量
        for proxy in stats.get('proxies', []):
            if proxy.get('type') != 'tcp':
                continue
                
            port_number = proxy.get('remote_port')
            if not port_number:
                continue
                
            # 查找对应的端口记录
            port = crud.get_port_by_number(db, port_number=port_number)
            if not port:
                continue
                
            # 计算流量
            upload_bytes = proxy.get('traffic_out', 0)
            download_bytes = proxy.get('traffic_in', 0)
            
            # 创建流量记录
            crud.create_traffic_record(
                db=db,
                user_id=port.user_id,
                port_id=port.id,
                upload_bytes=upload_bytes,
                download_bytes=download_bytes
            )
            
            logger.info(f"更新端口 {port_number} 流量: 上传 {upload_bytes} bytes, 下载 {download_bytes} bytes")
            
    except Exception as e:
        logger.error(f"更新流量统计失败: {str(e)}")
    finally:
        db.close()

def main():
    logger.info("流量监控服务启动")
    
    while True:
        try:
            update_traffic_stats()
            time.sleep(settings.MONITOR_INTERVAL)
        except KeyboardInterrupt:
            logger.info("流量监控服务停止")
            break
        except Exception as e:
            logger.error(f"监控服务错误: {str(e)}")
            time.sleep(60)

if __name__ == "__main__":
    main()