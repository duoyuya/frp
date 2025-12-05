import { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { auth } from '../api';

export default function Verify() {
  const { setPage } = useAuth();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  const token = new URLSearchParams(window.location.search).get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('无效的验证链接');
      return;
    }

    auth.verify(token)
      .then(data => {
        setStatus('success');
        setMessage(data.message);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.message);
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 flex items-center justify-center p-4">
      <div className="card text-center max-w-md">
        {status === 'loading' && (
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent mx-auto"></div>
        )}
        
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-600 mb-4">{message}</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-600 mb-4">{message}</p>
          </>
        )}
        
        {status !== 'loading' && (
          <button onClick={() => { window.history.pushState({}, '', '/'); setPage('login'); }} className="btn btn-primary">
            返回登录
          </button>
        )}
      </div>
    </div>
  );
}
