import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Lock, CheckCircle, AlertCircle, Globe, ExternalLink } from 'lucide-react';

// Data stored in each node
interface SiteMapNodeDataPayload {
  url: string;
  title: string;
  analyzed: boolean;
  verified: boolean;
  requiresAuth: boolean;
  pageType?: string;
  discovered: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  screenshot?: string;  // Base64 thumbnail image
}


interface SiteMapNodeProps {
  id: string;
  data: SiteMapNodeDataPayload;
}

function SiteMapNode({ id, data }: SiteMapNodeProps) {
  const { title, url, analyzed, verified, requiresAuth, pageType, discovered, selected, onSelect, screenshot } = data;

  // Handle opening URL in new tab
  const handleOpenUrl = (e: React.MouseEvent) => {
    e.stopPropagation();  // Don't trigger node selection
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Determine node color based on status
  const getNodeStyles = () => {
    if (requiresAuth) {
      return 'border-orange-500 bg-orange-50';
    }
    if (analyzed && verified) {
      return 'border-green-500 bg-green-50';
    }
    if (analyzed) {
      return 'border-blue-500 bg-blue-50';
    }
    if (!discovered) {
      return 'border-gray-300 bg-white';
    }
    return 'border-gray-400 bg-gray-50 border-dashed';
  };

  // Get status icon
  const getStatusIcon = () => {
    if (requiresAuth) {
      return <Lock className="w-3.5 h-3.5 text-orange-600" />;
    }
    if (verified) {
      return <CheckCircle className="w-3.5 h-3.5 text-green-600" />;
    }
    if (analyzed) {
      return <AlertCircle className="w-3.5 h-3.5 text-blue-600" />;
    }
    return <Globe className="w-3.5 h-3.5 text-gray-400" />;
  };

  // Get page type badge color
  const getPageTypeBadge = () => {
    const typeColors: Record<string, string> = {
      home: 'bg-purple-100 text-purple-700',
      product: 'bg-green-100 text-green-700',
      category: 'bg-blue-100 text-blue-700',
      cart: 'bg-yellow-100 text-yellow-700',
      checkout: 'bg-red-100 text-red-700',
      account: 'bg-orange-100 text-orange-700',
      content: 'bg-gray-100 text-gray-700',
      form: 'bg-pink-100 text-pink-700',
    };
    return typeColors[pageType || 'content'] || 'bg-gray-100 text-gray-700';
  };

  // Extract display URL (path only)
  const displayUrl = (() => {
    try {
      const parsed = new URL(url);
      return parsed.pathname || '/';
    } catch {
      return url;
    }
  })();

  return (
    <div
      className={`
        px-4 py-3 rounded-lg border-2 shadow-sm min-w-[200px] max-w-[280px] cursor-pointer transition-all
        ${getNodeStyles()}
        ${selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
        hover:shadow-md
      `}
      onClick={() => onSelect?.(id)}
    >
      {/* Target handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 !bg-gray-400"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {getStatusIcon()}
          <button
            onClick={handleOpenUrl}
            className="font-medium text-sm text-gray-900 hover:text-blue-600 truncate max-w-[120px] flex items-center gap-1 group"
            title={`Open ${url} in new tab`}
          >
            <span className="truncate">{title || 'Untitled'}</span>
            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
          </button>
        </div>
        {selected && (
          <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* URL */}
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
        <span className="truncate">{displayUrl}</span>
      </div>

      {/* Footer badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {pageType && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getPageTypeBadge()}`}>
            {pageType}
          </span>
        )}
        {requiresAuth && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700">
            Auth
          </span>
        )}
        {discovered && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
            Auto
          </span>
        )}
      </div>

      {/* Screenshot thumbnail */}
      {screenshot && (
        <div className="mt-2 rounded overflow-hidden border border-gray-200 bg-gray-100">
          <img
            src={screenshot}
            alt={`Preview of ${title}`}
            className="w-full h-16 object-cover object-top"
            loading="lazy"
          />
        </div>
      )}

      {/* Source handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 !bg-gray-400"
      />
    </div>
  );
}

export default memo(SiteMapNode);
