import { Lock, CheckCircle, AlertCircle, Globe, Minus } from 'lucide-react';

export function SiteMapLegend() {
  const items = [
    {
      icon: <CheckCircle className="w-3.5 h-3.5 text-green-600" />,
      label: 'Verified',
      description: 'Page analyzed and verified',
      color: 'border-green-500 bg-green-50',
    },
    {
      icon: <AlertCircle className="w-3.5 h-3.5 text-blue-600" />,
      label: 'Analyzed',
      description: 'Page analyzed, not verified',
      color: 'border-blue-500 bg-blue-50',
    },
    {
      icon: <Lock className="w-3.5 h-3.5 text-orange-600" />,
      label: 'Auth Required',
      description: 'Requires authentication',
      color: 'border-orange-500 bg-orange-50',
    },
    {
      icon: <Globe className="w-3.5 h-3.5 text-gray-400" />,
      label: 'Discovered',
      description: 'Auto-discovered, pending analysis',
      color: 'border-gray-400 bg-gray-50 border-dashed',
    },
  ];

  return (
    <div className="bg-white/90 backdrop-blur rounded-lg shadow px-3 py-2 text-xs">
      <div className="font-medium text-gray-700 mb-2">Legend</div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${item.color}`}>
              {item.icon}
            </div>
            <span className="text-gray-600">{item.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-gray-200">
        <div className="flex items-center gap-2 text-gray-500">
          <Minus className="w-4 h-4" />
          <span>Link between pages</span>
        </div>
      </div>
    </div>
  );
}

export default SiteMapLegend;
