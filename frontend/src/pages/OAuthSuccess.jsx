import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../components/AuthContext.jsx';

export default function OAuthSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setToken } = useAuth();

  useEffect(() => {
    const token = params.get('token');

    if (token) {
      // Save token to localStorage
      localStorage.setItem('token', token);
      setToken(token);
      
      console.log('[OAuthSuccess] Token received and stored');
      
      // Redirect to home after short delay to ensure state updates
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 500);
    } else {
      console.log('[OAuthSuccess] No token in query params');
      navigate('/login', { replace: true });
    }
  }, [params, navigate, setToken]);

  return (
    <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
      <div className="text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <div className="mt-2">Iniciando sesión con Google...</div>
      </div>
    </div>
  );
}
