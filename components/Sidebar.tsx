'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';

const PRIMARY_NAV_ITEMS = [
  { href: '/dashboard', icon: 'bi-grid-fill', labelKey: 'page.dashboard' },
  { href: '/users', icon: 'bi-people-fill', labelKey: 'page.users' },
];

const MEETING_SUB_ITEMS = [
  { href: '/meetings', icon: 'bi-person-workspace', labelKey: 'page.meetingsCurrent' },
  { href: '/meetings/history', icon: 'bi-clock-history', labelKey: 'page.meetingsHistory' },
];

const TAIL_NAV_ITEMS = [
  { href: '/settings', icon: 'bi-gear-fill', labelKey: 'page.settings' },
];

const SETTINGS_SUB_ITEMS = [
  { href: '/settings?section=meetingPolicy', icon: 'bi-camera-video', labelKey: 'settings.menu.meetingPolicy' },
  { href: '/settings?section=userPolicy', icon: 'bi-person-gear', labelKey: 'settings.menu.userPolicy' },
  { href: '/settings?section=apiCatalog', icon: 'bi-list-check', labelKey: 'settings.menu.apiCatalog' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
  mobileOpen?: boolean;
  onNavigate?: () => void;
}

export default function Sidebar({ collapsed, onToggleSidebar, mobileOpen = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const isNavItemActive = (href: string) => {
    if (href === '/meetings') {
      // /meetings/history 등 다른 서브 경로는 제외
      return pathname === '/meetings' || (pathname.startsWith('/meetings/') && !pathname.startsWith('/meetings/history'));
    }
    if (href === '/meetings/history') return pathname.startsWith('/meetings/history');
    return pathname.startsWith(href);
  };

  const isMeetingGroupActive = pathname === '/meetings' || pathname.startsWith('/meetings/');
  const isSettingsGroupActive = pathname === '/settings' || pathname.startsWith('/settings/');
  const activeSettingsSection = searchParams.get('section') ?? 'meetingPolicy';

  return (
    <aside className={`mm-sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
      {/* Brand */}
      <div className="mm-sidebar-brand">
        <div className="mm-sidebar-brand-logo">
          <i className="bi bi-camera-video-fill" />
        </div>
        <span className="mm-sidebar-brand-name">MeetMate</span>
      </div>

      {/* Nav */}
      <nav className="mm-sidebar-nav">
        <div className="mm-nav-section-head">
          <div className="mm-nav-section-label">{t('common.menu')}</div>
          <button
            type="button"
            className="mm-nav-section-toggle"
            onClick={onToggleSidebar}
            title={collapsed ? t('common.menuExpand') : t('common.menuCollapse')}
            aria-label={collapsed ? t('common.menuExpand') : t('common.menuCollapse')}
          >
            <i className={`bi ${collapsed ? 'bi-chevron-double-right' : 'bi-chevron-double-left'} mm-nav-section-toggle-icon`} />
          </button>
        </div>
        {PRIMARY_NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`mm-nav-item${isNavItemActive(item.href) ? ' active' : ''}`}
            onClick={onNavigate}
          >
            <i className={`bi ${item.icon} mm-nav-item-icon`} />
            <span className="mm-nav-item-label">{t(item.labelKey)}</span>
          </Link>
        ))}

        <div className={`mm-nav-group${isMeetingGroupActive ? ' active' : ''}`}>
          <div className="mm-nav-item mm-nav-item-parent" aria-current={isMeetingGroupActive ? 'page' : undefined}>
            <i className="bi bi-camera-video-fill mm-nav-item-icon" />
            <span className="mm-nav-item-label">{t('page.meetings')}</span>
          </div>

          <div className="mm-nav-submenu">
            {MEETING_SUB_ITEMS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`mm-nav-item mm-nav-sub-item${isNavItemActive(item.href) ? ' active' : ''}`}
                onClick={onNavigate}
              >
                <i className={`bi ${item.icon} mm-nav-item-icon`} />
                <span className="mm-nav-item-label">{t(item.labelKey)}</span>
              </Link>
            ))}
          </div>
        </div>

        {TAIL_NAV_ITEMS.map(item => (
          <div key={item.href} className={`mm-nav-group${isSettingsGroupActive ? ' active' : ''}`}>
            <Link
              href={item.href}
              className={`mm-nav-item mm-nav-item-parent${isNavItemActive(item.href) ? ' active' : ''}`}
              onClick={onNavigate}
              aria-current={isSettingsGroupActive ? 'page' : undefined}
            >
              <i className={`bi ${item.icon} mm-nav-item-icon`} />
              <span className="mm-nav-item-label">{t(item.labelKey)}</span>
            </Link>

            <div className="mm-nav-submenu">
              {SETTINGS_SUB_ITEMS.map(sub => {
                const section = sub.href.split('section=')[1] ?? '';
                const isActive = isSettingsGroupActive && activeSettingsSection === section;
                return (
                  <Link
                    key={sub.href}
                    href={sub.href}
                    className={`mm-nav-item mm-nav-sub-item${isActive ? ' active' : ''}`}
                    onClick={onNavigate}
                  >
                    <i className={`bi ${sub.icon} mm-nav-item-icon`} />
                    <span className="mm-nav-item-label">{t(sub.labelKey)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
