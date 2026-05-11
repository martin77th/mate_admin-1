'use client';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (type: ToastType, title: string, message?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const ICONS: Record<ToastType, string> = {
  success: 'bi-check-circle-fill',
  error:   'bi-x-circle-fill',
  warning: 'bi-exclamation-triangle-fill',
  info:    'bi-info-circle-fill',
};

function ToastContainer() {
  const { toasts, removeToast } = useContext(ToastContext)!;
  if (toasts.length === 0) return null;
  return (
    <div className="mm-toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`mm-toast mm-toast--${t.type}`}>
          <i className={`bi ${ICONS[t.type]} mm-toast-icon`} />
          <div className="mm-toast-content">
            <p className="mm-toast-title">{t.title}</p>
            {t.message && <p className="mm-toast-message">{t.message}</p>}
          </div>
          <button className="mm-toast-close" onClick={() => removeToast(t.id)}>
            <i className="bi bi-x" />
          </button>
        </div>
      ))}
    </div>
  );
}
