import { createContext, useContext, useEffect, useState } from 'react';
import { login, register, verifyToken } from '../api';
import { io } from 'socket.io-client';

interface ProjectRole { project: string | { toString(): string }; role: string }
interface User { username: string; email: string; role: string; projectRoles?: ProjectRole[] }

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  socket: ReturnType<typeof io> | null;
  signIn: (username: string, password: string) => Promise<unknown>;
  signUp: (username: string, email: string, password: string, projectHash?: string | null) => Promise<unknown>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      setLoading(false);
      return;
    }

    verifyToken()
      .then((data) => {
        setUser(data.user);
        connectSocket(data.user);
      })
      .catch(() => {
        localStorage.removeItem('authToken');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => () => {
    socket?.disconnect();
  }, [socket]);

  const connectSocket = (userData: User | null) => {
    if (socket) return;
    const apiBase = import.meta.env.VITE_API_BASE || `${window.location.origin}/api`;
    const socketUrl = import.meta.env.VITE_SOCKET_URL || apiBase.replace(/\/api\/?$/, '');
    const newSocket = io(socketUrl, { transports: ['websocket', 'polling'] });
    newSocket.on('connect', () => {
      userData?.projectRoles?.forEach((pr) => {
        const projectId = typeof pr.project === 'string' ? pr.project : pr.project?.toString?.();
        if (projectId) newSocket.emit('joinProject', projectId);
      });
    });
    setSocket(newSocket);
  };

  const signIn = async (username: string, password: string) => {
    const data = await login(username, password);
    localStorage.setItem('authToken', data.token);
    setUser(data.user);
    connectSocket(data.user);
    return data;
  };

  const signUp = async (username: string, email: string, password: string, projectHash: string | null = null) => {
    const data = await register(username, email, password, projectHash);
    localStorage.setItem('authToken', data.token);
    setUser(data.user);
    connectSocket(data.user);
    return data;
  };

  const signOut = () => {
    localStorage.removeItem('authToken');
    setUser(null);
    socket?.disconnect();
    setSocket(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, socket, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
