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

  useEffect(() => {
    if (tab === 'overview') loadOverview();
    else if (tab === 'users') loadUsers();
  }, [tab, hours, page, search]);

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

  return (
    <Layout title="管理后台">
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => setTab('overview')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'overview' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          系统概览
        </button>
        <button
          onClick={() => setTab('users')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'users' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          用户管理
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

          <div className="card">
            <h2 className="text-lg font-semibold mb-4">流量排行 (最近{hours}小时)</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">用户</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">上传</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">下载</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">总计</th>
                  </tr>
                </thead>
                <tbody>
                  {globalTraffic.byUser?.map(u => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4">{u.email}</td>
                      <td className="py-3 px-4 text-right text-primary-600">{formatBytes(u.upload)}</td>
                      <td className="py-3 px-4 text-right text-emerald-600">{formatBytes(u.download)}</td>
                      <td className="py-3 px-4 text-right font-medium">{formatBytes((u.upload || 0) + (u.download || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'users' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="搜索邮箱..."
              className="input w-64"
            />
            <span className="text-sm text-gray-500">共 {totalUsers} 个用户</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">邮箱</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">端口数</th>
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
                    <td className="py-3 px-4">{u.port_count}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {u.is_active ? '正常' : '禁用'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {new Date(u.created_at * 1000).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => handleViewUser(u.id)} className="text-sm text-primary-600 hover:text-primary-700 mr-3">
                        详情
                      </button>
                      {!u.is_admin && (
                        <>
                          <button onClick={() => handleToggleUser(u.id, u.is_active)} className="text-sm text-yellow-600 hover:text-yellow-700 mr-3">
                            {u.is_active ? '禁用' : '启用'}
                          </button>
                          <button onClick={() => handleDeleteUser(u.id)} className="text-sm text-red-600 hover:text-red-700">
                            删除
                          </button>
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
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary text-sm">
                上一页
              </button>
              <span className="px-4 py-2 text-sm text-gray-600">第 {page} 页</span>
              <button onClick={() => setPage(p => p + 1)} disabled={users.length < 20} className="btn btn-secondary text-sm">
                下一页
              </button>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showUserModal} onClose={() => setShowUserModal(false)} title="用户详情">
        {selectedUser && (
          <div className="space-y-4">
            <div>
              <div className="text-sm text-gray-500">邮箱</div>
              <div className="font-medium">{selectedUser.user.email}</div>
            </div>

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
              <div className="text-sm text-gray-500 mb-2">端口列表</div>
              {selectedUser.ports.length === 0 ? (
                <p className="text-gray-400 text-sm">暂无端口</p>
              ) : (
                <div className="space-y-2">
                  {selectedUser.ports.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div>
                        <span className="font-mono">{p.port}</span>
                        <span className="text-gray-400 mx-2">|</span>
                        <span className="text-sm text-gray-600">{p.name}</span>
                        <span className="text-gray-400 mx-2">|</span>
                        <span className="text-xs uppercase text-gray-500">{p.protocol}</span>
                      </div>
                      <button onClick={() => handleDeletePort(selectedUser.user.id, p.id)} className="text-sm text-red-600 hover:text-red-700">
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!selectedUser.user.is_admin && (
              <button onClick={() => handleDeleteUser(selectedUser.user.id)} className="btn btn-danger w-full">
                删除用户
              </button>
            )}
          </div>
        )}
      </Modal>
    </Layout>
  );
}
