import { useState, useMemo } from 'react';
import { ProjectElement } from '../../types/element.types';
import { ElementCard } from './ElementCard';

interface ElementLibrarySidebarProps {
  elements: ProjectElement[];
  onSelectElement: (element: ProjectElement) => void;
  isLoading?: boolean;
  className?: string;
}

export function ElementLibrarySidebar({ 
  elements, 
  onSelectElement, 
  isLoading = false,
  className = ''
}: ElementLibrarySidebarProps) {
  const [selectedType, setSelectedType] = useState<string>('all');

  // Filter elements based on type only
  const filteredElements = useMemo(() => {
    return elements.filter(element => {
      const matchesType = selectedType === 'all' || element.elementType === selectedType;
      return matchesType;
    });
  }, [elements, selectedType]);

  // Get unique element types for filter
  const elementTypes = useMemo(() => {
    const types = ['all', ...new Set(elements.map(e => e.elementType))];
    return types;
  }, [elements]);

  const getElementTypeIcon = (type: string) => {
    switch (type) {
      case 'button': return '🔘';
      case 'input': return '📝';
      case 'link': return '🔗';
      case 'form': return '📋';
      case 'navigation': return '🧭';
      case 'text': return '📄';
      default: return '📦';
    }
  };

  return (
    <div className={`bg-white border-r border-gray-200 flex flex-col h-full ${className}`}>
      {/* Compact Header with Type Filter Only */}
      <div className="border-b border-gray-200 p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900">Elements</h2>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {elementTypes.map(type => (
              <option key={type} value={type}>
                {type === 'all' ? 'All' : `${getElementTypeIcon(type)} ${type}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Elements List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center">
            <div className="text-gray-400 text-2xl mb-2">⏳</div>
            <div className="text-sm text-gray-500">Loading elements...</div>
          </div>
        ) : filteredElements.length === 0 ? (
          <div className="p-4 text-center">
            <div className="text-gray-400 text-4xl mb-2">📦</div>
            <div className="text-sm text-gray-500 mb-1">
              {elements.length === 0 ? 'No elements found' : 'No matching elements'}
            </div>
            <div className="text-xs text-gray-400">
              {elements.length === 0 
                ? 'Run project analysis to discover elements'
                : 'Try adjusting your search or filters'
              }
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {filteredElements.map((element) => (
              <ElementCard
                key={element.id}
                element={element}
                onSelect={() => onSelectElement(element)}
                size="medium"
                showActions={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}