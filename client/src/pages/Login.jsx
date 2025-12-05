import { useState } from 'react';
import { useAuth } from '../App';
import { auth } from '../api';

export default function Login() {
  const { login, setPage } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await auth.login(email, password);
      login(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl shadow-lg mb-4">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 10l5-5v3h5v4h-5v3l-5-5z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
            FRP Panel
          </h1>
          <p className="text-gray-500 mt-2">内网穿透管理平台</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? '登录中...' : '登录'}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm">
            <button onClick={() => setPage('register')} className="text-primary-600 hover:text-primary-700">
              注册账号
            </button>
            <button onClick={() => setPage('forgot-password')} className="text-gray-500 hover:text-gray-700">
              忘记密码？
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
