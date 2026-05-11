'use client';
import { useState, useEffect, useRef } from 'react';
import { logout, getStoredUser } from '@/lib/auth';
import { getInitials } from '@/lib/utils';

interface HeaderProps {
  title: string;
  onToggleSidebar: () => void;
}

export default function Header({ title, onToggleSidebar }: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const user = getStoredUser();

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="mm-header">
      <div className="mm-header-left">
        <button className="mm-sidebar-toggle" onClick={onToggleSidebar} title="사이드바 토글">
          <i className="bi bi-list" />
        </button>
        <h1 className="mm-header-title">{title}</h1>
      </div>
      <div className="mm-header-right">
        <div className="mm-dropdown" ref={dropdownRef}>
          <div
            className="mm-user-avatar"
            onClick={() => setDropdownOpen(v => !v)}
            title={user?.user_name ?? user?.auth_name ?? ''}
          >
            {getInitials(user?.user_name ?? user?.auth_name)}
          </div>
          {dropdownOpen && (
            <div className="mm-dropdown-menu">
              <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid var(--mm-border)', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mm-text-primary)' }}>
                  {user?.user_name ?? user?.auth_name ?? '관리자'}
                </div>
                {user?.role && (
                  <div style={{ fontSize: 11, color: 'var(--mm-text-muted)', marginTop: 2 }}>{user.role}</div>
                )}
              </div>
              <button className="mm-dropdown-item danger" onClick={logout}>
                <i className="bi bi-box-arrow-right" />
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
