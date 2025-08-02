import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { projectsAPI, authFlowsAPI } from '../../lib/api';
import { useNotification } from '../../contexts/NotificationContext';
import { LoadingModal } from '../../components/shared/LoadingModal';

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
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    urls: ['']
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    urls: ['']
  });
  
  // NEW: Authentication setup state
  const [showAuthSetup, setShowAuthSetup] = useState<string | null>(null); // projectId
  const [authFormData, setAuthFormData] = useState({
    name: '',
    loginUrl: '',
    username: '',
    password: '',
    steps: [
      { type: 'type', selector: '#username', value: '${username}', description: 'Enter username' },
      { type: 'type', selector: '#password', value: '${password}', description: 'Enter password' },
      { type: 'click', selector: '#login-button', description: 'Click login button' }
    ]
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
      // Filter out empty URLs and use first URL as main URL for backward compatibility
      const validUrls = formData.urls.filter(url => url.trim() !== '');
      if (validUrls.length === 0) {
        showError('Validation Error', 'Please add at least one URL');
        return;
      }
      
      setIsCreating(true);
      
      const projectData = {
        name: formData.name,
        description: formData.description,
        urls: validUrls.map(url => ({
          url: url,
          title: 'Page',
          description: 'Project URL'
        })) // Properly formatted URLs array
      };
      
      const response = await projectsAPI.create(projectData);
      const createdProject = response.data;
      
      // Reset form and close
      setFormData({ name: '', description: '', urls: [''] });
      setShowForm(false);
      
      // Show success notification
      showSuccess('Project Created', `Successfully created project "${formData.name}" with ${validUrls.length} URL${validUrls.length > 1 ? 's' : ''}`);
      
      // Navigate to the created project
      navigate(`/projects/${createdProject.id}`);
      
    } catch (error) {
      console.error('Failed to create project:', error);
      showError('Creation Failed', 'Failed to create project. Please try again.');
    } finally {
      setIsCreating(false);
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

  // NEW: Authentication setup functions
  const handleShowAuthSetup = async (projectId: string) => {
    setShowAuthSetup(projectId);
    
    try {
      // CRITICAL FIX: Load existing auth flow data instead of empty form
      const response = await authFlowsAPI.getByProject(projectId);
      const existingAuthFlows = response.data;
      
      if (existingAuthFlows && existingAuthFlows.length > 0) {
        // Load existing auth flow data
        const authFlow = existingAuthFlows[0]; // Use first auth flow
        console.log('Loading existing auth flow:', authFlow);
        
        setAuthFormData({
          name: authFlow.name || '',
          loginUrl: authFlow.loginUrl || '',
          username: authFlow.credentials?.username || '',
          password: authFlow.credentials?.password || '',
          steps: authFlow.steps || [
            { type: 'type', selector: '#username', value: '${username}', description: 'Enter username' },
            { type: 'type', selector: '#password', value: '${password}', description: 'Enter password' },
            { type: 'click', selector: '#login-button', description: 'Click login button' }
          ]
        });
      } else {
        // No existing auth flow - use default values
        setAuthFormData({
          name: '',
          loginUrl: '',
          username: '',
          password: '',
          steps: [
            { type: 'type', selector: '#username', value: '${username}', description: 'Enter username' },
            { type: 'type', selector: '#password', value: '${password}', description: 'Enter password' },
            { type: 'click', selector: '#login-button', description: 'Click login button' }
          ]
        });
      }
    } catch (error) {
      console.error('Failed to load existing auth flow:', error);
      // Fallback to empty form if API call fails
      setAuthFormData({
        name: '',
        loginUrl: '',
        username: '',
        password: '',
        steps: [
          { type: 'type', selector: '#username', value: '${username}', description: 'Enter username' },
          { type: 'type', selector: '#password', value: '${password}', description: 'Enter password' },
          { type: 'click', selector: '#login-button', description: 'Click login button' }
        ]
      });
    }
  };

  const handleSaveAuthFlow = async () => {
    if (!showAuthSetup) return;

    // Validation
    if (!authFormData.name || !authFormData.loginUrl || !authFormData.username || !authFormData.password) {
      showError('Validation Error', 'Please fill in all required fields');
      return;
    }

    if (authFormData.steps.length === 0) {
      showError('Validation Error', 'Please add at least one authentication step');
      return;
    }

    // Validate steps
    for (const step of authFormData.steps) {
      if (!step.selector || !step.description) {
        showError('Validation Error', 'Please fill in all step fields (selector and description)');
        return;
      }
      if (step.type === 'type' && !step.value) {
        showError('Validation Error', 'Type steps must have a value (use $' + '{username} or $' + '{password})');
        return;
      }
    }

    try {
      await authFlowsAPI.create(showAuthSetup, {
        name: authFormData.name,
        loginUrl: authFormData.loginUrl,
        username: authFormData.username,
        password: authFormData.password,
        steps: authFormData.steps,
      });
      
      setShowAuthSetup(null);
      showSuccess('Authentication Setup', 'Authentication flow saved successfully');
    } catch (error) {
      console.error('Failed to save auth flow:', error);
      showError('Save Failed', 'Failed to save authentication flow. Please try again.');
    }
  };

  const addAuthStep = () => {
    setAuthFormData({
      ...authFormData,
      steps: [...authFormData.steps, { type: 'click', selector: '', description: '', value: '' }]
    });
  };

  const updateAuthStep = (index: number, field: string, value: string) => {
    const newSteps = [...authFormData.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setAuthFormData({ ...authFormData, steps: newSteps });
  };

  const removeAuthStep = (index: number) => {
    const newSteps = authFormData.steps.filter((_, i) => i !== index);
    setAuthFormData({ ...authFormData, steps: newSteps });
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
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(project);
                    }}
                    className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
                    title="Edit project details and URLs"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleShowAuthSetup(project.id)}
                    className="px-3 py-1 text-xs rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                    title="Setup authentication for protected pages"
                  >
                    🔐 Auth
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
              <div className="mb-4">
                {project.urls && project.urls.length > 0 ? (
                  <div className="space-y-1">
                    {project.urls.slice(0, 2).map((url, index) => (
                      <p key={url.id || index} className="text-sm text-blue-600 truncate">{url.url}</p>
                    ))}
                    {project.urls.length > 2 && (
                      <p className="text-xs text-gray-500">+ {project.urls.length - 2} more URLs</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No URLs configured</p>
                )}
              </div>

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

      {/* NEW: Authentication Setup Modal */}
      {showAuthSetup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">🔐 Setup Authentication Flow</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800 font-medium mb-2">How Authentication Works:</p>
              <ol className="text-sm text-blue-700 list-decimal list-inside space-y-1">
                <li>System will navigate to your login page</li>
                <li>Execute the steps you define below (fill username, password, click login)</li>
                <li>Once logged in, scrape all project URLs for elements</li>
                <li>Discover elements only available after authentication</li>
              </ol>
            </div>
            
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Flow Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Admin Login, User Portal Access"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={authFormData.name}
                    onChange={(e) => setAuthFormData({...authFormData, name: e.target.value})}
                  />
                  <p className="text-xs text-gray-500 mt-1">Give this authentication flow a descriptive name</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Login Page URL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://yoursite.com/login"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={authFormData.loginUrl}
                    onChange={(e) => setAuthFormData({...authFormData, loginUrl: e.target.value})}
                  />
                  <p className="text-xs text-gray-500 mt-1">URL where the login form is located</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Username/Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="your.username@example.com"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={authFormData.username}
                    onChange={(e) => setAuthFormData({...authFormData, username: e.target.value})}
                  />
                  <p className="text-xs text-gray-500 mt-1">Actual credentials to use for login</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Your secure password"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    value={authFormData.password}
                    onChange={(e) => setAuthFormData({...authFormData, password: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Login Steps <span className="text-red-500">*</span>
                </label>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                  <p className="text-sm text-yellow-800 font-medium mb-2">Step Instructions:</p>
                  <ul className="text-xs text-yellow-700 space-y-1">
                    <li><strong>Type:</strong> Fill form fields with {'${username}'} or {'${password}'} placeholders</li>
                    <li><strong>Click:</strong> Click buttons, links, or submit forms</li>
                    <li><strong>Wait:</strong> Wait specified milliseconds (useful between actions)</li>
                    <li><strong>Selectors:</strong> Use CSS selectors like #username, .login-btn, [name="email"]</li>
                  </ul>
                </div>
                
                {authFormData.steps.map((step, index) => (
                  <div key={index} className="border border-gray-200 rounded-md p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Step {index + 1}</span>
                      {authFormData.steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAuthStep(index)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
                          <select
                            value={step.type}
                            onChange={(e) => updateAuthStep(index, 'type', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          >
                            <option value="type">⌨️ Type Text</option>
                            <option value="click">🖱️ Click Element</option>
                            <option value="wait">⏱️ Wait</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            {step.type === 'wait' ? 'Milliseconds' : 'CSS Selector'}
                          </label>
                          <input
                            type="text"
                            placeholder={
                              step.type === 'wait' ? '2000' : 
                              step.type === 'type' ? '#username, [name="email"]' :
                              '#login-btn, .submit'
                            }
                            value={step.selector}
                            onChange={(e) => updateAuthStep(index, 'selector', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        </div>
                        
                        {step.type === 'type' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Value</label>
                            <input
                              type="text"
                              placeholder="$username or $password"
                              value={step.value}
                              onChange={(e) => updateAuthStep(index, 'value', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            />
                          </div>
                        )}
                      
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                        <input
                          type="text"
                          placeholder={
                            step.type === 'type' ? 'e.g., Enter username in email field' :
                            step.type === 'click' ? 'e.g., Click the login button' :
                            'e.g., Wait for page to load'
                          }
                          value={step.description}
                          onChange={(e) => updateAuthStep(index, 'description', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={addAuthStep}
                  className="bg-green-500 text-white px-3 py-1 rounded text-xs hover:bg-green-600"
                >
                  + Add Step
                </button>
              </div>
            </form>

            <div className="flex space-x-4 mt-6">
              <button
                onClick={handleSaveAuthFlow}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Save Authentication
              </button>
              <button
                onClick={() => setShowAuthSetup(null)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
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

      {/* Loading Modals */}
      <LoadingModal
        isOpen={isCreating}
        message="Creating Project"
        subMessage="Please wait while we set up your project..."
      />
      
      <LoadingModal
        isOpen={isUpdating}
        message="Updating Project"
        subMessage="Please wait while we save your changes..."
      />
    </div>
  );
}