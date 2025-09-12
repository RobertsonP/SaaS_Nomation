import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { projectsAPI } from '../../lib/api';
import { useNotification } from '../../contexts/NotificationContext';
import { LoadingModal } from '../../components/shared/LoadingModal';
import { FolderUploadZone } from '../../components/project-upload/FolderUploadZone';

interface Project {
  id: string;
  name: string;
  description?: string;
  urls: Array<{ id: string; url: string; title?: string; description?: string }>;
  createdAt: string;
  _count: { tests: number; elements?: number };
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState<string | null>(null); // projectId being edited
  const [showFolderUpload, setShowFolderUpload] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    stage: '',
    progress: 0,
    message: ''
  });
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    urls: ['']
  });
  

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
    
    if (isCreating) return; // Prevent multiple submissions
    
    try {
      setIsCreating(true);
      
      // Simplified creation: Just create the project with basic info
      setUploadProgress({
        stage: 'creation',
        progress: 50,
        message: 'Creating project...'
      });
      
      const projectData = {
        name: formData.name,
        description: formData.description,
        urls: [] // Start with empty URLs - will be added later
      };
      
      const response = await projectsAPI.create(projectData);
      const createdProject = response.data;
      
      // Complete
      setUploadProgress({
        stage: 'complete',
        progress: 100,
        message: 'Project created successfully!'
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Reset form and close
      setFormData({ name: '', description: '' });
      setShowForm(false);
      
      // Show success notification
      showSuccess('Project Created', `Successfully created project "${formData.name}". You can now add URLs and analyze pages in the project details.`);
      
      // Navigate to the created project
      navigate(`/projects/${createdProject.id}`);
      
    } catch (error) {
      console.error('Failed to create project:', error);
      showError('Creation Failed', 'Failed to create project. Please try again.');
    } finally {
      setIsCreating(false);
      setUploadProgress({ stage: '', progress: 0, message: '' });
    }
  };

  // NEW: Folder upload handlers
  const handleFolderUpload = async (files: any[]) => {
    setUploadedFiles(files);
    console.log(`Received ${files.length} files for analysis`);
    
    try {
      setIsAnalyzing(true);
      
      // Use server-side analysis instead of client-side
      const response = await projectsAPI.analyzeProjectFolder(files);
      
      showSuccess('Project Created!', `Successfully created project "${response.project.name}" with ${response.analysis.elements.length} elements discovered from your code.`);
      
      // Reset upload state and navigate
      setShowFolderUpload(false);
      setUploadedFiles([]);
      setIsAnalyzing(false);
      
      navigate(`/projects/${response.project.id}`);
      
    } catch (error) {
      console.error('Failed to create project from upload:', error);
      showError('Creation Failed', 'Failed to create project from uploaded files. Please try again.');
      setIsAnalyzing(false);
    }
  };

  const handleCancelUpload = () => {
    setShowFolderUpload(false);
    setUploadedFiles([]);
    setIsAnalyzing(false);
  };

  // URL management removed - now handled in project details page


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

  // Edit project functions
  const handleStartEdit = (project: Project) => {
    setShowEditForm(project.id);
    setEditFormData({
      name: project.name,
      description: project.description || '',
      urls: project.urls.length > 0 ? project.urls.map(url => url.url) : ['']
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditForm || isUpdating) return;

    try {
      const validUrls = editFormData.urls.filter(url => url.trim() !== '');
      if (validUrls.length === 0) {
        showError('Validation Error', 'Please add at least one URL');
        return;
      }

      setIsUpdating(true);

      const updateData = {
        name: editFormData.name,
        description: editFormData.description,
        urls: validUrls.map(url => ({
          url: url,
          title: 'Page',
          description: 'Project URL'
        }))
      };

      await projectsAPI.update(showEditForm, updateData);
      setEditFormData({ name: '', description: '', urls: [''] });
      setShowEditForm(null);
      loadProjects();
      showSuccess('Project Updated', `Successfully updated project "${editFormData.name}"`);
    } catch (error) {
      console.error('Failed to update project:', error);
      showError('Update Failed', 'Failed to update project. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const addEditUrlField = () => {
    setEditFormData({
      ...editFormData,
      urls: [...editFormData.urls, '']
    });
  };

  const removeEditUrlField = (index: number) => {
    const newUrls = editFormData.urls.filter((_, i) => i !== index);
    setEditFormData({
      ...editFormData,
      urls: newUrls.length > 0 ? newUrls : ['']
    });
  };

  const updateEditUrl = (index: number, value: string) => {
    const newUrls = [...editFormData.urls];
    newUrls[index] = value;
    setEditFormData({
      ...editFormData,
      urls: newUrls
    });
  };


  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowFolderUpload(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
          >
            <span>📁</span>
            <span>Upload Folder</span>
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Create Project
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-semibold mb-4">Create New Project</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <div className="text-blue-600 text-2xl">🚀</div>
              <div>
                <h3 className="text-blue-800 font-medium text-sm mb-1">Simplified Project Creation</h3>
                <p className="text-blue-700 text-sm mb-2">
                  Just provide a name and description to get started. You'll add URLs and analyze pages after creation.
                </p>
                <ul className="text-xs text-blue-600 space-y-1">
                  <li>• Quick project setup in seconds</li>
                  <li>• Add URLs and analyze pages later in project details</li>
                  <li>• Upload files or use live element picker when ready</li>
                </ul>
              </div>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Project Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g., My E-commerce Site, Admin Dashboard, User Portal"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
              <p className="text-xs text-gray-500 mt-1">Choose a descriptive name for your testing project</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Description (optional)
              </label>
              <textarea
                placeholder="Brief description of what this project tests..."
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
              <p className="text-xs text-gray-500 mt-1">Optional: Describe the purpose or scope of this project</p>
            </div>
            
            <div className="flex space-x-4 pt-4">
              <button
                type="submit"
                disabled={isCreating || !formData.name.trim()}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isCreating ? 'Creating...' : 'Create Project'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => {
          return (
            <div 
              key={project.id} 
              className="bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex flex-col"
              onDoubleClick={() => navigate(`/projects/${project.id}`)}
            >
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-base font-semibold text-slate-900 pr-2">{project.name}</h3>
                  <div className="flex space-x-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(project);
                      }}
                      className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                      title="Edit project"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id, project.name);
                      }}
                      className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                      title="Delete project"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-600 mb-4 h-8 overflow-hidden">{project.description}</p>

                {project.urls && project.urls.length > 0 ? (
                  <div className="space-y-1 mb-4">
                    {project.urls.slice(0, 2).map((url, index) => (
                      <p key={url.id || index} className="text-xs text-indigo-600 truncate">{url.url}</p>
                    ))}
                    {project.urls.length > 2 && (
                      <p className="text-xs text-slate-500">+ {project.urls.length - 2} more URLs</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-xs text-yellow-800 mb-4">
                      <strong>Setup Required:</strong> Add URLs and analyze pages to get started.
                  </div>
                )}
              </div>

              {/* Footer for stats and actions */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200">
                  <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center space-x-3 text-xs text-slate-500">
                          <span>{project._count.tests} tests</span>
                          {project._count.elements !== undefined && (
                              <>
                              <span>•</span>
                              <span>{project._count.elements} elements</span>
                              </>
                          )}
                      </div>
                      <span className="text-xs text-slate-400">
                          {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                  </div>
                  <div className="flex space-x-2">
                      {project.urls && project.urls.length > 0 ? (
                          <>
                              <Link
                                  to={`/projects/${project.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex-1 text-center px-3 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md shadow-sm hover:bg-indigo-700 transition-colors"
                              >
                                  View Dashboard
                              </Link>
                              <Link
                                  to={`/projects/${project.id}/tests/new`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex-1 text-center px-3 py-2 text-sm font-semibold text-white bg-green-600 rounded-md shadow-sm hover:bg-green-700 transition-colors"
                              >
                                  Create Test
                              </Link>
                          </>
                      ) : (
                          <Link
                              to={`/projects/${project.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 w-full text-center px-3 py-2 text-sm font-semibold text-white bg-orange-500 rounded-md shadow-sm hover:bg-orange-600 transition-colors"
                          >
                              🚀 Setup Project
                          </Link>
                      )}
                  </div>
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


      {/* Edit Project Modal */}
      {showEditForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Edit Project</h2>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Website URLs</label>
                {editFormData.urls.map((url, index) => (
                  <div key={index} className="flex items-center space-x-2 mb-2">
                    <input
                      type="url"
                      required={index === 0}
                      placeholder="https://example.com"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                      value={url}
                      onChange={(e) => updateEditUrl(index, e.target.value)}
                    />
                    {editFormData.urls.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEditUrlField(index)}
                        className="bg-red-500 text-white px-2 py-2 rounded-md hover:bg-red-600 text-sm"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addEditUrlField}
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
                  Update Project
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditForm(null)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Simplified Project Creation Progress Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="text-center space-y-4">
                {/* Header */}
                <div className="flex items-center justify-center space-x-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Creating Project</h3>
                    <p className="text-sm text-gray-600">Quick setup - just the essentials</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-green-600 h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${uploadProgress.progress}%` }}
                  />
                </div>

                {/* Progress Text */}
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {uploadProgress.progress}% Complete
                  </p>
                  <p className="text-sm text-gray-600">
                    {uploadProgress.message}
                  </p>
                </div>

                {/* Simplified Stage Indicators */}
                <div className="flex justify-center space-x-8 text-xs text-gray-500">
                  <div className={`flex flex-col items-center space-y-1 ${
                    ['creation', 'complete'].includes(uploadProgress.stage)
                      ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    <div className={`w-4 h-4 rounded-full ${
                      ['creation', 'complete'].includes(uploadProgress.stage)
                        ? 'bg-green-600' : 'bg-gray-300'
                    }`} />
                    <span>Create</span>
                  </div>
                  <div className={`flex flex-col items-center space-y-1 ${
                    ['complete'].includes(uploadProgress.stage)
                      ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    <div className={`w-4 h-4 rounded-full ${
                      ['complete'].includes(uploadProgress.stage)
                        ? 'bg-green-600' : 'bg-gray-300'
                    }`} />
                    <span>Ready</span>
                  </div>
                </div>

                {/* Tips */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-left">
                  <h4 className="text-sm font-medium text-green-800 mb-1">🚀 What's next?</h4>
                  <ul className="text-xs text-green-700 space-y-1">
                    <li>• Add URLs to your project</li>
                    <li>• Analyze pages to discover elements</li>
                    <li>• Upload source code files (optional)</li>
                    <li>• Start building your tests</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Folder Upload Modal */}
      {showFolderUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">📁 Upload Project Folder</h2>
                  <p className="text-sm opacity-90">
                    Upload your project files for automatic analysis and element discovery
                  </p>
                </div>
                <button
                  onClick={handleCancelUpload}
                  className="text-white hover:text-gray-200 text-2xl font-bold p-2 rounded-full hover:bg-black hover:bg-opacity-20 transition-colors"
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {!uploadedFiles.length ? (
                <FolderUploadZone
                  onFolderUploaded={handleFolderUpload}
                  className="w-full"
                />
              ) : isAnalyzing ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="animate-spin h-8 w-8 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-semibold text-gray-900">🔍 Analyzing Your Project</h3>
                    <p className="text-gray-600 max-w-md">
                      Our intelligent system is analyzing your {uploadedFiles.length} files to detect framework type, discover UI elements, and create your project...
                    </p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-lg">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">🧠 What we're doing:</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• Detecting framework (React, Vue, Angular, HTML)</li>
                      <li>• Extracting UI elements and selectors</li>
                      <li>• Discovering page structures and URLs</li>
                      <li>• Creating your project with discovered elements</li>
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between">
              <div className="text-sm text-gray-600">
                {uploadedFiles.length > 0 && (
                  <span>📂 {uploadedFiles.length} files uploaded</span>
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleCancelUpload}
                  disabled={isAnalyzing}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAnalyzing ? 'Analyzing...' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <LoadingModal
        isOpen={isUpdating || isCreating}
        message={isCreating ? "Creating Project" : "Updating Project"}
        subMessage={isCreating ? "Analyzing files and setting up project..." : "Please wait while we save your changes..."}
      />
    </div>
  );
}