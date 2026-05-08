import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Folder, Pencil, Plus, Trash2 } from 'lucide-react';
import { projectsAPI, authFlowsAPI } from '../../lib/api';
import { useNotification } from '../../contexts/NotificationContext';
import { useProjects } from '../../contexts/ProjectsContext';
import { LoadingModal } from '../../components/shared/LoadingModal';
import { Pill } from '../../components/ui/Pill';
import { AuthStep } from '../../types/api.types';
import { createLogger } from '../../lib/logger';

const logger = createLogger('ProjectsPage');

// Type alias for project data from context
type Project = ReturnType<typeof import('../../contexts/ProjectsContext').useProjects>['projects'][0];

export function ProjectsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showSuccess, showError } = useNotification();
  const { projects, loading, refreshProjects, removeProjectFromCache } = useProjects();

  // Safety refresh on mount - ensures projects are loaded after navigation
  useEffect(() => {
    logger.debug('ProjectsPage mounted - triggering refresh');
    refreshProjects();
  }, [refreshProjects]);
  const [showForm, setShowForm] = useState(false);

  // Auto-open the create-project modal when navigated here with ?new=1
  // (used by the dashboard's "New project" button).
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowForm(true);
      // Clear the query param so a refresh doesn't re-trigger the modal.
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);
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
  const [showAuthSetup, setShowAuthSetup] = useState<string | null>(null);
  const [authFormData, setAuthFormData] = useState({
    name: '',
    loginUrl: '',
    username: '',
    password: '',
    steps: [] as AuthStep[]
  });
  
  // Tab state for creation modal
  const [activeTab, setActiveTab] = useState<'manual' | 'github'>('manual');
  // GitHub form state
  const [githubData, setGithubData] = useState({
    repoUrl: '',
    token: ''
  });


  const handleGitHubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;

    try {
      setIsCreating(true);

      // Import from GitHub (clones and analyzes)
      const response = await projectsAPI.importGitHub(githubData.repoUrl, githubData.token);

      // Reset and navigate
      setGithubData({ repoUrl: '', token: '' });
      setShowForm(false);
      
      const projectName = response.data?.name || response.project?.name || 'Project';
      const projectId = response.data?.id || response.project?.id;

      showSuccess('Project Created', `Successfully imported project "${projectName}" from GitHub.`);
      if (projectId) {
        navigate(`/projects/${projectId}`);
      } else {
        refreshProjects();
      }

    } catch (error) {
      logger.error('Failed to import from GitHub', error);
      showError('Import Failed', 'Failed to import repository. Check URL and token.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isCreating) return; // Prevent multiple submissions

    try {
      setIsCreating(true);

      const projectData = {
        name: formData.name,
        description: formData.description,
        urls: formData.urls.filter(url => url.trim()).map(url => ({
          url: url,
          title: 'Page',
          description: 'Project URL'
        }))
      };

      const response = await projectsAPI.create(projectData);
      const createdProject = response.data;

      // Reset form and close
      setFormData({ name: '', description: '', urls: [''] });
      setShowForm(false);

      // Show success notification
      showSuccess('Project Created', `Successfully created project "${formData.name}". You can now add URLs and analyze pages in the project details.`);

      // Navigate to the created project
      navigate(`/projects/${createdProject.id}`);

    } catch (error) {
      logger.error('Failed to create project', error);
      showError('Creation Failed', 'Failed to create project. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // Delete project function
  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`Are you sure you want to delete project "${projectName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await projectsAPI.delete(projectId);
      refreshProjects();
      showSuccess('Project Deleted', `Successfully deleted project "${projectName}"`);
    } catch (error) {
      logger.error('Failed to delete project', error);
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
      refreshProjects();
      showSuccess('Project Updated', `Successfully updated project "${editFormData.name}"`);
    } catch (error) {
      logger.error('Failed to update project', error);
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

  // URL helper functions for manual creation form
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

  const handleShowAuthSetup = async (projectId: string) => {
    setShowAuthSetup(projectId);
    
    try {
      // CRITICAL FIX: Load existing auth flow data instead of empty form
      const response = await authFlowsAPI.getByProject(projectId);
      const existingAuthFlows = response.data;
      
      if (existingAuthFlows && existingAuthFlows.length > 0) {
        // Load existing auth flow data
        const authFlow = existingAuthFlows[0]; // Use first auth flow
        logger.debug('Loading existing auth flow', authFlow);
        
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
      logger.error('Failed to load existing auth flow', error);
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
      logger.error('Failed to save auth flow', error);
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
    <div className="content">
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <div className="sub">
            {projects.length} project{projects.length === 1 ? '' : 's'} in this workspace
          </div>
        </div>
        <div className="row">
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={13} />
            <span>New project</span>
          </button>
        </div>
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Create New Project</div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowForm(false)}
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="tabs" style={{ margin: '0 18px' }}>
              <button
                type="button"
                className={`tab ${activeTab === 'manual' ? 'active' : ''}`}
                onClick={() => setActiveTab('manual')}
              >
                Manual Setup
              </button>
              <button
                type="button"
                className={`tab ${activeTab === 'github' ? 'active' : ''}`}
                onClick={() => setActiveTab('github')}
              >
                GitHub Import
              </button>
            </div>

            <div className="modal-body">
              {activeTab === 'manual' && (
                <form onSubmit={handleSubmit} className="col" style={{ gap: 12 }}>
                  <div
                    style={{
                      background: 'var(--moss-soft)',
                      border: '1px solid var(--moss-edge)',
                      color: 'var(--moss)',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 12,
                    }}
                  >
                    Create a project and add URLs to analyze. Best for testing live websites.
                  </div>

                  <div className="field">
                    <label htmlFor="proj-name">
                      Project Name <span style={{ color: 'var(--clay)' }}>*</span>
                    </label>
                    <input
                      id="proj-name"
                      type="text"
                      required
                      placeholder="e.g. My E-commerce Site"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="proj-desc">Description (optional)</label>
                    <textarea
                      id="proj-desc"
                      placeholder="Brief description…"
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label>Website URLs (optional)</label>
                    <span className="hint" style={{ marginBottom: 4 }}>
                      Add URLs to analyze and test. You can also add them later.
                    </span>
                    <div className="col" style={{ gap: 6 }}>
                      {formData.urls.map((url, index) => (
                        <div key={index} className="row" style={{ gap: 6 }}>
                          <input
                            type="url"
                            placeholder="https://example.com"
                            value={url}
                            onChange={(e) => updateUrl(index, e.target.value)}
                            className="mono"
                            style={{
                              flex: 1,
                              background: 'var(--surface)',
                              border: '1px solid var(--hair-2)',
                              borderRadius: 5,
                              padding: '6px 8px',
                              fontSize: 12.5,
                              color: 'var(--ink)',
                            }}
                          />
                          {formData.urls.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeUrlField(index)}
                              className="icon-btn"
                              style={{ color: 'var(--clay)' }}
                              aria-label="Remove URL"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addUrlField}
                      className="btn btn-outline btn-sm"
                      style={{ alignSelf: 'flex-start', marginTop: 6 }}
                    >
                      <Plus size={13} />
                      <span>Add URL</span>
                    </button>
                  </div>
                </form>
              )}

              {activeTab === 'github' && (
                <form onSubmit={handleGitHubSubmit} className="col" style={{ gap: 12 }}>
                  <div
                    style={{
                      background: 'var(--slate-soft)',
                      border: '1px solid var(--slate-edge)',
                      color: 'var(--slate)',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 12,
                    }}
                  >
                    Clone a public or private repository. We'll analyze the code structure to
                    build your test project.
                  </div>

                  <div className="field">
                    <label htmlFor="gh-repo">
                      Repository URL <span style={{ color: 'var(--clay)' }}>*</span>
                    </label>
                    <input
                      id="gh-repo"
                      type="url"
                      required
                      placeholder="https://github.com/username/repo"
                      value={githubData.repoUrl}
                      onChange={(e) => setGithubData({ ...githubData, repoUrl: e.target.value })}
                      className="mono"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="gh-token">Personal Access Token (Optional)</label>
                    <input
                      id="gh-token"
                      type="password"
                      placeholder="ghp_xxxxxxxxxxxx"
                      value={githubData.token}
                      onChange={(e) => setGithubData({ ...githubData, token: e.target.value })}
                    />
                    <span className="hint">Required only for private repositories.</span>
                  </div>
                </form>
              )}
            </div>

            <div className="modal-foot">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              {activeTab === 'manual' ? (
                <button
                  type="submit"
                  onClick={handleSubmit as any}
                  disabled={isCreating || !formData.name.trim()}
                  className="btn btn-primary"
                  style={
                    isCreating || !formData.name.trim()
                      ? { opacity: 0.5, cursor: 'not-allowed' }
                      : undefined
                  }
                >
                  {isCreating ? 'Creating…' : 'Create Project'}
                </button>
              ) : (
                <button
                  type="submit"
                  onClick={handleGitHubSubmit as any}
                  disabled={isCreating || !githubData.repoUrl.trim()}
                  className="btn btn-primary"
                  style={
                    isCreating || !githubData.repoUrl.trim()
                      ? { opacity: 0.5, cursor: 'not-allowed' }
                      : undefined
                  }
                >
                  {isCreating ? 'Importing…' : 'Import Repository'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {projects.length === 0 && !showForm ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon">
              <Folder size={20} />
            </div>
            <h3>No projects yet</h3>
            <p>Create your first project to start adding URLs, picking elements, and authoring tests.</p>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <Plus size={13} />
              <span>Create your first project</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          className="stat-grid-4"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }}
        >
          {projects.map((project) => {
            const hasUrls = project.urls && project.urls.length > 0;
            return (
              <div
                key={project.id}
                className="card"
                style={{ overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => navigate(`/projects/${project.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/projects/${project.id}`);
                }}
              >
                <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--ink)',
                          letterSpacing: '-0.005em',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {project.name}
                      </div>
                      {project.description && (
                        <div
                          className="dim"
                          style={{
                            fontSize: 11.5,
                            marginTop: 2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {project.description}
                        </div>
                      )}
                    </div>
                    <div className="row" style={{ gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icon"
                        title="Open project"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/projects/${project.id}`);
                        }}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-icon"
                        title="Delete project"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProject(project.id, project.name);
                        }}
                        style={{ color: 'var(--clay)' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {hasUrls ? (
                    <div className="col" style={{ gap: 2 }}>
                      {project.urls.slice(0, 2).map((url, index) => (
                        <div
                          key={url.id || index}
                          className="mono"
                          style={{
                            fontSize: 11,
                            color: 'var(--slate)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={url.url}
                        >
                          {url.url}
                        </div>
                      ))}
                      {project.urls.length > 2 && (
                        <div className="dim" style={{ fontSize: 10.5 }}>
                          + {project.urls.length - 2} more
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        background: 'var(--amber-soft)',
                        border: '1px solid var(--amber-edge)',
                        borderRadius: 6,
                        padding: '8px 10px',
                        fontSize: 11.5,
                        color: 'var(--amber)',
                      }}
                    >
                      Setup needed — add URLs to get started.
                    </div>
                  )}

                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <Pill kind="mute" dot={false}>
                      {project._count.tests} test{project._count.tests === 1 ? '' : 's'}
                    </Pill>
                    <Pill kind="mute" dot={false}>
                      {project._count.elements} element{project._count.elements === 1 ? '' : 's'}
                    </Pill>
                    <Pill kind="mute" dot={false}>
                      {project._count.urls} URL{project._count.urls === 1 ? '' : 's'}
                    </Pill>
                  </div>

                  <div
                    className="row"
                    style={{
                      gap: 6,
                      paddingTop: 8,
                      borderTop: '1px solid var(--hair)',
                    }}
                  >
                    <Link
                      to={`/projects/${project.id}/tests`}
                      className="btn btn-outline btn-sm"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      View tests
                    </Link>
                    <Link
                      to={`/projects/${project.id}/tests/new`}
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1, justifyContent: 'center' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      New test
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {false && (
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

      <LoadingModal
        isOpen={isUpdating || isCreating}
        message={isCreating ? "Creating Project" : "Updating Project"}
        subMessage={isCreating ? "Analyzing files and setting up project..." : "Please wait while we save your changes..."}
      />
    </div>
  );
}