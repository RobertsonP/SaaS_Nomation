import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { VerdantSidebar } from './VerdantSidebar';
import { VerdantTopbar } from './VerdantTopbar';
import { FlowDiagramModal } from '../ui/FlowDiagramModal';

const COLLAPSED_KEY = 'verdant-sidebar-collapsed';
const MOBILE_BREAKPOINT = 768;

export function VerdantShell() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  });
  // Mobile-only: drawer state for the off-canvas sidebar.
  const [mobileOpen, setMobileOpen] = useState(false);
  // "How it works" modal — globally accessible from the topbar.
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  // Auto-close the mobile drawer on every route change so it doesn't linger
  // on top of the new page.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  // Auto-close the mobile drawer if the viewport widens past the breakpoint.
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > MOBILE_BREAKPOINT && mobileOpen) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [mobileOpen]);

  const handleSetCollapsed = (next: boolean) => {
    setCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      // ignore
    }
  };

  return (
    <div className={`app ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      {mobileOpen && (
        <button
          type="button"
          className="mobile-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
          style={{ border: 0, padding: 0 }}
        />
      )}
      <VerdantSidebar collapsed={collapsed} setCollapsed={handleSetCollapsed} />
      <div className="main">
        <VerdantTopbar
          onToggleMobileMenu={() => setMobileOpen((v) => !v)}
          onOpenHowItWorks={() => setHowItWorksOpen(true)}
        />
        <Outlet />
      </div>
      <FlowDiagramModal open={howItWorksOpen} onClose={() => setHowItWorksOpen(false)} />
    </div>
  );
}
