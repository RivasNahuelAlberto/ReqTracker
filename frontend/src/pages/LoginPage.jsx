import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../components/AuthContext.jsx';

function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [projectHash, setProjectHash] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn, signUp } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const googleError = searchParams.get('error');

    if (token) {
      localStorage.setItem('authToken', token);
      navigate('/');
    } else if (googleError) {
      setError('Error en la autenticación con Google');
    }
  }, [searchParams, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      if (isLogin) {
        await signIn(username, password);
      } else {
        await signUp(username, email, password, projectHash || null);
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Ocurrió un error al autenticar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    const rawApiBase = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
    const normalizedApiBase = rawApiBase.replace(/\/+$/, '').replace(/\/api$/i, '');
    window.location.href = `${normalizedApiBase}/api/auth/google`;
  };

  return (
    <div className="rt-login-shell">
      <div className="rt-login-panel rt-card">
        <div className="rt-login-header">
          <div>
            <p className="rt-overline">Bienvenido a</p>
            <h1>ReqTracker</h1>
            <p className="rt-text-muted">Accede a tus proyectos, colabora y gestiona el seguimiento en un solo tablero.</p>
          </div>
          <div className="rt-login-switch">
            <button
              type="button"
              className={`rt-btn rt-btn-ghost ${isLogin ? 'active' : ''}`}
              onClick={() => setIsLogin(true)}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              className={`rt-btn rt-btn-ghost ${!isLogin ? 'active' : ''}`}
              onClick={() => setIsLogin(false)}
            >
              Registrarse
            </button>
          </div>
        </div>

        <form className="rt-form-stack" onSubmit={handleSubmit}>
          <label className="rt-form-label">
            Usuario
            <input
              type="text"
              className="rt-input"
              placeholder="Tu usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>

          {!isLogin && (
            <>
              <label className="rt-form-label">
                Email
                <input
                  type="email"
                  className="rt-input"
                  placeholder="correo@dominio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="rt-form-label">
                Código de proyecto (opcional)
                <input
                  type="text"
                  className="rt-input"
                  placeholder="Hash del proyecto"
                  value={projectHash}
                  onChange={(e) => setProjectHash(e.target.value)}
                />
                <small className="rt-form-hint">Úsalo para unirte como invitado a un proyecto existente.</small>
              </label>
            </>
          )}

          <label className="rt-form-label">
            Contraseña
            <input
              type="password"
              className="rt-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && <div className="rt-notice rt-notice-danger">{error}</div>}

          <button className="rt-btn rt-btn-primary rt-btn-block" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (isLogin ? 'Iniciando sesión...' : 'Registrando...') : (isLogin ? 'Iniciar sesión' : 'Crear cuenta')}
          </button>

          {isLogin && (
            <>
              <div className="rt-divider" />
              <button type="button" className="rt-btn rt-btn-ghost rt-btn-block" onClick={handleGoogleLogin}>
                Continuar con Google
              </button>
            </>
          )}
        </form>

        <div className="rt-login-footer">
          <span>{isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}</span>
          <button className="rt-btn rt-btn-link" type="button" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
