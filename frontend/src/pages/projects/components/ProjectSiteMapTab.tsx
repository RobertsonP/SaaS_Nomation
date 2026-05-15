import { Network, Plus } from 'lucide-react';
import { SiteMapGraph } from '../../../components/sitemap';

interface SiteMapData {
  nodes: any[];
  edges: any[];
}

interface ProjectSiteMapTabProps {
  siteMapData: SiteMapData | null;
  siteMapLoading: boolean;
  onShowDiscoveryModal: () => void;
}

export function ProjectSiteMapTab({
  siteMapData,
  siteMapLoading,
  onShowDiscoveryModal,
}: ProjectSiteMapTabProps) {
  if (siteMapLoading) {
    return (
      <div className="row" style={{ minHeight: '40vh', justifyContent: 'center', gap: 12 }}>
        <div className="skel" style={{ width: 32, height: 32, borderRadius: '50%' }} />
        <span className="dim" style={{ fontSize: 12 }}>Loading site map…</span>
      </div>
    );
  }

  if (siteMapData && siteMapData.nodes.length > 0) {
    return (
      <div className="col" style={{ gap: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <p className="dim" style={{ fontSize: 12, margin: 0 }}>
            Visual representation of your project's page structure.
          </p>
          <button
            type="button"
            onClick={onShowDiscoveryModal}
            className="btn btn-outline btn-sm"
          >
            <Plus size={13} />
            <span>Discover more pages</span>
          </button>
        </div>
        <div
          style={{
            height: 500,
            border: '1px solid var(--hair)',
            borderRadius: 8,
            overflow: 'hidden',
            background: 'var(--surface)',
          }}
        >
          <SiteMapGraph
            nodes={siteMapData.nodes}
            edges={siteMapData.edges}
            className="w-full h-full"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="empty">
        <div className="empty-icon">
          <Network size={20} />
        </div>
        <h3>No site map yet</h3>
        <p>
          Discover pages automatically from a root URL to build your site map and visualise
          how pages relate.
        </p>
        <button type="button" className="btn btn-primary" onClick={onShowDiscoveryModal}>
          <Plus size={13} />
          <span>Start page discovery</span>
        </button>
      </div>
    </div>
  );
}
