import { useState } from 'react';
import { useAuth } from '../App';
import { auth } from '../api';

export default function ResetPassword() {
  const { setPage } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const token = new URLSearchParams(window.location.search).get('token');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('两次密码不一致');
      return;
    }

    if (password.length < 8) {
      setError('密码至少8位');
      return;
    }

    setLoading(true);

    try {
      const data = await auth.resetPassword(token, password);
      setSuccess(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 flex items-center justify-center p-4">
        <div className="card text-center">
          <p className="text-red-600 mb-4">无效的重置链接</p>
          <button onClick={() => { window.history.pushState({}, '', '/'); setPage('login'); }} className="btn btn-primary">
            返回登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
            重置密码
          </h1>
        </div>

        <div className="card">
          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-600 mb-4">{success}</p>
              <button onClick={() => { window.history.pushState({}, '', '/'); setPage('login'); }} className="btn btn-primary">
                返回登录
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">新密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="至少8位"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">确认密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input"
                  placeholder="再次输入密码"
                  required
                />
              </div>

              <button type="submit" disabled={loading} className="btn btn-primary w-full">
                {loading ? '重置中...' : '重置密码'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
