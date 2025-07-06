import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { projectsAPI, analyzeProjectPages } from '../../lib/api';
import { useNotification } from '../../contexts/NotificationContext';

interface Project {
  id: string;
  name: string;
  description?: string;
  url: string;
  createdAt: string;
  _count: { tests: number; elements?: number };
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    urls: ['']
  });
  // AI Enhancement: Track analysis state
  const [analyzingProjects, setAnalyzingProjects] = useState<Set<string>>(new Set());
  const [analysisResults, setAnalysisResults] = useState<Map<string, { success: boolean; elementCount: number; error?: string }>>(new Map());

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await projectsAPI.getAll();
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Filter out empty URLs and use first URL as main URL for backward compatibility
      const validUrls = formData.urls.filter(url => url.trim() !== '');
      if (validUrls.length === 0) {
        showError('Validation Error', 'Please add at least one URL');
        return;
      }
      
      const projectData = {
        name: formData.name,
        description: formData.description,
        urls: validUrls.map(url => ({
          url: url,
          title: 'Page',
          description: 'Project URL'
        })) // Properly formatted URLs array
      };
      
      await projectsAPI.create(projectData);
      setFormData({ name: '', description: '', urls: [''] });
      setShowForm(false);
      loadProjects();
      showSuccess('Project Created', `Successfully created project "${formData.name}" with ${validUrls.length} URL${validUrls.length > 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Failed to create project:', error);
      showError('Creation Failed', 'Failed to create project. Please try again.');
    }
  };

  const addUrlField = () => {
    setFormData({
      ...formData,
      urls: [...formData.urls, '']
    });
  };

  const removeUrlField = (index: number) => {
    const newUrls = formData.urls.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      urls: newUrls.length > 0 ? newUrls : ['']
    });
  };

  const updateUrl = (index: number, value: string) => {
    const newUrls = [...formData.urls];
    newUrls[index] = value;
    setFormData({
      ...formData,
      urls: newUrls
    });
  };

  // AI Enhancement: Handle project page analysis
  const handleAnalyzeProject = async (projectId: string) => {
    setAnalyzingProjects(prev => new Set([...prev, projectId]));
    
    try {
      const result = await analyzeProjectPages(projectId);
      
      const newResults = new Map(analysisResults);
      newResults.set(projectId, {
        success: result.success,
        elementCount: result.elements.length,
        error: result.errorMessage
      });
      setAnalysisResults(newResults);

      if (result.success) {
        // Refresh projects to show updated element count
        loadProjects();
        showSuccess('Analysis Complete', `Found ${result.elements.length} elements across ${result.totalUrls || 1} page${(result.totalUrls || 1) > 1 ? 's' : ''}`);
      } else {
        showError('Analysis Failed', result.errorMessage || 'Failed to analyze project pages');
      }
    } catch (error) {
      const newResults = new Map(analysisResults);
      newResults.set(projectId, {
        success: false,
        elementCount: 0,
        error: 'Network error'
      });
      setAnalysisResults(newResults);
      showError('Analysis Error', 'Network error occurred during analysis');
    } finally {
      setAnalyzingProjects(prev => {
        const newSet = new Set(prev);
        newSet.delete(projectId);
        return newSet;
      });
    }
  };

  // Delete project function
  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`Are you sure you want to delete project "${projectName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await projectsAPI.delete(projectId);
      loadProjects();
      showSuccess('Project Deleted', `Successfully deleted project "${projectName}"`);
    } catch (error) {
      console.error('Failed to delete project:', error);
      showError('Delete Failed', 'Failed to delete project. Please try again.');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Create Project
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4">Create New Project</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Website URLs</label>
              {formData.urls.map((url, index) => (
                <div key={index} className="flex items-center space-x-2 mb-2">
                  <input
                    type="url"
                    required={index === 0}
                    placeholder="https://example.com"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    value={url}
                    onChange={(e) => updateUrl(index, e.target.value)}
                  />
                  {formData.urls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeUrlField(index)}
                      className="bg-red-500 text-white px-2 py-2 rounded-md hover:bg-red-600 text-sm"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addUrlField}
                className="bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-600 text-sm mt-2"
              >
                + Add URL
              </button>
            </div>
            <div className="flex space-x-4">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Create Project
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => {
          const isAnalyzing = analyzingProjects.has(project.id);
          const analysisResult = analysisResults.get(project.id);
          
          return (
            <div 
              key={project.id} 
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
              onDoubleClick={() => navigate(`/projects/${project.id}`)}
            >
              {/* Project Header with Analysis and Delete Buttons */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold flex-1">{project.name}</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleAnalyzeProject(project.id)}
                    disabled={isAnalyzing}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      isAnalyzing
                        ? 'bg-yellow-100 text-yellow-800 cursor-not-allowed'
                        : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                    }`}
                    title="Analyze pages with AI to discover elements"
                  >
                    {isAnalyzing ? (
                      <>
                        <svg className="animate-spin inline w-3 h-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Analyzing...
                      </>
                    ) : (
                      '🔍 Analyze'
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent double-click navigation
                      handleDeleteProject(project.id, project.name);
                    }}
                    className="px-3 py-1 text-xs rounded-full bg-red-100 text-red-800 hover:bg-red-200 transition-colors"
                    title="Delete project"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>

              <p className="text-gray-600 mb-2">{project.description}</p>
              <p className="text-sm text-blue-600 mb-4 truncate">{project.url}</p>

              {/* Analysis Results */}
              {analysisResult && (
                <div className={`mb-3 p-2 rounded text-xs ${
                  analysisResult.success 
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {analysisResult.success ? (
                    <span>✓ Found {analysisResult.elementCount} elements</span>
                  ) : (
                    <span>⚠ Analysis failed: {analysisResult.error}</span>
                  )}
                </div>
              )}

              {/* Project Stats */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-3 text-sm text-gray-500">
                  <span>{project._count.tests} tests</span>
                  {project._count.elements !== undefined && (
                    <>
                      <span>•</span>
                      <span>{project._count.elements} elements</span>
                    </>
                  )}
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(project.createdAt).toLocaleDateString()}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                <Link
                  to={`/projects/${project.id}/tests`}
                  className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-center text-sm"
                >
                  View Tests
                </Link>
                <Link
                  to={`/projects/${project.id}/tests/new`}
                  className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-center text-sm"
                >
                  Create Test
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {projects.length === 0 && !showForm && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg mb-4">No projects yet</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Create Your First Project
          </button>
        </div>
      )}
    </div>
  );
}