import { useAuth } from '../App';

export default function Layout({ children, title }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <nav className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 10l5-5v3h5v4h-5v3l-5-5z"/>
                  </svg>
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
                  FRP Panel
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user?.email}</span>
              {user?.isAdmin && (
                <span className="px-2 py-1 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
                  管理员
                </span>
              )}
              <button onClick={logout} className="btn btn-secondary text-sm">
                退出
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {title && (
          <h1 className="text-2xl font-bold text-gray-900 mb-6">{title}</h1>
        )}
        {children}
      </main>
    </div>
  );
}
