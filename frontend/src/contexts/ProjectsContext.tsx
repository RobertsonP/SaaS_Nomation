import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { projectsAPI } from '../lib/api';
import { createLogger } from '../lib/logger';

const logger = createLogger('ProjectsContext');

interface ProjectUrl {
  id: string;
  url: string;
  title?: string;
  analyzed: boolean;
  verified: boolean;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  urls: ProjectUrl[];
  elements: any[];
  _count: {
    tests: number;
    elements: number;
    urls: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface ProjectsContextType {
  projects: Project[];
  loading: boolean;
  error: string | null;
  refreshProjects: () => Promise<void>;
  getProjectById: (id: string) => Project | undefined;
  updateProjectInCache: (project: Project) => void;
  removeProjectFromCache: (projectId: string) => void;
}

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Use ref for lastFetch to avoid callback dependency issues
  const lastFetchRef = useRef<number>(0);
  const [initialized, setInitialized] = useState(false);

  const fetchProjects = useCallback(async (force = false) => {
    // Skip if recently fetched (within 5 seconds) and not forced
    const now = Date.now();
    if (!force && lastFetchRef.current > 0 && now - lastFetchRef.current < 5000) {
      logger.debug('Skipping fetch - recently loaded');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await projectsAPI.getAll();
      setProjects(response.data);
      lastFetchRef.current = now;
      logger.debug('Projects loaded', { count: response.data.length });
    } catch (err: any) {
      logger.error('Failed to load projects', err);
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, []); // Empty deps - stable function now that lastFetch is a ref

  // Initial load on mount
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Listen for auth state changes (localStorage token changes)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token' && e.newValue) {
        // User logged in - force refresh
        logger.debug('Auth token changed - refreshing projects');
        lastFetchRef.current = 0;
        fetchProjects(true);
      }
    };

    // Also listen for custom auth events
    const handleAuthChange = () => {
      logger.debug('Auth change event - refreshing projects');
      lastFetchRef.current = 0;
      fetchProjects(true);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-changed', handleAuthChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-changed', handleAuthChange);
    };
  }, [fetchProjects]);

  const refreshProjects = useCallback(async () => {
    await fetchProjects(true);
  }, [fetchProjects]);

  const getProjectById = useCallback((id: string) => {
    return projects.find(p => p.id === id);
  }, [projects]);

  const updateProjectInCache = useCallback((project: Project) => {
    setProjects(prev => {
      const index = prev.findIndex(p => p.id === project.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = project;
        return updated;
      }
      return [...prev, project];
    });
  }, []);

  const removeProjectFromCache = useCallback((projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
  }, []);

  return (
    <ProjectsContext.Provider
      value={{
        projects,
        loading,
        error,
        refreshProjects,
        getProjectById,
        updateProjectInCache,
        removeProjectFromCache,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return context;
}
