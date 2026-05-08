import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Zap } from 'lucide-react';
import { useProjects } from '../../contexts/ProjectsContext';

interface Crumb {
  label: string;
  href?: string;
}

/**
 * Build breadcrumbs from the current pathname.
 * The route table:
 *   /dashboard                                       → Nomation / Dashboard
 *   /projects                                        → Nomation / Projects
 *   /projects/:id                                    → Nomation / Projects / <project name>
 *   /projects/:id?tab=urls                           → … / Sites
 *   /projects/:id/tests                              → … / Tests
 *   /projects/:id/tests/new                          → … / Tests / New test
 *   /projects/:id/tests/:testId/edit                 → … / Tests / <test name or id>
 *   /projects/:id/suites                             → … / Suites
 *   /projects/:id/suites/:suiteId                    → … / Suites / <suite>
 *   /projects/:id/auth/setup                         → … / Auth setup
 *   /tests/:testId/results                           → Nomation / Tests / Results
 *   /suites/:suiteId/results                         → Nomation / Suites / Results
 *   /settings/profile, /settings/notifications      → Nomation / Settings / …
 */
function useCrumbs(): Crumb[] {
  const location = useLocation();
  const { projects, getProjectById } = useProjects();
  const search = new URLSearchParams(location.search);

  return useMemo(() => {
    const path = location.pathname;
    const segs = path.split('/').filter(Boolean);
    const crumbs: Crumb[] = [{ label: 'Nomation', href: '/dashboard' }];

    if (segs.length === 0 || segs[0] === 'dashboard') {
      crumbs.push({ label: 'Dashboard' });
      return crumbs;
    }

    if (segs[0] === 'settings') {
      crumbs.push({ label: 'Settings' });
      const sub = segs[1];
      if (sub === 'profile') crumbs.push({ label: 'Profile' });
      else if (sub === 'notifications') crumbs.push({ label: 'Notifications' });
      return crumbs;
    }

    if (segs[0] === 'projects') {
      crumbs.push({ label: 'Projects', href: '/projects' });
      const projectId = segs[1];
      if (!projectId) {
        crumbs[crumbs.length - 1] = { label: 'Projects' };
        return crumbs;
      }

      const project = getProjectById(projectId);
      const projectLabel = project?.name ?? '…';
      const projectHref = `/projects/${projectId}`;
      const isOnProjectRoot = segs.length === 2;

      if (isOnProjectRoot) {
        const tab = search.get('tab');
        crumbs.push({ label: projectLabel, href: tab ? projectHref : undefined });
        if (tab === 'urls') crumbs.push({ label: 'Sites' });
        else if (tab === 'sitemap') crumbs.push({ label: 'Sitemap' });
        else if (tab === 'elements') crumbs.push({ label: 'Elements' });
        else if (tab === 'auth') crumbs.push({ label: 'Auth flows' });
        return crumbs;
      }

      // Sub-routes under /projects/:id/...
      crumbs.push({ label: projectLabel, href: projectHref });
      const sub = segs[2];
      if (sub === 'tests') {
        crumbs.push({ label: 'Tests', href: `${projectHref}/tests` });
        if (segs[3] === 'new') crumbs.push({ label: 'New test' });
        else if (segs[3] && segs[4] === 'edit') crumbs.push({ label: 'Edit test' });
      } else if (sub === 'suites') {
        crumbs.push({ label: 'Suites', href: `${projectHref}/suites` });
        if (segs[3]) crumbs.push({ label: 'Suite details' });
      } else if (sub === 'auth') {
        crumbs.push({ label: 'Auth setup' });
      }
      return crumbs;
    }

    if (segs[0] === 'tests' && segs[2] === 'results') {
      crumbs.push({ label: 'Tests' });
      crumbs.push({ label: 'Results' });
      return crumbs;
    }
    if (segs[0] === 'suites' && segs[2] === 'results') {
      crumbs.push({ label: 'Suites' });
      crumbs.push({ label: 'Results' });
      return crumbs;
    }

    crumbs.push({ label: path });
    return crumbs;
    // We intentionally only depend on path/search/projects to keep this stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, projects.length]);
}

interface VerdantTopbarProps {
  /** Optional right-side action area injected by the page (e.g. variation toggles, future extension points). */
  actions?: React.ReactNode;
  /** Click handler for "How it works" — wired in Phase 7 to FlowDiagramModal. */
  onOpenHowItWorks?: () => void;
}

export function VerdantTopbar({ actions, onOpenHowItWorks }: VerdantTopbarProps) {
  const crumbs = useCrumbs();

  return (
    <div className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i} className="row" style={{ gap: 6 }}>
            {i > 0 && <span className="sep">/</span>}
            {c.href ? (
              <Link to={c.href}>{c.label}</Link>
            ) : (
              <span className={i === crumbs.length - 1 ? 'current' : ''}>{c.label}</span>
            )}
          </span>
        ))}
      </div>

      <div className="topbar-actions">
        {/* ⌘K search ships visual-only in Phase 1; wired up in Phase 8 if a search endpoint exists. */}
        <div className="search">
          <span style={{ width: 12, height: 12, display: 'inline-grid', placeItems: 'center' }}>
            <Search size={12} />
          </span>
          <input placeholder="Search tests, elements, runs…" disabled />
          <span className="kbd">⌘K</span>
        </div>

        {actions}

        <button
          className="btn btn-ghost btn-sm"
          title="How Nomation works"
          onClick={onOpenHowItWorks ?? (() => undefined)}
        >
          <Zap size={13} className="ico" />
          <span>How it works</span>
        </button>
      </div>
    </div>
  );
}
