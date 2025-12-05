import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return transporter;
}

export async function sendVerifyEmail(email, token, baseUrl) {
  const verifyUrl = `${baseUrl}/verify?token=${token}`;
  
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'FRP Panel - 邮箱验证',
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: sans-serif;">
        <h2 style="color: #4f46e5;">欢迎注册 FRP Panel</h2>
        <p>请点击下方按钮验证您的邮箱：</p>
        <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">验证邮箱</a>
        <p style="margin-top: 20px; color: #666;">如果按钮无法点击，请复制以下链接到浏览器：</p>
        <p style="color: #4f46e5; word-break: break-all;">${verifyUrl}</p>
        <p style="margin-top: 30px; color: #999; font-size: 12px;">此链接24小时内有效</p>
      </div>
    `
  });
}

export async function sendResetEmail(email, token, baseUrl) {
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'FRP Panel - 重置密码',
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: sans-serif;">
        <h2 style="color: #4f46e5;">重置密码</h2>
        <p>您请求重置密码，请点击下方按钮：</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px;">重置密码</a>
        <p style="margin-top: 20px; color: #666;">如果按钮无法点击，请复制以下链接到浏览器：</p>
        <p style="color: #4f46e5; word-break: break-all;">${resetUrl}</p>
        <p style="margin-top: 30px; color: #999; font-size: 12px;">此链接1小时内有效。如果您没有请求重置密码，请忽略此邮件。</p>
      </div>
    `
  });
}
