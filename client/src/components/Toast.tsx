import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert, X } from 'lucide-react';

type Toast = { id: number; message: string; kind: 'success' | 'error' };
const ToastContext = createContext<(message: string, kind?: Toast['kind']) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const notify = useCallback((message: string, kind: Toast['kind'] = 'success') => {
    const id = Date.now() + Math.random();
    setItems(current => [...current, { id, message, kind }]);
    window.setTimeout(() => setItems(current => current.filter(item => item.id !== id)), 4200);
  }, []);
  return <ToastContext.Provider value={notify}>{children}<div className="fixed right-4 top-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">{items.map(item => <div key={item.id} role={item.kind === 'error' ? 'alert' : 'status'} className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white p-4 text-sm shadow-card dark:border-white/10"><span className={item.kind === 'success' ? 'text-forest' : 'text-coral'}>{item.kind === 'success' ? <CheckCircle2 size={19}/> : <CircleAlert size={19}/>}</span><p className="flex-1">{item.message}</p><button onClick={() => setItems(current => current.filter(value => value.id !== item.id))} aria-label="Dismiss notification"><X size={16}/></button></div>)}</div></ToastContext.Provider>;
}
export const useToast = () => useContext(ToastContext);
