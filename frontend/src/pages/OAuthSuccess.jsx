import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function OAuthSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Read token from query parameter (?token=...)
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    console.log('[OAuthSuccess] Mounted. Token present:', !!token, 'Error:', error);

    if (error) {
      console.error('[OAuthSuccess] OAuth error:', error);
      navigate('/login?error=oauth_failed', { replace: true });
      return;
    }

    if (token) {
      try {
        // Save token to localStorage with key expected by AuthContext
        localStorage.setItem('authToken', token);
        console.log('[OAuthSuccess] Token saved to localStorage as authToken');

        // Redirect to home - use window.location to force a fresh load
        // This allows AuthContext to verify the token on mount
        console.log('[OAuthSuccess] Redirecting to home');
        window.location.href = '/';
      } catch (err) {
        console.error('[OAuthSuccess] Error saving token:', err);
        navigate('/login?error=token_save_failed', { replace: true });
      }
    } else {
      console.log('[OAuthSuccess] No token in query params');
      navigate('/login', { replace: true });
    }
  }, [searchParams, navigate]);

  // Show loading screen while processing
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
