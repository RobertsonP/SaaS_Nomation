import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { projectsAPI } from '../../lib/api';

interface ProjectElement {
  id: string;
  selector: string;
  elementType: string;
  description: string;
  confidence: number;
  attributes: any;
  sourceUrl?: {
    id: string;
    url: string;
    title?: string;
  };
}

interface ProjectUrl {
  id: string;
  url: string;
  title?: string;
  description?: string;
  analyzed: boolean;
  analysisDate?: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  urls: ProjectUrl[];
  elements: ProjectElement[];
  _count: {
    tests: number;
    elements: number;
    urls: number;
  };
}

export function ProjectDetailsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedElementType, setSelectedElementType] = useState<string>('all');
  const [selectedUrl, setSelectedUrl] = useState<string>('all');

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      const response = await projectsAPI.getById(projectId!);
      setProject(response.data);
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      setLoading(false);
    }
  };

  const getElementTypeColor = (type: string) => {
    switch (type) {
      case 'button': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'input': return 'bg-green-100 text-green-800 border-green-200';
      case 'link': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'form': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'navigation': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'text': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getElementIcon = (type: string) => {
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

  const filteredElements = project?.elements.filter(element => {
    const typeMatch = selectedElementType === 'all' || element.elementType === selectedElementType;
    const urlMatch = selectedUrl === 'all' || element.sourceUrl?.id === selectedUrl;
    return typeMatch && urlMatch;
  }) || [];

  // Group elements by source URL for better organization
  const elementsByUrl = filteredElements.reduce((acc, element) => {
    const urlId = element.sourceUrl?.id || 'unknown';
    if (!acc[urlId]) {
      acc[urlId] = [];
    }
    acc[urlId].push(element);
    return acc;
  }, {} as Record<string, ProjectElement[]>);

  const elementTypes = [...new Set(project?.elements.map(e => e.elementType) || [])];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading project details...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Project not found</h1>
          <Link to="/projects" className="text-blue-600 hover:text-blue-800">
            ← Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Link to="/projects" className="text-blue-600 hover:text-blue-800 mb-2 inline-block">
              ← Back to Projects
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            {project.description && (
              <p className="text-gray-600 mt-2">{project.description}</p>
            )}
          </div>
          <div className="flex space-x-2">
            <Link
              to={`/projects/${project.id}/tests`}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              View Tests ({project._count.tests})
            </Link>
            <Link
              to={`/projects/${project.id}/tests/new`}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              Create Test
            </Link>
          </div>
        </div>

        {/* Project Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900">URLs</h3>
            <p className="text-2xl font-bold text-blue-600">{project._count.urls}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-green-900">Elements</h3>
            <p className="text-2xl font-bold text-green-600">{project._count.elements}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-purple-900">Tests</h3>
            <p className="text-2xl font-bold text-purple-600">{project._count.tests}</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-orange-900">Analyzed URLs</h3>
            <p className="text-2xl font-bold text-orange-600">
              {project.urls.filter(url => url.analyzed).length}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - URLs */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow border">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Project URLs</h2>
            </div>
            <div className="p-4 space-y-3">
              {project.urls.map((url) => (
                <div key={url.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm truncate">{url.title || 'Page'}</h3>
                    <span className={`text-xs px-2 py-1 rounded ${
                      url.analyzed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {url.analyzed ? 'Analyzed' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-xs text-blue-600 truncate">{url.url}</p>
                  {url.description && (
                    <p className="text-xs text-gray-500 mt-1">{url.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content - Elements */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow border">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Scraped Elements</h2>
                <div className="flex space-x-2">
                  {/* Element Type Filter */}
                  <select
                    value={selectedElementType}
                    onChange={(e) => setSelectedElementType(e.target.value)}
                    className="text-sm border border-gray-300 rounded px-2 py-1"
                  >
                    <option value="all">All Types</option>
                    {elementTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  
                  {/* URL Filter */}
                  <select
                    value={selectedUrl}
                    onChange={(e) => setSelectedUrl(e.target.value)}
                    className="text-sm border border-gray-300 rounded px-2 py-1"
                  >
                    <option value="all">All URLs</option>
                    {project.urls.map(url => (
                      <option key={url.id} value={url.id}>
                        {url.title || new URL(url.url).pathname}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="p-4">
              {filteredElements.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No elements found</p>
                  <p className="text-sm text-gray-400">
                    Try running analysis on your project URLs to discover elements
                  </p>
                </div>
              ) : selectedUrl === 'all' ? (
                // Show elements grouped by URL when no specific URL is selected
                <div className="space-y-6">
                  {Object.entries(elementsByUrl).map(([urlId, elements]) => {
                    const sourceUrl = project?.urls.find(url => url.id === urlId);
                    return (
                      <div key={urlId} className="border rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-4 py-3 border-b">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium text-sm">{sourceUrl?.title || 'Unknown Page'}</h3>
                              <p className="text-xs text-blue-600 truncate">{sourceUrl?.url || 'No URL'}</p>
                            </div>
                            <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
                              {elements.length} element{elements.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {elements.map((element) => (
                              <div key={element.id} className="border rounded-lg p-3 hover:bg-gray-50">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-sm">{getElementIcon(element.elementType)}</span>
                                    <span className={`px-2 py-1 text-xs rounded border ${getElementTypeColor(element.elementType)}`}>
                                      {element.elementType}
                                    </span>
                                  </div>
                                  <span className="text-xs text-gray-500">
                                    {Math.round(element.confidence * 100)}%
                                  </span>
                                </div>
                                
                                <h4 className="font-medium text-xs mb-2">{element.description}</h4>
                                
                                <div className="space-y-1">
                                  <div className="text-xs">
                                    <span className="text-gray-500">Selector:</span>
                                    <code className="ml-1 bg-gray-100 px-1 rounded text-xs font-mono">
                                      {element.selector}
                                    </code>
                                  </div>
                                  
                                  {element.attributes?.text && (
                                    <div className="text-xs">
                                      <span className="text-gray-500">Text:</span>
                                      <span className="ml-1">"{element.attributes.text.slice(0, 30)}{element.attributes.text.length > 30 ? '...' : ''}"</span>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                  <button className="text-xs text-blue-600 hover:text-blue-800">
                                    Use in Test
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Show elements in grid when a specific URL is selected
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredElements.map((element) => (
                    <div key={element.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{getElementIcon(element.elementType)}</span>
                          <span className={`px-2 py-1 text-xs rounded border ${getElementTypeColor(element.elementType)}`}>
                            {element.elementType}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {Math.round(element.confidence * 100)}%
                        </span>
                      </div>
                      
                      <h3 className="font-medium text-sm mb-2">{element.description}</h3>
                      
                      <div className="space-y-1">
                        <div className="text-xs">
                          <span className="text-gray-500">Selector:</span>
                          <code className="ml-1 bg-gray-100 px-1 rounded text-xs font-mono">
                            {element.selector}
                          </code>
                        </div>
                        
                        {element.attributes?.text && (
                          <div className="text-xs">
                            <span className="text-gray-500">Text:</span>
                            <span className="ml-1">"{element.attributes.text}"</span>
                          </div>
                        )}
                        
                        {element.sourceUrl && (
                          <div className="text-xs">
                            <span className="text-gray-500">Source:</span>
                            <span className="ml-1 text-blue-600">{element.sourceUrl.title || 'Page'}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-3 pt-2 border-t border-gray-100">
                        <button className="text-xs text-blue-600 hover:text-blue-800">
                          Use in Test
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}