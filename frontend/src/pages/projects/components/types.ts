import { ProjectElement } from '../../../types/element.types';

export interface ProjectUrl {
  id: string;
  url: string;
  title?: string;
  description?: string;
  analyzed: boolean;
  analysisDate?: string;
  verified: boolean;
  lastVerified?: string;
  discoveryDepth?: number;  // 0 = root, 1 = direct links, 2+ = deeper links
  discovered?: boolean;     // Whether URL was discovered vs manually added
  pageType?: string;        // home, product, category, etc.
  screenshot?: string;      // Thumbnail screenshot
}

export interface Project {
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

export interface TestStats {
  totalExecutions: number;
  totalPassed: number;
  totalFailed: number;
  regressions: number;
  successRate: number;
}
