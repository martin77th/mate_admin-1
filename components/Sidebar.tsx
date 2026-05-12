'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';

const NAV_ITEMS = [
  { href: '/dashboard', icon: 'bi-grid-fill', labelKey: 'page.dashboard' },
  { href: '/users', icon: 'bi-people-fill', labelKey: 'page.users' },
  { href: '/meetings', icon: 'bi-camera-video-fill', labelKey: 'page.meetings' },
  { href: '/settings', icon: 'bi-gear-fill', labelKey: 'page.settings' },
];

interface SidebarProps {
  collapsed: boolean;
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside className={`mm-sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* Brand */}
      <div className="mm-sidebar-brand">
        <div className="mm-sidebar-brand-logo">
          <i className="bi bi-camera-video-fill" />
        </div>
        <span className="mm-sidebar-brand-name">MeetMate</span>
      </div>

      {/* Nav */}
      <nav className="mm-sidebar-nav">
        <div className="mm-nav-section-label">{t('common.menu')}</div>
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`mm-nav-item${pathname.startsWith(item.href) ? ' active' : ''}`}
          >
            <i className={`bi ${item.icon} mm-nav-item-icon`} />
            <span className="mm-nav-item-label">{t(item.labelKey)}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
