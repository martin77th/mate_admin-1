'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isLoggedIn } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ToastProvider } from '@/components/Toast';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': '대시보드',
  '/users':     '사용자 관리',
  '/meetings':  '미팅 관리',
  '/settings':  '설정',
};

function getPageTitle(pathname: string): string {
  const match = Object.keys(PAGE_TITLES).find(k => pathname.startsWith(k));
  return match ? PAGE_TITLES[match] : 'MeetMate Admin';
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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
            title={getPageTitle(pathname)}
            onToggleSidebar={() => setCollapsed(v => !v)}
          />
          <div className="mm-content">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
