import { createContext, useContext, useState, useEffect } from 'react';
import { login, register, verifyToken } from '../api.js';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      verifyToken()
        .then((data) => {
          setUser(data.user);
        })
        .catch(() => {
          localStorage.removeItem('authToken');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = async (username, password) => {
    const data = await login(username, password);
    localStorage.setItem('authToken', data.token);
    setUser(data.user);
    return data;
  };

  const signUp = async (username, email, password) => {
    const data = await register(username, email, password);
    localStorage.setItem('authToken', data.token);
    setUser(data.user);
    return data;
  };

  const signOut = () => {
    localStorage.removeItem('authToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}