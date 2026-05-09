import { createContext, useContext, useState, useEffect } from 'react';
import { login, register, verifyToken } from '../api.js';
import { io } from 'socket.io-client';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadNotification, setReloadNotification] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      verifyToken()
        .then((data) => {
          setUser(data.user);
          // Connect to socket after user is verified
          const apiBase = import.meta.env.VITE_API_BASE || `${window.location.origin}/api`;
          const socketUrl = import.meta.env.VITE_SOCKET_URL || apiBase.replace(/\/api\/?$/, '');
          const newSocket = io(socketUrl, { transports: ['websocket', 'polling'] });
          newSocket.on('dataChanged', (data) => {
            setReloadNotification(data);
          });
          setSocket(newSocket);
        })
        .catch(() => {
          localStorage.removeItem('authToken');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
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

  const dismissReloadNotification = () => {
    setReloadNotification(null);
  };

  const reloadApp = () => {
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, reloadNotification, dismissReloadNotification, reloadApp }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}