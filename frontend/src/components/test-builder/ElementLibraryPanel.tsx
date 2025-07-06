import { useState, useMemo } from 'react';
import { ProjectElement } from '../../types/element.types';

interface ElementLibraryPanelProps {
  elements: ProjectElement[];
  onSelectElement: (element: ProjectElement) => void;
  isLoading: boolean;
}

export function ElementLibraryPanel({ elements, onSelectElement, isLoading }: ElementLibraryPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedUrl, setSelectedUrl] = useState<string>('all');

  const filteredElements = useMemo(() => {
    return elements.filter(element => {
      const matchesSearch = element.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           element.selector.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'all' || element.elementType === selectedType;
      const matchesUrl = selectedUrl === 'all' || element.sourceUrl?.id === selectedUrl;
      return matchesSearch && matchesType && matchesUrl;
    });
  }, [elements, searchTerm, selectedType, selectedUrl]);

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
  const uniqueUrls = useMemo(() => {
    const urls = elements
      .filter(el => el.sourceUrl)
      .map(el => el.sourceUrl!)
      .filter((url, index, self) => self.findIndex(u => u.id === url.id) === index);
    return urls;
  }, [elements]);

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
        <h3 className="text-lg font-medium mb-2">Element Library</h3>
        <p className="text-sm text-gray-600 mb-3">
          AI-discovered elements from your project pages
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

          {/* URL Filter */}
          {uniqueUrls.length > 1 && (
            <select
              value={selectedUrl}
              onChange={(e) => setSelectedUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Pages</option>
              {uniqueUrls.map(url => (
                <option key={url.id} value={url.id}>
                  {url.title || new URL(url.url).pathname}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Elements List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {filteredElements.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">
            {elements.length === 0 ? 'No elements discovered yet' : 'No elements match your search'}
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
                        onClick={() => onSelectElement(element)}
                        className="p-2 border rounded cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium truncate flex-1">{element.description}</span>
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
                        <div className="text-xs text-gray-600 font-mono truncate">
                          {element.selector}
                        </div>
                        {element.attributes.text && (
                          <div className="text-xs text-gray-500 mt-1 truncate">
                            "{element.attributes.text}"
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
              onClick={() => onSelectElement(element)}
              className="p-3 bg-white border rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium truncate flex-1">{element.description}</span>
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