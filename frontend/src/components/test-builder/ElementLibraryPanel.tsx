import { useState, useMemo } from 'react';
import { ProjectElement } from '../../types/element.types';
import { ElementPreviewCard } from '../elements/ElementPreviewCard';
import { projectsAPI } from '../../lib/api';

interface ElementLibraryPanelProps {
  elements: ProjectElement[];
  onSelectElement: (element: ProjectElement) => void;
  isLoading: boolean;
  isLiveMode?: boolean;
  onPerformAction?: (action: { type: string; selector: string; value?: string }) => void;
}

export function ElementLibraryPanel({ elements, onSelectElement, isLoading, isLiveMode, onPerformAction }: ElementLibraryPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedUrl, setSelectedUrl] = useState<string>('all');
  const [selectedDiscoveryState, setSelectedDiscoveryState] = useState<string>('all');
  const [previewMode, setPreviewMode] = useState<boolean>(true); // Visual preview mode by default

  const filteredElements = useMemo(() => {
    return elements.filter(element => {
      const matchesSearch = element.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           element.selector.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'all' || element.elementType === selectedType;
      const matchesUrl = selectedUrl === 'all' || element.sourceUrl?.id === selectedUrl;
      const matchesDiscoveryState = selectedDiscoveryState === 'all' || 
                                   (element.attributes as any)?.discoveryState === selectedDiscoveryState;
      return matchesSearch && matchesType && matchesUrl && matchesDiscoveryState;
    });
  }, [elements, searchTerm, selectedType, selectedUrl, selectedDiscoveryState]);

  // Group elements by source URL for better organization
  const elementsByUrl = useMemo(() => {
    return filteredElements.reduce((acc, element) => {
      const urlId = element.sourceUrl?.id || 'unknown';
      if (!acc[urlId]) {
        acc[urlId] = [];
      }
      acc[urlId].push(element);
      return acc;
    }, {} as Record<string, ProjectElement[]>);
  }, [filteredElements]);

  const elementTypes = ['all', 'button', 'input', 'link', 'form', 'navigation', 'text'];
  const discoveryStates = ['all', 'static', 'after_login', 'login_page', 'after_interaction', 'modal', 'hover'];
  
  const uniqueUrls = useMemo(() => {
    const urls = elements
      .filter(el => el.sourceUrl)
      .map(el => el.sourceUrl!)
      .filter((url, index, self) => self.findIndex(u => u.id === url.id) === index);
    return urls;
  }, [elements]);

  // Helper function to get discovery state badge
  const getDiscoveryStateBadge = (discoveryState?: string) => {
    if (!discoveryState) return null;
    
    const stateConfig = {
      static: { color: 'bg-gray-100 text-gray-800', icon: '📄', label: 'Static' },
      after_login: { color: 'bg-blue-100 text-blue-800', icon: '🔐', label: 'After Login' },
      login_page: { color: 'bg-indigo-100 text-indigo-800', icon: '🔑', label: 'Login Page' },
      after_interaction: { color: 'bg-green-100 text-green-800', icon: '👆', label: 'Interactive' },
      modal: { color: 'bg-purple-100 text-purple-800', icon: '🪟', label: 'Modal' },
      hover: { color: 'bg-yellow-100 text-yellow-800', icon: '🎯', label: 'Hover' }
    };
    
    const config = stateConfig[discoveryState as keyof typeof stateConfig];
    if (!config) return null;
    
    return (
      <span className={`px-1 py-0.5 text-xs rounded whitespace-nowrap ${config.color}`}>
        {config.icon} {config.label}
      </span>
    );
  };

  // Helper function to handle live actions
  const handleLiveAction = (action: string, element: ProjectElement) => {
    if (!onPerformAction) return;
    
    const actionMap = {
      click: { type: 'click', selector: element.selector },
      hover: { type: 'hover', selector: element.selector },
      type: { type: 'type', selector: element.selector, value: 'test input' }
    };
    
    const actionConfig = actionMap[action as keyof typeof actionMap];
    if (actionConfig) {
      onPerformAction(actionConfig);
    }
  };

  // Function to request screenshot from backend
  const requestElementScreenshot = async (elementId: string, selector: string, url: string): Promise<string> => {
    try {
      // Extract project ID from the current URL or context
      const projectId = window.location.pathname.split('/')[2]; // Assuming URL structure /projects/:id/...
      
      const data = await projectsAPI.captureElementScreenshot(projectId, elementId, selector, url);
      if (data.success) {
        return data.screenshot;
      } else {
        throw new Error(data.error || 'Failed to capture screenshot');
      }
    } catch (error) {
      console.error('Screenshot request failed:', error);
      throw error;
    }
  };

  // Helper functions for URL display
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
      if (path.includes('products')) return 'Products';
      if (path.includes('services')) return 'Services';
      
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

  const getShortUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return `${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      return url;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-50 border rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-gray-300 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border rounded-lg p-4">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium flex items-center">
            Element Library
            {isLiveMode && (
              <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                🔴 Live
              </span>
            )}
          </h3>
          
          {/* Preview Mode Toggle */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-600">Preview:</span>
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                previewMode 
                  ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}
              title={`Switch to ${previewMode ? 'list' : 'visual'} mode`}
            >
              {previewMode ? '🖼️ Visual' : '📋 List'}
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          {isLiveMode 
            ? 'Real-time elements from live browser session' 
            : 'AI-discovered elements from your project pages'
          }
        </p>
        
        {/* Search and Filter */}
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Search elements..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {elementTypes.map(type => (
              <option key={type} value={type}>
                {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>

          {/* URL Filter - Clickable Page Blocks */}
          {uniqueUrls.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700">Pages ({uniqueUrls.length}):</label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => setSelectedUrl('all')}
                  className={`p-3 rounded-lg border transition-colors text-left ${
                    selectedUrl === 'all'
                      ? 'bg-blue-50 text-blue-900 border-blue-200 ring-2 ring-blue-300'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">All Pages</div>
                      <div className="text-xs text-gray-500">Show elements from all pages</div>
                    </div>
                    <div className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {elements.length} elements
                    </div>
                  </div>
                </button>
                
                {uniqueUrls.map(url => {
                  const urlElements = elements.filter(el => el.sourceUrl?.id === url.id);
                  return (
                    <button
                      key={url.id}
                      onClick={() => setSelectedUrl(url.id)}
                      className={`p-3 rounded-lg border transition-colors text-left ${
                        selectedUrl === url.id
                          ? 'bg-blue-50 text-blue-900 border-blue-200 ring-2 ring-blue-300'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                      }`}
                      title={`Click to show only elements from ${url.url}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">
                            {url.description || getPageDisplayName(url.url) || url.title || 'Page'}
                          </div>
                          <div className="text-xs text-blue-600 truncate">
                            {getShortUrl(url.url)}
                          </div>
                          {url.description && url.description !== url.title && (
                            <div className="text-xs text-gray-500 truncate mt-1">
                              {url.description}
                            </div>
                          )}
                        </div>
                        <div className="ml-2 flex-shrink-0">
                          <div className={`text-xs px-2 py-1 rounded ${
                            selectedUrl === url.id 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {urlElements.length} elements
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* NEW: Discovery State Filter */}
          <select
            value={selectedDiscoveryState}
            onChange={(e) => setSelectedDiscoveryState(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {discoveryStates.map(state => (
              <option key={state} value={state}>
                {state === 'all' ? 'All Discovery States' : 
                 state === 'static' ? '📄 Static' :
                 state === 'after_login' ? '🔐 After Login' :
                 state === 'login_page' ? '🔑 Login Page' :
                 state === 'after_interaction' ? '👆 Interactive' :
                 state === 'modal' ? '🪟 Modal' :
                 state === 'hover' ? '🎯 Hover' : state}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Elements List */}
      <div className={`${previewMode ? 'max-h-96' : 'max-h-64'} overflow-y-auto`}>
        {filteredElements.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <div className="text-4xl mb-2">🔍</div>
            <div>{elements.length === 0 ? 'No elements discovered yet' : 'No elements match your search'}</div>
            <div className="text-xs mt-1">Try adjusting your filters or run project analysis</div>
          </div>
        ) : previewMode ? (
          // VISUAL PREVIEW MODE: Show element cards with screenshots
          <div className={`grid gap-3 ${
            selectedUrl === 'all' && uniqueUrls.length > 1 
              ? 'grid-cols-1' 
              : 'grid-cols-1 md:grid-cols-2'
          }`}>
            {selectedUrl === 'all' && uniqueUrls.length > 1 ? (
              // Group by URL in preview mode
              Object.entries(elementsByUrl).map(([urlId, urlElements]) => {
                const sourceUrl = uniqueUrls.find(url => url.id === urlId);
                return (
                  <div key={urlId} className="space-y-3">
                    <div className="bg-gray-100 px-3 py-2 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {sourceUrl?.title || 'Unknown Page'}
                      </h4>
                      <p className="text-xs text-blue-600 truncate">{sourceUrl?.url || 'No URL'}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {urlElements.map((element) => (
                        <ElementPreviewCard
                          key={element.id}
                          element={element}
                          onSelectElement={onSelectElement}
                          onRequestScreenshot={requestElementScreenshot}
                          isLiveMode={isLiveMode}
                          onPerformAction={onPerformAction}
                          previewMode="auto"
                          showQuality={true}
                          compact={false}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              // Show all elements in grid for specific URL
              filteredElements.map((element) => (
                <ElementPreviewCard
                  key={element.id}
                  element={element}
                  onSelectElement={onSelectElement}
                  onRequestScreenshot={requestElementScreenshot}
                  isLiveMode={isLiveMode}
                  onPerformAction={onPerformAction}
                  previewMode="auto"
                  showQuality={true}
                  compact={false}
                />
              ))
            )}
          </div>
        ) : selectedUrl === 'all' && uniqueUrls.length > 1 ? (
          // Show elements grouped by URL when no specific URL is selected
          <div className="space-y-3">
            {Object.entries(elementsByUrl).map(([urlId, urlElements]) => {
              const sourceUrl = uniqueUrls.find(url => url.id === urlId);
              return (
                <div key={urlId} className="border rounded-lg overflow-hidden bg-white">
                  <div className="bg-gray-50 px-3 py-2 border-b">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-medium text-gray-900 truncate">
                          {sourceUrl?.title || 'Unknown Page'}
                        </h4>
                        <p className="text-xs text-blue-600 truncate">
                          {sourceUrl?.url || 'No URL'}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded ml-2 whitespace-nowrap">
                        {urlElements.length} element{urlElements.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="p-2 space-y-1">
                    {urlElements.map((element) => (
                      <div
                        key={element.id}
                        className="p-2 border rounded hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span 
                            className="text-xs font-medium truncate flex-1 cursor-pointer"
                            onClick={() => onSelectElement(element)}
                          >
                            {element.description}
                          </span>
                          <div className="flex items-center space-x-1 ml-2">
                            <span className={`px-1 py-0.5 text-xs rounded whitespace-nowrap ${
                              element.elementType === 'button' ? 'bg-blue-100 text-blue-800' :
                              element.elementType === 'input' ? 'bg-green-100 text-green-800' :
                              element.elementType === 'link' ? 'bg-purple-100 text-purple-800' :
                              element.elementType === 'form' ? 'bg-orange-100 text-orange-800' :
                              element.elementType === 'navigation' ? 'bg-indigo-100 text-indigo-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {element.elementType}
                            </span>
                            <span className="text-xs text-gray-500">
                              {Math.round(element.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                        
                        {/* Discovery State Badge */}
                        {(element.attributes as any)?.discoveryState && (
                          <div className="mb-1">
                            {getDiscoveryStateBadge((element.attributes as any).discoveryState)}
                          </div>
                        )}

                        <div className="text-xs text-gray-600 font-mono truncate">
                          {element.selector}
                        </div>
                        
                        {element.attributes.text && (
                          <div className="text-xs text-gray-500 mt-1 truncate">
                            "{element.attributes.text}"
                          </div>
                        )}

                        {/* CRITICAL FIX: Add general actions including preview button */}
                        <div className="mt-2 flex space-x-1">
                          <button
                            onClick={() => onSelectElement(element)}
                            className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                            title="Use this element in test"
                          >
                            Use in Test
                          </button>
                          {/* Preview button for list view */}
                          <button
                            onClick={() => requestElementScreenshot(element.id, element.selector, element.sourceUrl?.url || '')}
                            className="px-2 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
                            title="Capture element preview"
                          >
                            📸 Preview
                          </button>
                        </div>

                        {/* Live Mode Actions */}
                        {isLiveMode && onPerformAction && (
                          <div className="mt-2 flex space-x-1">
                            <button
                              onClick={() => handleLiveAction('click', element)}
                              className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                              title="Click this element in live browser"
                            >
                              Click
                            </button>
                            <button
                              onClick={() => handleLiveAction('hover', element)}
                              className="px-2 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600"
                              title="Hover over this element in live browser"
                            >
                              Hover
                            </button>
                            {element.elementType === 'input' && (
                              <button
                                onClick={() => handleLiveAction('type', element)}
                                className="px-2 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600"
                                title="Type in this element in live browser"
                              >
                                Type
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Show elements in simple list when a specific URL is selected
          filteredElements.map((element) => (
            <div
              key={element.id}
              className="p-3 bg-white border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span 
                  className="text-sm font-medium truncate flex-1 cursor-pointer"
                  onClick={() => onSelectElement(element)}
                >
                  {element.description}
                </span>
                <div className="flex items-center space-x-2 ml-2">
                  <span className={`px-2 py-1 text-xs rounded whitespace-nowrap ${
                    element.elementType === 'button' ? 'bg-blue-100 text-blue-800' :
                    element.elementType === 'input' ? 'bg-green-100 text-green-800' :
                    element.elementType === 'link' ? 'bg-purple-100 text-purple-800' :
                    element.elementType === 'form' ? 'bg-orange-100 text-orange-800' :
                    element.elementType === 'navigation' ? 'bg-indigo-100 text-indigo-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {element.elementType}
                  </span>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {Math.round(element.confidence * 100)}%
                  </span>
                </div>
              </div>

              {/* Discovery State Badge */}
              {(element.attributes as any)?.discoveryState && (
                <div className="mb-2">
                  {getDiscoveryStateBadge((element.attributes as any).discoveryState)}
                </div>
              )}

              <div className="text-xs text-gray-600 font-mono truncate">
                {element.selector}
              </div>
              {element.attributes.text && (
                <div className="text-xs text-gray-500 mt-1 truncate">
                  Text: "{element.attributes.text}"
                </div>
              )}
              {element.sourceUrl && selectedUrl !== 'all' && (
                <div className="text-xs text-blue-600 mt-1 truncate">
                  From: {element.sourceUrl.title || 'Page'}
                </div>
              )}

              {/* CRITICAL FIX: Add general actions including preview button */}
              <div className="mt-3 flex space-x-2">
                <button
                  onClick={() => onSelectElement(element)}
                  className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                  title="Use this element in test"
                >
                  Use in Test
                </button>
                {/* Preview button for list view */}
                <button
                  onClick={() => requestElementScreenshot(element.id, element.selector, element.sourceUrl?.url || '')}
                  className="px-3 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
                  title="Capture element preview"
                >
                  📸 Preview
                </button>
              </div>

              {/* Live Mode Actions */}
              {isLiveMode && onPerformAction && (
                <div className="mt-3 flex space-x-2">
                  <button
                    onClick={() => handleLiveAction('click', element)}
                    className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                    title="Click this element in live browser"
                  >
                    🖱️ Click
                  </button>
                  <button
                    onClick={() => handleLiveAction('hover', element)}
                    className="px-3 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600"
                    title="Hover over this element in live browser"
                  >
                    🎯 Hover
                  </button>
                  {element.elementType === 'input' && (
                    <button
                      onClick={() => handleLiveAction('type', element)}
                      className="px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600"
                      title="Type in this element in live browser"
                    >
                      ⌨️ Type
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Analysis Info */}
      {elements.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-500 text-center">
            {elements.length} element{elements.length !== 1 ? 's' : ''} discovered
            {filteredElements.length !== elements.length && (
              <span> • {filteredElements.length} shown</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}