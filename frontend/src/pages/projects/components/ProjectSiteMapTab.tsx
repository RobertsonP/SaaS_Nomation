import React from 'react';
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
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading site map...</span>
      </div>
    );
  }

  if (siteMapData && siteMapData.nodes.length > 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Visual representation of your project's page structure
          </p>
          <button
            onClick={onShowDiscoveryModal}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            + Discover More Pages
          </button>
        </div>
        <div className="h-[500px] border border-gray-200 rounded-lg overflow-hidden">
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
    <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
        <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      </div>
      <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Site Map Yet</h4>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
        Discover pages automatically from a root URL to build your site map and visualize page relationships.
      </p>
      <button
        onClick={onShowDiscoveryModal}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        Start Page Discovery
      </button>
    </div>
  );
}
