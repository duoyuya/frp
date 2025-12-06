import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import TrafficChart from '../components/TrafficChart';
import { ports, user } from '../api';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function Dashboard() {
  const [portList, setPortList] = useState([]);
  const [portLimit, setPortLimit] = useState(5);
  const [serverIp, setServerIp] = useState('');
  const [traffic, setTraffic] = useState({ stats: [], total: {} });
  const [hours, setHours] = useState(24);
  const [showModal, setShowModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newPort, setNewPort] = useState({ port: '', name: '', protocol: 'tcp', local_ip: '127.0.0.1', local_port: '' });
  const [editPort, setEditPort] = useState(null);
  const [config, setConfig] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const [portData, trafficData] = await Promise.all([
        ports.list(),
        user.traffic(hours)
      ]);
      setPortList(portData.ports);
      setPortLimit(portData.limit);
      setServerIp(portData.server_ip || '');
      setTraffic(trafficData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { loadData(); }, [hours]);

  const handleRandomPort = async () => {
    try {
      const data = await ports.random();
      setNewPort(p => ({ ...p, port: data.port, local_port: data.port }));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreatePort = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await ports.create(
        parseInt(newPort.port), 
        newPort.name, 
        newPort.protocol, 
        newPort.local_ip, 
        parseInt(newPort.local_port) || parseInt(newPort.port)
      );
      setShowModal(false);
      setNewPort({ port: '', name: '', protocol: 'tcp', local_ip: '127.0.0.1', local_port: '' });
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditPort = async (e) => {
    e.preventDefault();
    if (!editPort) return;
    setError('');
    setLoading(true);
    try {
      await ports.update(editPort.id, {
        name: editPort.name,
        local_ip: editPort.local_ip,
        local_port: parseInt(editPort.local_port) || editPort.port,
        is_active: editPort.is_active
      });
      setShowEditModal(false);
      setEditPort(null);
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePort = async (id) => {
    if (!confirm('确定删除此端口？')) return;
    try {
      await ports.delete(id);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTogglePort = async (port) => {
    try {
      await ports.update(port.id, { is_active: port.is_active ? 0 : 1 });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleViewConfig = async () => {
    try {
      const data = await ports.config();
      setConfig(data.config);
      setShowConfigModal(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const copyConfig = () => {
    navigator.clipboard.writeText(config);
    alert('配置已复制到剪贴板');
  };

  const openEditModal = (port) => {
    setEditPort({ ...port });
    setShowEditModal(true);
  };

  return (
    <Layout title="控制面板">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">已用端口</div>
          <div className="text-2xl font-bold text-gray-900">{portList.length} / {portLimit}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">服务器IP</div>
          <div className="text-lg font-mono text-gray-900">{serverIp || '未设置'}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">总上传</div>
          <div className="text-2xl font-bold text-primary-600">{formatBytes(traffic.total?.total_upload)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">总下载</div>
          <div className="text-2xl font-bold text-emerald-600">{formatBytes(traffic.total?.total_download)}</div>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">流量统计</h2>
          <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className="input w-auto">
            <option value={1}>最近1小时</option>
            <option value={12}>最近12小时</option>
            <option value={24}>最近24小时</option>
            <option value={48}>最近48小时</option>
          </select>
        </div>
        <TrafficChart data={traffic.stats} title={`最近${hours}小时流量`} />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">我的端口</h2>
          <div className="flex gap-2">
            <button onClick={handleViewConfig} disabled={portList.length === 0} className="btn btn-secondary text-sm">
              查看配置
            </button>
            <button onClick={() => setShowModal(true)} disabled={portList.length >= portLimit} className="btn btn-primary text-sm">
              申请端口
            </button>
          </div>
        </div>

        {portList.length === 0 ? (
          <p className="text-gray-500 text-center py-8">暂无端口，点击上方按钮申请</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">外网端口</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">内网地址</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">名称</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">协议</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">状态</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {portList.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4 font-mono">{serverIp ? `${serverIp}:${p.port}` : p.port}</td>
                    <td className="py-3 px-4 font-mono text-sm text-gray-600">{p.local_ip || '127.0.0.1'}:{p.local_port || p.port}</td>
                    <td className="py-3 px-4">{p.name}</td>
                    <td className="py-3 px-4 uppercase text-sm">{p.protocol}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {p.is_active ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={() => openEditModal(p)} className="text-sm text-blue-600 hover:text-blue-700 mr-3">编辑</button>
                      <button onClick={() => handleTogglePort(p)} className="text-sm text-primary-600 hover:text-primary-700 mr-3">{p.is_active ? '禁用' : '启用'}</button>
                      <button onClick={() => handleDeletePort(p.id)} className="text-sm text-red-600 hover:text-red-700">删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {/* 申请端口弹窗 */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="申请端口">
        <form onSubmit={handleCreatePort} className="space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">外网端口</label>
            <div className="flex gap-2">
              <input type="number" value={newPort.port} onChange={(e) => setNewPort(p => ({ ...p, port: e.target.value }))} className="input flex-1" placeholder="10000-60000" required />
              <button type="button" onClick={handleRandomPort} className="btn btn-secondary">随机</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">内网IP</label>
              <input type="text" value={newPort.local_ip} onChange={(e) => setNewPort(p => ({ ...p, local_ip: e.target.value }))} className="input" placeholder="127.0.0.1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">内网端口</label>
              <input type="number" value={newPort.local_port} onChange={(e) => setNewPort(p => ({ ...p, local_port: e.target.value }))} className="input" placeholder="同外网端口" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
            <input type="text" value={newPort.name} onChange={(e) => setNewPort(p => ({ ...p, name: e.target.value }))} className="input" placeholder="可选" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">协议</label>
            <select value={newPort.protocol} onChange={(e) => setNewPort(p => ({ ...p, protocol: e.target.value }))} className="input">
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
            </select>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary w-full">{loading ? '申请中...' : '申请'}</button>
        </form>
      </Modal>

      {/* 编辑端口弹窗 */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="编辑端口">
        {editPort && (
          <form onSubmit={handleEditPort} className="space-y-4">
            {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">外网端口</label>
              <input type="number" value={editPort.port} className="input bg-gray-100" disabled />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">内网IP</label>
                <input type="text" value={editPort.local_ip || '127.0.0.1'} onChange={(e) => setEditPort(p => ({ ...p, local_ip: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">内网端口</label>
                <input type="number" value={editPort.local_port || editPort.port} onChange={(e) => setEditPort(p => ({ ...p, local_port: e.target.value }))} className="input" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
              <input type="text" value={editPort.name} onChange={(e) => setEditPort(p => ({ ...p, name: e.target.value }))} className="input" />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full">{loading ? '保存中...' : '保存'}</button>
          </form>
        )}
      </Modal>

      {/* 配置文件弹窗 */}
      <Modal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)} title="客户端配置文件 (frpc.toml)">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">将以下配置保存为 frpc.toml，然后运行 frpc -c frpc.toml</p>
          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto max-h-96">{config}</pre>
          <button onClick={copyConfig} className="btn btn-primary w-full">复制配置</button>
        </div>
      </Modal>
    </Layout>
  );
}
