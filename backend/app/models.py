from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    email_verified = Column(Boolean, default=False)
    verification_token = Column(String, index=True, nullable=True)
    reset_password_token = Column(String, index=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # 关系
    ports = relationship("Port", back_populates="owner")
    traffic_records = relationship("TrafficRecord", back_populates="user")

class Port(Base):
    __tablename__ = "ports"
    
    id = Column(Integer, primary_key=True, index=True)
    port_number = Column(Integer, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    proxy_type = Column(String, default="tcp")
    local_ip = Column(String, default="127.0.0.1")
    local_port = Column(Integer, default=22)
    custom_domain = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # 外键
    user_id = Column(Integer, ForeignKey("users.id"))
    
    # 关系
    owner = relationship("User", back_populates="ports")
    traffic_records = relationship("TrafficRecord", back_populates="port")

class TrafficRecord(Base):
    __tablename__ = "traffic_records"
    
    id = Column(Integer, primary_key=True, index=True)
    upload_bytes = Column(Float, default=0)
    download_bytes = Column(Float, default=0)
    record_time = Column(DateTime(timezone=True), server_default=func.now())
    
    # 外键
    user_id = Column(Integer, ForeignKey("users.id"))
    port_id = Column(Integer, ForeignKey("ports.id"), nullable=True)
    
    # 关系
    user = relationship("User", back_populates="traffic_records")
    port = relationship("Port", back_populates="traffic_records")

class SystemConfig(Base):
    __tablename__ = "system_config"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(String, nullable=False)
    description = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())