import { createContext, useContext, useState, useEffect } from 'react';
import { login, register, verifyToken } from '../api.js';
import { io } from 'socket.io-client';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadNotification, setReloadNotification] = useState(null);
  const [socket, setSocket] = useState(null);

  const connectSocket = (userData) => {
    if (socket) return;

    const apiBase = import.meta.env.VITE_API_BASE || `${window.location.origin}/api`;
    const socketUrl = import.meta.env.VITE_SOCKET_URL || apiBase.replace(/\/api\/?$/, '');
    const newSocket = io(socketUrl, { transports: ['websocket', 'polling'] });

    newSocket.on('dataChanged', (data) => {
      setReloadNotification(data);
    });

    newSocket.on('analytics:update', (data) => {
      setReloadNotification(data);
    });

    newSocket.on('graph:recomputed', (data) => {
      setReloadNotification(data);
    });

    newSocket.on('prediction:generated', (data) => {
      setReloadNotification(data);
    });

    newSocket.on('semantic:drift', (data) => {
      setReloadNotification(data);
    });

    newSocket.on('risk:detected', (data) => {
      setReloadNotification(data);
    });

    const normalizeProjectId = (projectRef) => {
      if (!projectRef) return null;
      if (typeof projectRef === 'string') return projectRef;
      if (projectRef._id) return projectRef._id.toString();
      if (projectRef.toString) return projectRef.toString();
      return null;
    };

    newSocket.on('connect', () => {
      if (userData?.projectRoles && userData.projectRoles.length > 0) {
        userData.projectRoles.forEach((pr) => {
          const projectId = normalizeProjectId(pr.project);
          if (projectId) {
            newSocket.emit('joinProject', projectId);
          }
        });
      }
    });

    setSocket(newSocket);
  };

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      verifyToken()
        .then((data) => {
          setUser(data.user);
          connectSocket(data.user);
        })
        .catch(() => {
          localStorage.removeItem('authToken');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  const signIn = async (username, password) => {
    const data = await login(username, password);
    localStorage.setItem('authToken', data.token);
    setUser(data.user);
    connectSocket(data.user);
    return data;
  };

  const signUp = async (username, email, password, projectHash = null) => {
    const data = await register(username, email, password, projectHash);
    localStorage.setItem('authToken', data.token);
    setUser(data.user);
    connectSocket(data.user);
    return data;
  };

  const signOut = () => {
    localStorage.removeItem('authToken');
    setUser(null);
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
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