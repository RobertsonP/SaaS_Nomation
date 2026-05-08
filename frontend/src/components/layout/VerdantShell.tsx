import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { VerdantSidebar } from './VerdantSidebar';
import { VerdantTopbar } from './VerdantTopbar';

const COLLAPSED_KEY = 'verdant-sidebar-collapsed';

export function VerdantShell() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  });

  return (
    <div className={`app ${collapsed ? 'collapsed' : ''}`}>
      <VerdantSidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="main">
        <VerdantTopbar />
        <Outlet />
      </div>
    </div>
  );
}
