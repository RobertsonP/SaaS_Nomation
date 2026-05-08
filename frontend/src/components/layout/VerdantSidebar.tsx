import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Folder,
  Globe,
  LayoutDashboard,
  Layers,
  LogOut,
  Moon,
  Network,
  Plus,
  Settings,
  Shield,
  Sun,
  Target,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useProjects } from '../../contexts/ProjectsContext';

const COLLAPSED_KEY = 'verdant-sidebar-collapsed';
const EXPANDED_KEY = 'verdant-sidebar-expanded';

const ICON_SIZE = 14;

interface VerdantSidebarProps {
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
}

interface NavLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  count?: number | null;
  indent?: boolean;
  exact?: boolean;
}

export function VerdantSidebar({ collapsed, setCollapsed }: VerdantSidebarProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { projects } = useProjects();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (to: string, exact = false) => {
    const [path, query] = to.split('?');
    const targetTab = query ? new URLSearchParams(query).get('tab') : null;
    const currentTab = new URLSearchParams(location.search).get('tab');

    // Path must match (exact or as a prefix).
    const pathMatch = exact ? location.pathname === path : location.pathname === path || location.pathname.startsWith(path + '/');
    if (!pathMatch) return false;

    // If the link points to a specific tab, active only when current URL is on the same tab.
    if (targetTab) return currentTab === targetTab;

    // The link has no tab — active when no tab query is set (default Overview view) and path is exact.
    if (currentTab) return false;
    return true;
  };

  const activeProjectId = useMemo(() => {
    const m = location.pathname.match(/^\/projects\/([^/]+)/);
    return m ? m[1] : null;
  }, [location.pathname]);

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      const raw = window.localStorage.getItem(EXPANDED_KEY);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      return new Set(activeProjectId ? [...arr, activeProjectId] : arr);
    } catch {
      return new Set(activeProjectId ? [activeProjectId] : []);
    }
  });

  // Auto-expand the active project so its sub-nav is visible.
  useEffect(() => {
    if (!activeProjectId) return;
    setExpanded((prev) => {
      if (prev.has(activeProjectId)) return prev;
      const next = new Set(prev);
      next.add(activeProjectId);
      return next;
    });
  }, [activeProjectId]);

  // Persist expansion state.
  useEffect(() => {
    try {
      window.localStorage.setItem(EXPANDED_KEY, JSON.stringify([...expanded]));
    } catch {
      // ignore storage errors
    }
  }, [expanded]);

  const toggleProject = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const NavLink = ({ to, icon, label, count, indent, exact }: NavLinkProps) => {
    const active = isActive(to, exact);
    return (
      <Link
        to={to}
        className={`nav-item ${active ? 'active' : ''} ${indent ? 'indent' : ''}`}
        title={collapsed ? label : undefined}
      >
        <span className="nav-icon">{icon}</span>
        <span>{label}</span>
        {count != null && <span className="count">{count}</span>}
      </Link>
    );
  };

  const handleToggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      // ignore
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <Link to="/dashboard" className="brand" style={{ textDecoration: 'none' }}>
          <div className="brand-mark"></div>
          <span>Nomation</span>
        </Link>
        <div className="row" style={{ gap: 2 }}>
          <button
            className="icon-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={ICON_SIZE} /> : <Moon size={ICON_SIZE} />}
          </button>
          <button
            className="icon-btn"
            onClick={handleToggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={ICON_SIZE} /> : <ChevronLeft size={ICON_SIZE} />}
          </button>
        </div>
      </div>

      <nav className="nav">
        <NavLink to="/dashboard" icon={<LayoutDashboard size={ICON_SIZE} />} label="Dashboard" exact />
        <NavLink
          to="/projects"
          icon={<Folder size={ICON_SIZE} />}
          label="All projects"
          count={projects.length}
          exact
        />

        <div className="nav-label">Workspace</div>
        {projects.map((p) => {
          const isOpen = expanded.has(p.id);
          const isCurrentProject = activeProjectId === p.id;
          const projectRoot = `/projects/${p.id}`;
          return (
            <div key={p.id} className={`nav-project ${isCurrentProject ? 'current' : ''}`}>
              <Link
                to={projectRoot}
                className={`nav-item project-row ${
                  location.pathname === projectRoot ? 'active' : ''
                }`}
                title={collapsed ? p.name : undefined}
              >
                <button
                  type="button"
                  className="chev"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleProject(p.id);
                  }}
                  aria-label={isOpen ? `Collapse ${p.name}` : `Expand ${p.name}`}
                >
                  <span
                    style={{
                      transform: isOpen ? 'rotate(90deg)' : 'none',
                      transition: 'transform .15s',
                      display: 'inline-flex',
                    }}
                  >
                    <ChevronRight size={ICON_SIZE} />
                  </span>
                </button>
                <span className="nav-icon">
                  <Box size={ICON_SIZE} />
                </span>
                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.name}
                </span>
                {/* Project status indicator — rendered as a small mute dot until we have run-aggregate health. */}
                <span className="pill pill-mute" style={{ padding: '0 5px', fontSize: 9.5 }}>
                  <span className="dot"></span>
                </span>
              </Link>
              {isOpen && (
                <div className="project-children">
                  <NavLink
                    indent
                    to={projectRoot}
                    icon={<LayoutDashboard size={ICON_SIZE} />}
                    label="Overview"
                    exact
                  />
                  {/* Sites / Sitemap / Elements / Auth flows are tabs on ProjectDetailsPage —
                      navigated via ?tab=… so internal tab state stays in sync. */}
                  <NavLink
                    indent
                    to={`${projectRoot}?tab=urls`}
                    icon={<Globe size={ICON_SIZE} />}
                    label="Sites"
                    count={p._count?.urls ?? p.urls?.length ?? 0}
                    exact
                  />
                  <NavLink
                    indent
                    to={`${projectRoot}?tab=sitemap`}
                    icon={<Network size={ICON_SIZE} />}
                    label="Sitemap"
                    exact
                  />
                  <NavLink
                    indent
                    to={`${projectRoot}?tab=elements`}
                    icon={<Target size={ICON_SIZE} />}
                    label="Elements"
                    count={p._count?.elements ?? 0}
                    exact
                  />
                  <NavLink
                    indent
                    to={`${projectRoot}/tests`}
                    icon={<FlaskConical size={ICON_SIZE} />}
                    label="Tests"
                    count={p._count?.tests ?? 0}
                  />
                  <NavLink
                    indent
                    to={`${projectRoot}/suites`}
                    icon={<Layers size={ICON_SIZE} />}
                    label="Suites"
                    count={p._count?.testSuites ?? 0}
                  />
                  {/* Runs is not a separate route yet — point to the Tests page where users
                      currently access run history per test. Phase 4 may add a dedicated page. */}
                  <NavLink
                    indent
                    to={`${projectRoot}/tests`}
                    icon={<Activity size={ICON_SIZE} />}
                    label="Runs"
                  />
                  <NavLink
                    indent
                    to={`${projectRoot}?tab=auth`}
                    icon={<Shield size={ICON_SIZE} />}
                    label="Auth flows"
                    exact
                  />
                  {/* Per-project Settings tab is not implemented yet; the ?tab=settings
                      query disambiguates the sidebar active state from Overview while
                      ProjectDetailsPage falls back to its overview view. */}
                  <NavLink
                    indent
                    to={`${projectRoot}?tab=settings`}
                    icon={<Settings size={ICON_SIZE} />}
                    label="Settings"
                    exact
                  />
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          className="nav-item nav-add"
          onClick={() => navigate('/projects?new=1')}
          title="Create a new project"
        >
          <span className="nav-icon">
            <Plus size={ICON_SIZE} />
          </span>
          <span>New project</span>
        </button>

        <div className="nav-label">Settings</div>
        <NavLink to="/settings/profile" icon={<User size={ICON_SIZE} />} label="Profile" />
        <NavLink
          to="/settings/notifications"
          icon={<Bell size={ICON_SIZE} />}
          label="Notifications"
        />
        {/* Team & billing route doesn't exist yet — keep visible to match design;
            clicking lands on profile for now. */}
        <NavLink to="/settings/profile" icon={<Users size={ICON_SIZE} />} label="Team & billing" />
        <NavLink to="/dashboard" icon={<Zap size={ICON_SIZE} />} label="Get started" />
      </nav>

      <div className="sidebar-foot">
        <div className="profile-row" title={user?.email ?? ''}>
          <div className="avatar">{user?.name?.charAt(0).toUpperCase() ?? '?'}</div>
          <div className="profile-meta">
            <div className="profile-name">{user?.name ?? 'Loading...'}</div>
            <div className="profile-email">{user?.email ?? ''}</div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="icon-btn"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut size={ICON_SIZE} />
          </button>
          <span className="dim">
            <ChevronDown size={ICON_SIZE} />
          </span>
        </div>
      </div>
    </aside>
  );
}
