'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', icon: 'bi-grid-fill',        label: '대시보드' },
  { href: '/users',     icon: 'bi-people-fill',       label: '사용자 관리' },
  { href: '/meetings',  icon: 'bi-camera-video-fill', label: '미팅 관리' },
  { href: '/settings',  icon: 'bi-gear-fill',         label: '설정' },
];

interface SidebarProps {
  collapsed: boolean;
}

export default function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname();

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
        <div className="mm-nav-section-label">메뉴</div>
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`mm-nav-item${pathname.startsWith(item.href) ? ' active' : ''}`}
          >
            <i className={`bi ${item.icon} mm-nav-item-icon`} />
            <span className="mm-nav-item-label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
