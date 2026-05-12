'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isLoggedIn } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ToastProvider } from '@/components/Toast';
import { useI18n } from '@/components/I18nProvider';

const PAGE_TITLE_KEYS: Record<string, string> = {
  '/dashboard': 'page.dashboard',
  '/users': 'page.users',
  '/meetings': 'page.meetings',
  '/settings': 'page.settings',
};

function getPageTitle(pathname: string, t: (key: string) => string): string {
  const match = Object.keys(PAGE_TITLE_KEYS).find(k => pathname.startsWith(k));
  return match ? t(PAGE_TITLE_KEYS[match]) : t('page.fallbackTitle');
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const authenticated = isLoggedIn();

  useEffect(() => {
    if (!authenticated) {
      router.replace('/login');
    }
  }, [authenticated, router]);

  if (!authenticated) return null;

  return (
    <ToastProvider>
      <div className="mm-layout">
        <Sidebar collapsed={collapsed} />
        <main className={`mm-main${collapsed ? ' collapsed' : ''}`}>
          <Header
            title={getPageTitle(pathname, t)}
            onToggleSidebar={() => setCollapsed(v => !v)}
          />
          <div className="mm-content">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
