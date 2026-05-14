'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { isLoggedIn } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import MobileBottomNav from '@/components/MobileBottomNav';
import { ToastProvider } from '@/components/Toast';
import { useI18n } from '@/components/I18nProvider';

const DESKTOP_MIN_WIDTH = 1200;
const DESKTOP_AUTO_COLLAPSE_MAX_WIDTH = 1440;

const PAGE_TITLE_KEYS: Record<string, string> = {
  '/meetings/history': 'page.meetingsHistory',
  '/meetings/new': 'page.meetingsCreate',
  '/users/new': 'page.usersCreate',
  '/users/': 'page.usersEdit',
  '/dashboard': 'page.dashboard',
  '/users': 'page.users',
  '/meetings': 'page.meetings',
  '/settings': 'page.settings',
};

const SETTINGS_SECTION_TITLE_KEYS: Record<string, string> = {
  meetingPolicy: 'settings.menu.meetingPolicy',
  userPolicy: 'settings.menu.userPolicy',
  apiCatalog: 'settings.menu.apiCatalog',
};

function getPageTitle(pathname: string, section: string | null, t: (key: string) => string): string {
  if (pathname === '/settings' || pathname.startsWith('/settings/')) {
    const titleKey = (section && SETTINGS_SECTION_TITLE_KEYS[section]) || SETTINGS_SECTION_TITLE_KEYS.meetingPolicy;
    return t(titleKey);
  }

  if (pathname.startsWith('/meetings/') && pathname.endsWith('/edit')) {
    return t('page.meetingsEdit');
  }
  if (pathname.startsWith('/meetings/') && !pathname.startsWith('/meetings/history') && !pathname.startsWith('/meetings/new')) {
    return t('page.meetingsDetail');
  }

  const match = Object.keys(PAGE_TITLE_KEYS).find(k => pathname.startsWith(k));
  return match ? t(PAGE_TITLE_KEYS[match]) : t('page.fallbackTitle');
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const authenticated = useSyncExternalStore(
    () => () => {},
    () => isLoggedIn(),
    () => true
  );

  useEffect(() => {
    if (!authenticated) {
      router.replace('/login');
    }
  }, [authenticated, router]);

  useEffect(() => {
    const applyAutoCollapse = () => {
      const width = window.innerWidth;
      const shouldCollapse = width >= DESKTOP_MIN_WIDTH && width <= DESKTOP_AUTO_COLLAPSE_MAX_WIDTH;
      setCollapsed(shouldCollapse);
    };

    applyAutoCollapse();
    window.addEventListener('resize', applyAutoCollapse);
    return () => {
      window.removeEventListener('resize', applyAutoCollapse);
    };
  }, []);

  if (!authenticated) return null;

  return (
    <ToastProvider>
      <div className="mm-layout">
        <Sidebar
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed(v => !v)}
          mobileOpen={mobileMenuOpen}
          onNavigate={() => setMobileMenuOpen(false)}
        />
        {mobileMenuOpen && (
          <button
            type="button"
            className="mm-sidebar-mobile-backdrop"
            onClick={() => setMobileMenuOpen(false)}
            aria-label={t('common.menuCollapse')}
          />
        )}
        <main className={`mm-main${collapsed ? ' collapsed' : ''}`}>
          <Header title={getPageTitle(pathname, searchParams.get('section'), t)} onToggleMobileMenu={() => setMobileMenuOpen(v => !v)} />
          <div className="mm-content">{children}</div>
          <MobileBottomNav />
        </main>
      </div>
    </ToastProvider>
  );
}
