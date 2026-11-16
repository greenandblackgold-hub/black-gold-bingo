import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type ToastKind = 'error' | 'success';
type ToastItem = { id: number; kind: ToastKind; message: string };
const ToastContext = createContext<{ showToast: (kind: ToastKind, message: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const showToast = useCallback((kind: ToastKind, message: string) => {
    setToast({ id: Date.now(), kind, message });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);
  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 sm:bottom-6" role={toast.kind === 'error' ? 'alert' : 'status'} aria-live="polite">
          <div className={['flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm font-semibold text-white shadow-2xl backdrop-blur-xl', toast.kind === 'error' ? 'border-red-300/20 bg-red-950/95' : 'border-gold-300/20 bg-emerald-950/95'].join(' ')}>
            <span aria-hidden="true" className="text-lg leading-5">{toast.kind === 'error' ? '✖' : '✔'}</span>
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}
