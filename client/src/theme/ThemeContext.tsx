import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';

export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM';
type ThemeState = { dark: boolean; toggle: () => void; preference: ThemePreference };
const Theme = createContext<ThemeState>({ dark: false, toggle: () => {}, preference: 'SYSTEM' });
function systemDark() { return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false; }

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [preference, setPreference] = useState<ThemePreference>(() => (localStorage.getItem('rhyme_theme_preference') as ThemePreference) || 'SYSTEM');
  const [dark, setDark] = useState(() => preference === 'DARK' || (preference === 'SYSTEM' && systemDark()));
  useEffect(() => {
    const saved = session?.user.profile?.themePreference;
    if (saved) setPreference(saved);
  }, [session?.user.profile?.themePreference]);
  useEffect(() => {
    const nextDark = preference === 'DARK' || (preference === 'SYSTEM' && systemDark());
    setDark(nextDark);
    document.documentElement.classList.toggle('dark', nextDark);
    document.documentElement.style.colorScheme = nextDark ? 'dark' : 'light';
    localStorage.setItem('rhyme_theme_preference', preference);
  }, [preference]);
  useEffect(() => {
    if (preference !== 'SYSTEM') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setDark(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [preference]);
  const toggle = () => { const next = dark ? 'LIGHT' : 'DARK'; setPreference(next); if (session) api.patch('/profile', { themePreference: next }).catch(() => {}); };
  return <Theme.Provider value={{ dark, toggle, preference }}>{children}</Theme.Provider>;
}
export const useTheme = () => useContext(Theme);
export function ThemeToggle() { const { dark, toggle } = useTheme(); return <button type="button" onClick={toggle} title={dark?'Switch to light mode':'Switch to dark mode'} aria-label={dark?'Switch to light mode':'Switch to dark mode'} className="rounded-xl p-2 text-ink/70 hover:bg-mint focus-ring">{dark?<Sun size={19}/>:<Moon size={19}/>}</button>; }
