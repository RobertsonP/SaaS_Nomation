import { useState, useMemo } from 'react';
import { ProjectElement } from '../../types/element.types';
import { ElementCard } from './ElementCard';
import { LiveElementPicker } from '../element-picker/LiveElementPicker';

interface ElementLibrarySidebarProps {
  elements: ProjectElement[];
  onSelectElement: (element: ProjectElement) => void;
  onElementsAdded?: (newElements: ProjectElement[]) => void;
  projectId?: string;
  isLoading?: boolean;
  className?: string;
}

export function ElementLibrarySidebar({ 
  elements, 
  onSelectElement, 
  onElementsAdded,
  projectId,
  isLoading = false,
  className = ''
}: ElementLibrarySidebarProps) {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedUrl, setSelectedUrl] = useState<string>('all');
  const [selectedDiscovery, setSelectedDiscovery] = useState<string>('all');
  const [showLiveElementPicker, setShowLiveElementPicker] = useState(false);

  // Helper functions for element classification
  const isNewElement = (element: ProjectElement) => {
    const now = new Date();
    const createdAt = new Date(element.createdAt);
    const timeDiff = now.getTime() - createdAt.getTime();
    const tenMinutes = 10 * 60 * 1000; // 10 minutes in milliseconds
    return timeDiff < tenMinutes;
  };

  const isHuntedElement = (element: ProjectElement) => {
    const discoveryState = (element.attributes as any)?.discoveryState;
    return discoveryState === 'after_interaction' || 
           discoveryState === 'modal' || 
           discoveryState === 'after_login' ||
           discoveryState === 'hover';
  };

  // Filter elements based on type, URL, and discovery state
  const filteredElements = useMemo(() => {
    return elements.filter(element => {
      const matchesType = selectedType === 'all' || element.elementType === selectedType;
      const matchesUrl = selectedUrl === 'all' || element.sourceUrl?.id === selectedUrl;
      
      let matchesDiscovery = true;
      if (selectedDiscovery === 'new') {
        matchesDiscovery = isNewElement(element);
      } else if (selectedDiscovery === 'hunted') {
        matchesDiscovery = isHuntedElement(element);
      } else if (selectedDiscovery !== 'all') {
        matchesDiscovery = (element.attributes as any)?.discoveryState === selectedDiscovery;
      }
      
      return matchesType && matchesUrl && matchesDiscovery;
    });
  }, [elements, selectedType, selectedUrl, selectedDiscovery]);

  // Get unique element types for filter
  const elementTypes = useMemo(() => {
    const types = ['all', ...new Set(elements.map(e => e.elementType))];
    return types;
  }, [elements]);

  // Get unique URLs for filter
  const uniqueUrls = useMemo(() => {
    const urls = elements
      .filter(el => el.sourceUrl)
      .map(el => el.sourceUrl!)
      .filter((url, index, self) => self.findIndex(u => u.id === url.id) === index);
    return urls;
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

  // Helper function to get page display name from URL
  const getPageDisplayName = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      
      if (path === '/' || path === '') return 'Homepage';
      if (path.includes('login')) return 'Login Page';
      if (path.includes('dashboard')) return 'Dashboard';
      if (path.includes('signup') || path.includes('register')) return 'Registration';
      if (path.includes('profile')) return 'Profile';
      if (path.includes('settings')) return 'Settings';
      if (path.includes('about')) return 'About';
      if (path.includes('contact')) return 'Contact';
      
      // Use the last part of the path
      const segments = path.split('/').filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      if (lastSegment) {
        return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1).replace(/[-_]/g, ' ');
      }
      
      return 'Page';
    } catch {
      return 'Page';
    }
  };

  // Handle live element picker
  const handleOpenLiveElementPicker = () => {
    setShowLiveElementPicker(true);
  };

  const handleCloseLiveElementPicker = () => {
    setShowLiveElementPicker(false);
  };

  const handleElementsSelected = (newElements: ProjectElement[]) => {
    if (onElementsAdded) {
      onElementsAdded(newElements);
    }
    setShowLiveElementPicker(false);
    
    // Show success feedback
    console.log(`Added ${newElements.length} new elements to the library`);
  };

  return (
    <>
      {/* Live Element Picker Modal */}
      {showLiveElementPicker && projectId && (
        <LiveElementPicker
          projectId={projectId}
          onElementsSelected={handleElementsSelected}
          onClose={handleCloseLiveElementPicker}
        />
      )}
    <div className={`bg-white border-r border-gray-200 flex flex-col h-full ${className}`}>
      {/* Compact Header with Type and URL Filters */}
      <div className="border-b border-gray-200 p-3">
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-900">Elements</h2>
          
          {/* Filter Dropdowns */}
          <div className="space-y-2">
            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              title="Filter by element type"
            >
              {elementTypes.map(type => (
                <option key={type} value={type}>
                  {type === 'all' ? '📦 All Types' : `${getElementTypeIcon(type)} ${type.charAt(0).toUpperCase() + type.slice(1)}`}
                </option>
              ))}
            </select>

            {/* URL Filter - Only show if there are multiple URLs */}
            {uniqueUrls.length > 0 && (
              <select
                value={selectedUrl}
                onChange={(e) => setSelectedUrl(e.target.value)}
                className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                title="Filter by source URL"
              >
                <option value="all">🌐 All Pages ({elements.length})</option>
                {uniqueUrls.map(url => {
                  const urlElements = elements.filter(el => el.sourceUrl?.id === url.id);
                  return (
                    <option key={url.id} value={url.id}>
                      📄 {url.title || getPageDisplayName(url.url)} ({urlElements.length})
                    </option>
                  );
                })}
              </select>
            )}

            {/* Discovery Filter */}
            <select
              value={selectedDiscovery}
              onChange={(e) => setSelectedDiscovery(e.target.value)}
              className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              title="Filter by discovery method"
            >
              <option value="all">🔍 All Discovery ({elements.length})</option>
              <option value="new">🆕 New Elements ({elements.filter(isNewElement).length})</option>
              <option value="hunted">🎯 Hunted Elements ({elements.filter(isHuntedElement).length})</option>
              <option value="static">📄 Static Elements</option>
              <option value="after_interaction">👆 Interactive</option>
              <option value="modal">🪟 Modal</option>
              <option value="after_login">🔐 After Login</option>
              <option value="hover">🎯 Hover</option>
            </select>
          </div>
          
          {/* Live Element Picker Button */}
          {projectId && (
            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={handleOpenLiveElementPicker}
                className="w-full px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 flex items-center justify-center space-x-2 text-sm font-medium shadow-sm"
                title="Select elements directly from any website"
              >
                <span className="text-lg">🎯</span>
                <span>Live Element Picker</span>
              </button>
              <p className="text-xs text-gray-500 mt-1 text-center">
                Revolutionary: Select elements from live websites
              </p>
            </div>
          )}
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
                ? projectId 
                  ? 'Run project analysis to discover elements, or use the Live Element Picker above'
                  : 'Run project analysis to discover elements'
                : 'Try adjusting your search or filters'
              }
            </div>
            {elements.length === 0 && projectId && (
              <button
                onClick={handleOpenLiveElementPicker}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                🎯 Try Live Element Picker
              </button>
            )}
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
    </>
  );
}