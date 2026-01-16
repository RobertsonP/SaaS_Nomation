import { ChevronRight, Zap } from 'lucide-react';

interface ProjectCardProps {
  /**
   * Project ID for navigation
   */
  id: string;

  /**
   * Project name
   */
  name: string;

  /**
   * Project description
   */
  description?: string;

  /**
   * Number of tests in the project
   */
  testCount: number;

  /**
   * Last updated date
   */
  updatedAt: string;

  /**
   * Click handler (typically navigation)
   */
  onClick: () => void;
}

/**
 * A reusable project card component for displaying project summaries
 */
export function ProjectCard({
  name,
  description,
  testCount,
  updatedAt,
  onClick,
}: ProjectCardProps) {
  return (
    <div
      onClick={onClick}
      className="group border border-gray-100 p-4 rounded-xl hover:border-blue-200 hover:bg-blue-50/30 cursor-pointer transition-all"
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
          {name}
        </h3>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400" />
      </div>
      <p className="text-sm text-gray-500 line-clamp-1 mb-3">
        {description || 'No description provided'}
      </p>
      <div className="flex items-center space-x-3 text-xs text-gray-400">
        <span className="flex items-center">
          <Zap className="w-3 h-3 mr-1" /> {testCount} tests
        </span>
        <span>•</span>
        <span>Updated {new Date(updatedAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

/**
 * A grid container for multiple project cards
 */
interface ProjectGridProps {
  projects: Array<{
    id: string;
    name: string;
    description?: string;
    _count?: { tests: number };
    testCount?: number;
    createdAt?: string;
    updatedAt?: string;
  }>;
  onProjectClick: (projectId: string) => void;
  maxItems?: number;
}

export function ProjectGrid({ projects, onProjectClick, maxItems = 4 }: ProjectGridProps) {
  const displayedProjects = maxItems ? projects.slice(0, maxItems) : projects;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {displayedProjects.map((project) => (
        <ProjectCard
          key={project.id}
          id={project.id}
          name={project.name}
          description={project.description}
          testCount={project._count?.tests || project.testCount || 0}
          updatedAt={project.updatedAt || project.createdAt || new Date().toISOString()}
          onClick={() => onProjectClick(project.id)}
        />
      ))}
    </div>
  );
}
