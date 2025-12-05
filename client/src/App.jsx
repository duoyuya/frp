import { useState, useEffect, createContext, useContext } from 'react';
import { auth } from './api';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Verify from './pages/Verify';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('login');

  useEffect(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    
    if (path === '/verify' || params.has('token') && path.includes('verify')) {
      setPage('verify');
      setLoading(false);
      return;
    }
    if (path === '/reset-password' || params.has('token') && path.includes('reset')) {
      setPage('reset-password');
      setLoading(false);
      return;
    }
    
    auth.me()
      .then(data => {
        setUser(data.user);
        setPage(data.user.isAdmin ? 'admin' : 'dashboard');
      })
      .catch(() => setPage('login'))
      .finally(() => setLoading(false));
  }, []);

  const login = (userData) => {
    setUser(userData);
    setPage(userData.isAdmin ? 'admin' : 'dashboard');
    window.history.pushState({}, '', '/');
  };

  const logout = async () => {
    await auth.logout();
    setUser(null);
    setPage('login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, setPage }}>
      {page === 'login' && <Login />}
      {page === 'register' && <Register />}
      {page === 'forgot-password' && <ForgotPassword />}
      {page === 'reset-password' && <ResetPassword />}
      {page === 'verify' && <Verify />}
      {page === 'dashboard' && <Dashboard />}
      {page === 'admin' && <AdminDashboard />}
    </AuthContext.Provider>
  );
}

export default App;
