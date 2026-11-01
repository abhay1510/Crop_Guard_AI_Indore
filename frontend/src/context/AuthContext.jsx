import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../services/api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (getToken()) api.me().then((r) => setUser(r.user)).catch(() => setToken(null)).finally(() => setLoading(false));
    const onLogout = () => setUser(null);
    window.addEventListener('cg-logout', onLogout);
    return () => window.removeEventListener('cg-logout', onLogout);
  }, []);

  const finish = (r) => { setToken(r.token); setUser(r.user); };
  const value = {
    user, loading,
    login: async (b) => finish(await api.login(b)),
    register: async (b) => finish(await api.register(b)),
    logout: () => { setToken(null); setUser(null); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
