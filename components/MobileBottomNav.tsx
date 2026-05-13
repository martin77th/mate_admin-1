'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';

const ITEMS = [
  { href: '/dashboard', icon: 'bi-grid-fill', labelKey: 'page.dashboard' },
  { href: '/users', icon: 'bi-people-fill', labelKey: 'page.users' },
  { href: '/meetings', icon: 'bi-camera-video-fill', labelKey: 'page.meetings' },
  { href: '/settings', icon: 'bi-gear-fill', labelKey: 'page.settings' },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  const isActive = (href: string) => {
    if (href === '/meetings') return pathname.startsWith('/meetings');
    return pathname.startsWith(href);
  };

  return (
    <nav className="mm-mobile-bottom-nav" aria-label={t('common.menu')}>
      {ITEMS.map(item => (
        <Link
          key={item.href}
          href={item.href}
          className={`mm-mobile-bottom-nav-item${isActive(item.href) ? ' active' : ''}`}
        >
          <i className={`bi ${item.icon}`} />
          <span>{t(item.labelKey)}</span>
        </Link>
      ))}
    </nav>
  );
}
