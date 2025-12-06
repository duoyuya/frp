import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DB_PATH || './data/frp-panel.db';
let data = { 
  users: [], 
  ports: [], 
  traffic: [], 
  announcements: [],
  settings: { 
    allow_register: true, 
    require_email_verify: false,
    server_ip: process.env.SERVER_IP || '',
    default_port_limit: 5,
    default_bandwidth_limit: 0 // 0表示不限速，单位KB/s
  },
  _autoId: { users: 0, ports: 0, traffic: 0, announcements: 0 } 
};

function load() {
  try {
    if (fs.existsSync(dbPath)) {
      const loaded = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      data = { ...data, ...loaded };
      // 确保settings有默认值
      data.settings = { 
        allow_register: true, 
        require_email_verify: false,
        server_ip: process.env.SERVER_IP || '',
        default_port_limit: 5,
        default_bandwidth_limit: 0,
        ...loaded.settings 
      };
      // 确保announcements数组存在
      if (!data.announcements) data.announcements = [];
      if (!data._autoId.announcements) data._autoId.announcements = 0;
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

setInterval(save, 30000);

// 获取系统设置
export function getSettings() {
  return data.settings;
}

// 获取FRP Token
export function getFrpToken() {
  return process.env.FRP_TOKEN || 'change-this-token';
}

// 更新系统设置
export function updateSettings(newSettings) {
  data.settings = { ...data.settings, ...newSettings };
  save();
  return data.settings;
}

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
      data.users.push({ 
        id, 
        email: params[0], 
        password: params[1], 
        is_admin: params[2] || 0, 
        is_active: params[3] || 0, 
        verify_token: params[4] || null, 
        port_limit: params[5] || data.settings.default_port_limit,
        bandwidth_limit: params[6] || data.settings.default_bandwidth_limit,
        reset_token: null, 
        reset_expires: null, 
        created_at: now, 
        updated_at: now 
      });
    } else if (table === 'ports') {
      data.ports.push({ 
        id, 
        user_id: params[0], 
        port: params[1], 
        name: params[2], 
        protocol: params[3] || 'tcp',
        local_ip: params[4] || '127.0.0.1',
        local_port: params[5] || params[1],
        is_active: 1, 
        created_at: now 
      });
    } else if (table === 'traffic_stats') {
      data.traffic.push({ id, user_id: params[0], port_id: params[1], upload_bytes: params[2] || 0, download_bytes: params[3] || 0, recorded_at: now });
    } else if (table === 'announcements') {
      data.announcements.push({ id, title: params[0], content: params[1], is_active: params[2] ?? 1, created_at: now, updated_at: now });
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
        else if (sqlLower.includes('id =')) results = results.filter(u => u.id == params[0]);
        else if (sqlLower.includes('is_admin = 1')) results = results.filter(u => u.is_admin === 1);
        else if (sqlLower.includes('verify_token =')) results = results.filter(u => u.verify_token === params[0]);
        else if (sqlLower.includes('reset_token =')) results = results.filter(u => u.reset_token === params[0] && u.reset_expires > params[1]);
      }
    } else if (sqlLower.includes('from ports')) {
      results = [...data.ports];
      if (sqlLower.includes('user_id =')) results = results.filter(p => p.user_id == params[0]);
      else if (sqlLower.includes('port =')) results = results.filter(p => p.port == params[0]);
      else if (sqlLower.includes('id =') && params.length >= 2) results = results.filter(p => p.id == params[0] && p.user_id == params[1]);
      else if (sqlLower.includes('id =')) results = results.filter(p => p.id == params[0]);
    } else if (sqlLower.includes('from traffic_stats')) {
      results = [...data.traffic];
      if (sqlLower.includes('user_id =')) results = results.filter(t => t.user_id == params[0]);
    } else if (sqlLower.includes('from announcements')) {
      results = [...data.announcements];
      if (sqlLower.includes('is_active = 1')) results = results.filter(a => a.is_active === 1);
      if (sqlLower.includes('id =')) results = results.filter(a => a.id == params[0]);
      results.sort((a, b) => b.created_at - a.created_at);
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
      const user = data.users.find(u => u.id == params[params.length - 1]);
      if (user) {
        if (sqlLower.includes('password =')) user.password = params[0];
        if (sqlLower.includes('is_active =')) user.is_active = params[0];
        if (sqlLower.includes('is_admin =')) user.is_admin = params[0];
        if (sqlLower.includes('verify_token =')) user.verify_token = params[0];
        if (sqlLower.includes('reset_token =')) { user.reset_token = params[0]; user.reset_expires = params[1]; }
        if (sqlLower.includes('port_limit =')) user.port_limit = params[0];
        if (sqlLower.includes('bandwidth_limit =')) user.bandwidth_limit = params[0];
        user.updated_at = Math.floor(Date.now() / 1000);
        save();
      }
    } else if (table === 'announcements') {
      const ann = data.announcements.find(a => a.id == params[params.length - 1]);
      if (ann) {
        if (params.length === 4) { ann.title = params[0]; ann.content = params[1]; ann.is_active = params[2]; }
        else if (params.length === 2) { ann.is_active = params[0]; }
        ann.updated_at = Math.floor(Date.now() / 1000);
        save();
      }
    } else if (table === 'ports') {
      const port = data.ports.find(p => p.id == params[params.length - 1]);
      if (port) {
        if (params.length === 4) { port.port = params[0]; port.name = params[1]; port.is_active = params[2]; }
        else if (params.length === 3) { port.name = params[0]; port.is_active = params[1]; }
        else if (params.length === 6) { 
          port.port = params[0]; 
          port.name = params[1]; 
          port.local_ip = params[2];
          port.local_port = params[3];
          port.is_active = params[4]; 
        }
        save();
      }
    }
    return {};
  }
  
  // DELETE
  if (sqlLower.startsWith('delete')) {
    if (sqlLower.includes('from users')) {
      const userId = parseInt(params[0]);
      data.users = data.users.filter(u => u.id !== userId);
      data.ports = data.ports.filter(p => p.user_id !== userId);
      data.traffic = data.traffic.filter(t => t.user_id !== userId);
    } else if (sqlLower.includes('from ports')) {
      const portId = parseInt(params[0]);
      data.ports = data.ports.filter(p => p.id !== portId);
    } else if (sqlLower.includes('from traffic_stats')) {
      data.traffic = data.traffic.filter(t => t.recorded_at >= params[0]);
    } else if (sqlLower.includes('from announcements')) {
      const annId = parseInt(params[0]);
      data.announcements = data.announcements.filter(a => a.id !== annId);
    }
    save();
    return {};
  }
  
  return mode === 'get' ? undefined : [];
}

export async function initDatabase() {
  load();
  
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@admin.com';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123456';
  
  if (!data.users.some(u => u.is_admin === 1)) {
    const hashedPass = await bcrypt.hash(adminPass, 10);
    const id = ++data._autoId.users;
    const now = Math.floor(Date.now() / 1000);
    data.users.push({ 
      id, 
      email: adminEmail, 
      password: hashedPass, 
      is_admin: 1, 
      is_active: 1, 
      verify_token: null, 
      port_limit: 999,
      bandwidth_limit: 0,
      reset_token: null, 
      reset_expires: null, 
      created_at: now, 
      updated_at: now 
    });
    save();
    console.log('默认管理员已创建:', adminEmail);
  }
  
  // 初始化server_ip
  if (!data.settings.server_ip && process.env.SERVER_IP) {
    data.settings.server_ip = process.env.SERVER_IP;
    save();
  }
  
  console.log('数据库初始化完成');
  
  process.on('exit', save);
  process.on('SIGINT', () => { save(); process.exit(); });
  process.on('SIGTERM', () => { save(); process.exit(); });
}
