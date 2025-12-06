import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DB_PATH || './data/frp-panel.db';
let data = { users: [], ports: [], traffic: [], _autoId: { users: 0, ports: 0, traffic: 0 } };

function load() {
  try {
    if (fs.existsSync(dbPath)) {
      data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }
  } catch (e) {
    console.error('加载数据库失败:', e);
  }
}

function save() {
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('保存数据库失败:', e);
  }
}

// 定期保存
setInterval(save, 30000);

export function getDb() {
  return {
    prepare: (sql) => ({
      run: (...params) => execSQL(sql, params, 'run'),
      get: (...params) => execSQL(sql, params, 'get'),
      all: (...params) => execSQL(sql, params, 'all')
    }),
    exec: () => {}
  };
}

function execSQL(sql, params, mode) {
  const sqlLower = sql.toLowerCase().trim();
  
  // INSERT
  if (sqlLower.startsWith('insert into')) {
    const table = sql.match(/insert into (\w+)/i)?.[1];
    if (!table || !data[table]) return { lastInsertRowid: 0 };
    
    const id = ++data._autoId[table];
    const now = Math.floor(Date.now() / 1000);
    
    if (table === 'users') {
      data.users.push({ id, email: params[0], password: params[1], is_admin: params[2] || 0, is_active: params[3] || 0, verify_token: params[4] || null, reset_token: null, reset_expires: null, created_at: now, updated_at: now });
    } else if (table === 'ports') {
      data.ports.push({ id, user_id: params[0], port: params[1], name: params[2], protocol: params[3] || 'tcp', is_active: 1, created_at: now });
    } else if (table === 'traffic_stats') {
      data.traffic.push({ id, user_id: params[0], port_id: params[1], upload_bytes: params[2] || 0, download_bytes: params[3] || 0, recorded_at: now });
    }
    save();
    return { lastInsertRowid: id };
  }
  
  // SELECT
  if (sqlLower.startsWith('select')) {
    let results = [];
    
    if (sqlLower.includes('from users')) {
      results = [...data.users];
      if (sqlLower.includes('where')) {
        if (sqlLower.includes('email =')) results = results.filter(u => u.email === params[0]);
        else if (sqlLower.includes('id =')) results = results.filter(u => u.id === params[0]);
        else if (sqlLower.includes('is_admin = 1')) results = results.filter(u => u.is_admin === 1);
        else if (sqlLower.includes('verify_token =')) results = results.filter(u => u.verify_token === params[0]);
        else if (sqlLower.includes('reset_token =')) results = results.filter(u => u.reset_token === params[0] && u.reset_expires > params[1]);
      }
    } else if (sqlLower.includes('from ports')) {
      results = [...data.ports];
      if (sqlLower.includes('user_id =')) results = results.filter(p => p.user_id === params[0]);
      else if (sqlLower.includes('port =')) results = results.filter(p => p.port === params[0]);
      else if (sqlLower.includes('id =') && params.length >= 2) results = results.filter(p => p.id == params[0] && p.user_id == params[1]);
      else if (sqlLower.includes('id =')) results = results.filter(p => p.id == params[0]);
    } else if (sqlLower.includes('from traffic_stats')) {
      results = [...data.traffic];
      if (sqlLower.includes('user_id =')) results = results.filter(t => t.user_id === params[0]);
    }
    
    // COUNT
    if (sqlLower.includes('count(*)')) {
      return mode === 'get' ? { count: results.length } : [{ count: results.length }];
    }
    
    // SUM
    if (sqlLower.includes('sum(')) {
      const upload = results.reduce((s, t) => s + (t.upload_bytes || 0), 0);
      const download = results.reduce((s, t) => s + (t.download_bytes || 0), 0);
      return mode === 'get' ? { total_upload: upload, total_download: download, upload, download } : [{ total_upload: upload, total_download: download }];
    }
    
    return mode === 'get' ? results[0] : results;
  }
  
  // UPDATE
  if (sqlLower.startsWith('update')) {
    const table = sql.match(/update (\w+)/i)?.[1];
    if (table === 'users') {
      const user = data.users.find(u => u.id === params[params.length - 1]);
      if (user) {
        if (sqlLower.includes('password =')) user.password = params[0];
        if (sqlLower.includes('is_active =')) user.is_active = params[0];
        if (sqlLower.includes('verify_token =')) user.verify_token = params[0];
        if (sqlLower.includes('reset_token =')) { user.reset_token = params[0]; user.reset_expires = params[1]; }
        user.updated_at = Math.floor(Date.now() / 1000);
        save();
      }
    } else if (table === 'ports') {
      const port = data.ports.find(p => p.id == params[params.length - 1]);
      if (port) {
        if (params.length === 4) { port.port = params[0]; port.name = params[1]; port.is_active = params[2]; }
        else if (params.length === 3) { port.name = params[0]; port.is_active = params[1]; }
        save();
      }
    }
    return {};
  }
  
  // DELETE
  if (sqlLower.startsWith('delete')) {
    if (sqlLower.includes('from users')) {
      data.users = data.users.filter(u => u.id !== params[0]);
      data.ports = data.ports.filter(p => p.user_id !== params[0]);
      data.traffic = data.traffic.filter(t => t.user_id !== params[0]);
    } else if (sqlLower.includes('from ports')) {
      data.ports = data.ports.filter(p => p.id != params[0]);
    } else if (sqlLower.includes('from traffic_stats')) {
      data.traffic = data.traffic.filter(t => t.recorded_at >= params[0]);
    }
    save();
    return {};
  }
  
  return mode === 'get' ? undefined : [];
}

export async function initDatabase() {
  load();
  
  const adminEmail = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123456';
  
  if (!data.users.some(u => u.is_admin === 1)) {
    const hashedPass = await bcrypt.hash(adminPass, 10);
    const id = ++data._autoId.users;
    const now = Math.floor(Date.now() / 1000);
    data.users.push({ id, email: adminEmail, password: hashedPass, is_admin: 1, is_active: 1, verify_token: null, reset_token: null, reset_expires: null, created_at: now, updated_at: now });
    save();
    console.log('默认管理员已创建');
  }
  
  console.log('数据库初始化完成');
  
  process.on('exit', save);
  process.on('SIGINT', () => { save(); process.exit(); });
  process.on('SIGTERM', () => { save(); process.exit(); });
}
