import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

def send_email(to_email: str, subject: str, content: str) -> bool:
    """
    发送电子邮件
    """
    try:
        # 创建邮件
        msg = MIMEMultipart()
        msg['From'] = settings.SMTP_FROM
        msg['To'] = to_email
        msg['Subject'] = subject
        
        # 添加邮件内容
        msg.attach(MIMEText(content, 'html'))
        
        # 发送邮件
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        
        logger.info(f"邮件已发送至: {to_email}, 主题: {subject}")
        return True
        
    except Exception as e:
        logger.error(f"发送邮件失败: {str(e)}")
        return False

def send_verification_email(email: str, token: str) -> bool:
    """
    发送邮箱验证邮件
    """
    subject = "FRP Panel - 邮箱验证"
    verification_url = f"http://{settings.SMTP_HOST}/verify-email?token={token}"
    
    content = f"""
    <html>
    <body>
        <h2>FRP Panel 邮箱验证</h2>
        <p>请点击以下链接验证您的邮箱：</p>
        <p><a href="{verification_url}">验证邮箱</a></p>
        <p>如果您没有注册FRP Panel账号，请忽略此邮件。</p>
        <p>此链接24小时内有效。</p>
    </body>
    </html>
    """
    
    return send_email(email, subject, content)

def send_reset_password_email(email: str, token: str) -> bool:
    """
    发送重置密码邮件
    """
    subject = "FRP Panel - 重置密码"
    reset_url = f"http://{settings.SMTP_HOST}/reset-password?token={token}"
    
    content = f"""
    <html>
    <body>
        <h2>FRP Panel 重置密码</h2>
        <p>请点击以下链接重置您的密码：</p>
        <p><a href="{reset_url}">重置密码</a></p>
        <p>如果您没有请求重置密码，请忽略此邮件。</p>
        <p>此链接1小时内有效。</p>
    </body>
    </html>
    """
    
    return send_email(email, subject, content)