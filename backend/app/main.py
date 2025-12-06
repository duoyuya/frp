from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import os
import logging

from app.database import SessionLocal, engine
from app import models, schemas, crud
from app.core.security import create_access_token, verify_password, get_password_hash
from app.core.config import settings
from app.api.api_v1.api import api_router

# 创建数据库表
models.Base.metadata.create_all(bind=engine)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("/app/logs/app.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="FRP Panel API",
    description="FRP内网穿透管理平台API",
    version="1.0.0"
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载静态文件
app.mount("/static", StaticFiles(directory="static"), name="static")

# 路由注册
app.include_router(api_router, prefix="/api/v1")

# 依赖项
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")

# 获取当前用户
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    user = crud.get_user_by_token(db, token=token)
    if user is None:
        raise credentials_exception
    return user

# 获取当前管理员用户
def get_current_admin_user(current_user: schemas.User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

# 根路径
@app.get("/")
def read_root():
    return {"message": "Welcome to FRP Panel API", "version": "1.0.0"}

# 健康检查
@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# 登录接口
@app.post("/token", response_model=schemas.Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "is_admin": user.is_admin},
        expires_delta=access_token_expires
    )
    
    # 更新最后登录时间
    crud.update_user_last_login(db, user_id=user.id)
    
    return {"access_token": access_token, "token_type": "bearer"}

# 获取当前用户信息
@app.get("/users/me/", response_model=schemas.User)
def read_users_me(current_user: schemas.User = Depends(get_current_user)):
    return current_user

# 获取当前用户的端口
@app.get("/users/me/ports", response_model=list[schemas.Port])
def read_my_ports(
    current_user: schemas.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_ports_by_user(db, user_id=current_user.id)

# 创建端口
@app.post("/users/me/ports", response_model=schemas.Port)
def create_port(
    port: schemas.PortCreate,
    current_user: schemas.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 检查用户端口数量
    user_ports = crud.get_ports_by_user(db, user_id=current_user.id)
    if len(user_ports) >= settings.MAX_PORTS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum {settings.MAX_PORTS_PER_USER} ports allowed per user"
        )
    
    # 检查端口是否可用
    if port.port_number < settings.MIN_PORT or port.port_number > settings.MAX_PORT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Port must be between {settings.MIN_PORT} and {settings.MAX_PORT}"
        )
    
    if crud.get_port_by_number(db, port_number=port.port_number):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Port already in use"
        )
    
    return crud.create_port(db=db, port=port, user_id=current_user.id)

# 删除端口
@app.delete("/users/me/ports/{port_id}", response_model=schemas.Port)
def delete_port(
    port_id: int,
    current_user: schemas.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    port = crud.get_port(db, port_id=port_id)
    if port is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Port not found"
        )
    
    if port.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    return crud.delete_port(db=db, port_id=port_id)

# 管理员获取所有用户
@app.get("/admin/users", response_model=list[schemas.User])
def read_all_users(
    skip: int = 0,
    limit: int = 100,
    current_user: schemas.User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    return crud.get_users(db, skip=skip, limit=limit)

# 管理员获取所有端口
@app.get("/admin/ports", response_model=list[schemas.Port])
def read_all_ports(
    skip: int = 0,
    limit: int = 100,
    current_user: schemas.User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    return crud.get_ports(db, skip=skip, limit=limit)

# 管理员删除用户
@app.delete("/admin/users/{user_id}", response_model=schemas.User)
def delete_user(
    user_id: int,
    current_user: schemas.User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    user = crud.get_user(db, user_id=user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if user.is_admin and user.id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete other admin users"
        )
    
    return crud.delete_user(db=db, user_id=user_id)

# 获取流量统计
@app.get("/stats/traffic", response_model=schemas.TrafficStats)
def get_traffic_stats(
    time_range: str = "24h",
    current_user: schemas.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return crud.get_traffic_stats(db, user_id=current_user.id, time_range=time_range)

# 管理员获取所有流量统计
@app.get("/admin/stats/traffic", response_model=schemas.TrafficStats)
def get_all_traffic_stats(
    time_range: str = "24h",
    current_user: schemas.User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    return crud.get_all_traffic_stats(db, time_range=time_range)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)