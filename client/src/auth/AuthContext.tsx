import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';

export type Session = { user: { id: string; role: 'ADMIN' | 'LECTURER' | 'LEARNER'; email: string; profile?: { firstName: string; lastName: string }; registrationNo?: string } };
type AuthState = { session: Session | null; restoring: boolean; login: (identifier: string, password: string) => Promise<void>; logout: () => Promise<void> };
const C = createContext<AuthState>({ session: null, restoring: true, login: async () => {}, logout: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);
  useEffect(() => { const expire = () => setSession(null); window.addEventListener('rhyme:unauthorized', expire); api.get('/auth/me').then(r => setSession({ user: r.data.data })).catch(() => setSession(null)).finally(() => setRestoring(false)); return () => window.removeEventListener('rhyme:unauthorized', expire); }, []);
  const login = async (identifier: string, password: string) => { const r = await api.post('/auth/login', { identifier, password }); setSession(r.data.data as Session); };
  const logout = async () => { try { await api.post('/auth/logout'); } finally { setSession(null); } };
  return <C.Provider value={{ session, restoring, login, logout }}>{children}</C.Provider>;
}
export const useAuth = () => useContext(C);
