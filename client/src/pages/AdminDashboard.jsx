import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import TrafficChart from '../components/TrafficChart';
import { admin, stats } from '../api';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview');
  const [systemStats, setSystemStats] = useState(null);
  const [globalTraffic, setGlobalTraffic] = useState({ stats: [], total: {}, byUser: [] });
  const [users, setUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [hours, setHours] = useState(24);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userTraffic, setUserTraffic] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddPortModal, setShowAddPortModal] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', is_active: true, port_limit: 5, bandwidth_limit: 0 });
  const [newPort, setNewPort] = useState({ port: '', name: '', protocol: 'tcp', local_ip: '127.0.0.1', local_port: '' });
  const [settings, setSettings] = useState({ allow_register: true, require_email_verify: false, server_ip: '', default_port_limit: 5, default_bandwidth_limit: 0 });
  const [userConfig, setUserConfig] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);

  const loadOverview = async () => {
    try {
      const [statsData, trafficData] = await Promise.all([
        admin.stats(),
        stats.global(hours)
      ]);
      setSystemStats(statsData);
      setGlobalTraffic(trafficData);
    } catch (err) {
      console.error(err);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await admin.users(page, 20, search);
      setUsers(data.users);
      setTotalUsers(data.total);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await admin.getSettings();
      setSettings(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (tab === 'overview') loadOverview();
    else if (tab === 'users') loadUsers();
    else if (tab === 'settings') loadSettings();
  }, [tab, hours, page, search]);

  const handleSaveSettings = async () => {
    try {
      await admin.updateSettings(settings);
      alert('设置已保存');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await admin.createUser(newUser);
      setShowCreateModal(false);
      setNewUser({ email: '', password: '', is_active: true, port_limit: 5, bandwidth_limit: 0 });
      loadUsers();
      alert('用户创建成功');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleViewUser = async (userId) => {
    try {
      const [userData, trafficData] = await Promise.all([
        admin.userDetail(userId),
        stats.user(userId, hours)
      ]);
      setSelectedUser(userData);
      setUserTraffic(trafficData);
      setShowUserModal(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleUser = async (userId, isActive) => {
    try {
      await admin.updateUser(userId, { is_active: isActive ? 0 : 1 });
      loadUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdateUserLimits = async () => {
    if (!selectedUser) return;
    try {
      await admin.updateUser(selectedUser.user.id, {
        port_limit: selectedUser.user.port_limit,
        bandwidth_limit: selectedUser.user.bandwidth_limit
      });
      alert('用户限制已更新');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('确定删除此用户？所有端口也将被删除。')) return;
    try {
      await admin.deleteUser(userId);
      loadUsers();
      setShowUserModal(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeletePort = async (userId, portId) => {
    if (!confirm('确定删除此端口？')) return;
    try {
      await admin.deletePort(userId, portId);
      handleViewUser(userId);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddPort = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      await admin.addPort(selectedUser.user.id, {
        ...newPort,
        port: parseInt(newPort.port),
        local_port: parseInt(newPort.local_port) || parseInt(newPort.port)
      });
      setShowAddPortModal(false);
      setNewPort({ port: '', name: '', protocol: 'tcp', local_ip: '127.0.0.1', local_port: '' });
      handleViewUser(selectedUser.user.id);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleViewConfig = async (userId) => {
    try {
      const data = await admin.userConfig(userId);
      setUserConfig(data.config);
      setShowConfigModal(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const copyConfig = () => {
    navigator.clipboard.writeText(userConfig);
    alert('配置已复制到剪贴板');
  };


  return (
    <Layout title="管理后台">
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button onClick={() => setTab('overview')} className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${tab === 'overview' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          系统概览
        </button>
        <button onClick={() => setTab('users')} className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${tab === 'users' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          用户管理
        </button>
        <button onClick={() => setTab('settings')} className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${tab === 'settings' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          系统设置
        </button>
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="card">
              <div className="text-sm text-gray-500 mb-1">总用户</div>
              <div className="text-2xl font-bold text-gray-900">{systemStats?.users?.total || 0}</div>
              <div className="text-xs text-gray-400 mt-1">活跃: {systemStats?.users?.active || 0}</div>
            </div>
            <div className="card">
              <div className="text-sm text-gray-500 mb-1">总端口</div>
              <div className="text-2xl font-bold text-gray-900">{systemStats?.ports?.total || 0}</div>
              <div className="text-xs text-gray-400 mt-1">启用: {systemStats?.ports?.active || 0}</div>
            </div>
            <div className="card">
              <div className="text-sm text-gray-500 mb-1">总上传</div>
              <div className="text-2xl font-bold text-primary-600">{formatBytes(systemStats?.traffic?.upload)}</div>
            </div>
            <div className="card">
              <div className="text-sm text-gray-500 mb-1">总下载</div>
              <div className="text-2xl font-bold text-emerald-600">{formatBytes(systemStats?.traffic?.download)}</div>
            </div>
          </div>

          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">全局流量</h2>
              <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className="input w-auto">
                <option value={1}>最近1小时</option>
                <option value={12}>最近12小时</option>
                <option value={24}>最近24小时</option>
                <option value={48}>最近48小时</option>
              </select>
            </div>
            <TrafficChart data={globalTraffic.stats} title={`最近${hours}小时流量`} />
          </div>
        </>
      )}

      {tab === 'users' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="搜索邮箱..." className="input w-64" />
              <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">创建用户</button>
            </div>
            <span className="text-sm text-gray-500">共 {totalUsers} 个用户</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">邮箱</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">端口数/上限</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">限速</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">状态</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">注册时间</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      {u.email}
                      {u.is_admin ? <span className="ml-2 px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">管理员</span> : null}
                    </td>
                    <td className="py-3 px-4">{u.port_count || 0}/{u.port_limit || 5}</td>
                    <td className="py-3 px-4">{u.bandwidth_limit ? `${u.bandwidth_limit}KB/s` : '不限'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {u.is_active ? '正常' : '禁用'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">{new Date(u.created_at * 1000).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => handleViewUser(u.id)} className="text-sm text-primary-600 hover:text-primary-700 mr-3">详情</button>
                      {!u.is_admin && (
                        <>
                          <button onClick={() => handleToggleUser(u.id, u.is_active)} className="text-sm text-yellow-600 hover:text-yellow-700 mr-3">{u.is_active ? '禁用' : '启用'}</button>
                          <button onClick={() => handleDeleteUser(u.id)} className="text-sm text-red-600 hover:text-red-700">删除</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalUsers > 20 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary text-sm">上一页</button>
              <span className="px-4 py-2 text-sm text-gray-600">第 {page} 页</span>
              <button onClick={() => setPage(p => p + 1)} disabled={users.length < 20} className="btn btn-secondary text-sm">下一页</button>
            </div>
          )}
        </div>
      )}


      {tab === 'settings' && (
        <div className="card max-w-2xl">
          <h2 className="text-lg font-semibold mb-6">系统设置</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">外网服务器IP</label>
              <input type="text" value={settings.server_ip} onChange={(e) => setSettings({ ...settings, server_ip: e.target.value })} className="input" placeholder="用于生成客户端配置文件" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">默认端口上限</label>
                <input type="number" value={settings.default_port_limit} onChange={(e) => setSettings({ ...settings, default_port_limit: parseInt(e.target.value) })} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">默认限速 (KB/s, 0=不限)</label>
                <input type="number" value={settings.default_bandwidth_limit} onChange={(e) => setSettings({ ...settings, default_bandwidth_limit: parseInt(e.target.value) })} className="input" />
              </div>
            </div>
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">开放注册</div>
                <div className="text-sm text-gray-500">允许新用户注册账号</div>
              </div>
              <input type="checkbox" checked={settings.allow_register} onChange={(e) => setSettings({ ...settings, allow_register: e.target.checked })} className="w-5 h-5 text-primary-600 rounded" />
            </label>
            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">邮箱验证</div>
                <div className="text-sm text-gray-500">注册后需要邮箱验证才能登录</div>
              </div>
              <input type="checkbox" checked={settings.require_email_verify} onChange={(e) => setSettings({ ...settings, require_email_verify: e.target.checked })} className="w-5 h-5 text-primary-600 rounded" />
            </label>
            <button onClick={handleSaveSettings} className="btn btn-primary w-full">保存设置</button>
          </div>
        </div>
      )}

      {/* 创建用户弹窗 */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="创建用户">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
            <input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="input" placeholder="user@example.com" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="input" placeholder="至少8位" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">端口上限</label>
              <input type="number" value={newUser.port_limit} onChange={(e) => setNewUser({ ...newUser, port_limit: parseInt(e.target.value) })} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">限速 (KB/s)</label>
              <input type="number" value={newUser.bandwidth_limit} onChange={(e) => setNewUser({ ...newUser, bandwidth_limit: parseInt(e.target.value) })} className="input" placeholder="0=不限" />
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={newUser.is_active} onChange={(e) => setNewUser({ ...newUser, is_active: e.target.checked })} className="w-4 h-4 text-primary-600 rounded" />
            <span className="text-sm text-gray-700">立即激活</span>
          </label>
          <button type="submit" className="btn btn-primary w-full">创建</button>
        </form>
      </Modal>

      {/* 用户详情弹窗 */}
      <Modal isOpen={showUserModal} onClose={() => setShowUserModal(false)} title="用户详情">
        {selectedUser && (
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-500">邮箱</div>
              <div className="font-medium">{selectedUser.user.email}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-500 mb-1">端口上限</label>
                <input type="number" value={selectedUser.user.port_limit || 5} onChange={(e) => setSelectedUser({...selectedUser, user: {...selectedUser.user, port_limit: parseInt(e.target.value)}})} className="input" />
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">限速 (KB/s)</label>
                <input type="number" value={selectedUser.user.bandwidth_limit || 0} onChange={(e) => setSelectedUser({...selectedUser, user: {...selectedUser.user, bandwidth_limit: parseInt(e.target.value)}})} className="input" placeholder="0=不限" />
              </div>
            </div>
            <button onClick={handleUpdateUserLimits} className="btn btn-secondary w-full">更新限制</button>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">总上传</div>
                <div className="font-medium text-primary-600">{formatBytes(userTraffic?.total?.total_upload)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">总下载</div>
                <div className="font-medium text-emerald-600">{formatBytes(userTraffic?.total?.total_download)}</div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">端口列表 ({selectedUser.ports.length}/{selectedUser.user.port_limit || 5})</span>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddPortModal(true)} className="text-sm text-primary-600 hover:text-primary-700">添加端口</button>
                  <button onClick={() => handleViewConfig(selectedUser.user.id)} className="text-sm text-green-600 hover:text-green-700">查看配置</button>
                </div>
              </div>
              {selectedUser.ports.length === 0 ? (
                <p className="text-gray-400 text-sm">暂无端口</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedUser.ports.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                      <div>
                        <span className="font-mono">{p.port}</span>
                        <span className="text-gray-400 mx-1">→</span>
                        <span className="text-gray-600">{p.local_ip}:{p.local_port}</span>
                        <span className="text-gray-400 mx-2">|</span>
                        <span className="text-gray-500">{p.name}</span>
                      </div>
                      <button onClick={() => handleDeletePort(selectedUser.user.id, p.id)} className="text-red-600 hover:text-red-700">删除</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!selectedUser.user.is_admin && (
              <button onClick={() => handleDeleteUser(selectedUser.user.id)} className="btn btn-danger w-full">删除用户</button>
            )}
          </div>
        )}
      </Modal>

      {/* 添加端口弹窗 */}
      <Modal isOpen={showAddPortModal} onClose={() => setShowAddPortModal(false)} title="添加端口">
        <form onSubmit={handleAddPort} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">外网端口</label>
              <input type="number" value={newPort.port} onChange={(e) => setNewPort({ ...newPort, port: e.target.value })} className="input" placeholder="10000-60000" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">协议</label>
              <select value={newPort.protocol} onChange={(e) => setNewPort({ ...newPort, protocol: e.target.value })} className="input">
                <option value="tcp">TCP</option>
                <option value="udp">UDP</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">内网IP</label>
              <input type="text" value={newPort.local_ip} onChange={(e) => setNewPort({ ...newPort, local_ip: e.target.value })} className="input" placeholder="127.0.0.1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">内网端口</label>
              <input type="number" value={newPort.local_port} onChange={(e) => setNewPort({ ...newPort, local_port: e.target.value })} className="input" placeholder="同外网端口" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">备注名称</label>
            <input type="text" value={newPort.name} onChange={(e) => setNewPort({ ...newPort, name: e.target.value })} className="input" placeholder="可选" />
          </div>
          <button type="submit" className="btn btn-primary w-full">添加</button>
        </form>
      </Modal>

      {/* 配置文件弹窗 */}
      <Modal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)} title="客户端配置文件">
        <div className="space-y-4">
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto max-h-96">{userConfig}</pre>
          <button onClick={copyConfig} className="btn btn-primary w-full">复制配置</button>
        </div>
      </Modal>
    </Layout>
  );
}
