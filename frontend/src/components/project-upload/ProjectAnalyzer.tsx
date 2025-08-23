import { useState, useEffect } from 'react';
import { ProjectElement } from '../../types/element.types';

interface FileInfo {
  name: string;
  path: string;
  size: number;
  type: string;
  content?: string;
}

interface AnalysisResult {
  urls: Array<{
    url: string;
    title?: string;
    description?: string;
    source: string;
  }>;
  elements: ProjectElement[];
  pages: Array<{
    path: string;
    title: string;
    components: string[];
    routes: string[];
  }>;
  framework: string;
  statistics: {
    totalFiles: number;
    componentFiles: number;
    routeFiles: number;
    elementsFound: number;
    pagesDiscovered: number;
  };
}

interface ProjectAnalyzerProps {
  files: FileInfo[];
  onAnalysisComplete: (result: AnalysisResult) => void;
  onAnalysisProgress?: (step: string, progress: number) => void;
  className?: string;
}

export function ProjectAnalyzer({
  files,
  onAnalysisComplete,
  onAnalysisProgress,
  className = ''
}: ProjectAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (files.length > 0) {
      analyzeProject();
    }
  }, [files]);

  const analyzeProject = async () => {
    setIsAnalyzing(true);
    setError(null);
    setProgress(0);

    try {
      // Step 1: Detect Framework
      updateProgress('Detecting project framework...', 10);
      const framework = detectFramework(files);
      
      // Step 2: Discover Routes and Pages
      updateProgress('Discovering pages and routes...', 25);
      const pages = await discoverPages(files, framework);
      
      // Step 3: Extract URLs
      updateProgress('Extracting URLs and endpoints...', 40);
      const urls = extractUrls(files, pages, framework);
      
      // Step 4: Analyze Components
      updateProgress('Analyzing components and elements...', 60);
      const elements = await analyzeElements(files, framework);
      
      // Step 5: Generate Statistics
      updateProgress('Generating analysis report...', 80);
      const statistics = generateStatistics(files, pages, elements);
      
      updateProgress('Analysis complete!', 100);
      
      const result: AnalysisResult = {
        urls,
        elements,
        pages,
        framework,
        statistics
      };

      setAnalysisResult(result);
      onAnalysisComplete(result);
      
    } catch (err) {
      console.error('Project analysis failed:', err);
      setError('Failed to analyze project. Please ensure you\'ve uploaded a valid web project.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateProgress = (step: string, progressValue: number) => {
    setCurrentStep(step);
    setProgress(progressValue);
    onAnalysisProgress?.(step, progressValue);
  };

  const detectFramework = (files: FileInfo[]): string => {
    // Check for package.json
    const packageJson = files.find(f => f.name === 'package.json');
    if (packageJson?.content) {
      try {
        const pkg = JSON.parse(packageJson.content);
        
        // Check dependencies for framework indicators
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        if (deps.react || deps['@types/react']) return 'React';
        if (deps.vue || deps['@vue/cli-service']) return 'Vue.js';
        if (deps['@angular/core']) return 'Angular';
        if (deps.next) return 'Next.js';
        if (deps.nuxt) return 'Nuxt.js';
        if (deps.svelte) return 'Svelte';
      } catch (e) {
        console.warn('Failed to parse package.json');
      }
    }

    // Check for framework-specific files
    const hasVueFiles = files.some(f => f.name.endsWith('.vue'));
    const hasReactFiles = files.some(f => f.name.endsWith('.tsx') || f.name.endsWith('.jsx'));
    const hasAngularFiles = files.some(f => f.name.includes('angular') || f.name.includes('component.ts'));
    const hasSvelteFiles = files.some(f => f.name.endsWith('.svelte'));

    if (hasVueFiles) return 'Vue.js';
    if (hasReactFiles) return 'React';
    if (hasAngularFiles) return 'Angular';
    if (hasSvelteFiles) return 'Svelte';

    // Check for plain HTML
    const hasHtmlFiles = files.some(f => f.name.endsWith('.html'));
    if (hasHtmlFiles) return 'HTML/Vanilla JS';

    return 'Unknown';
  };

  const discoverPages = async (files: FileInfo[], framework: string) => {
    const pages: Array<{
      path: string;
      title: string;
      components: string[];
      routes: string[];
    }> = [];

    // Look for routing files and page components based on framework
    for (const file of files) {
      if (file.content) {
        let isPageFile = false;
        let routes: string[] = [];
        
        // Detect routes based on framework
        if (framework === 'React' || framework === 'Next.js') {
          // React Router patterns
          if (file.content.includes('Route') && file.content.includes('path=')) {
            const routeMatches = file.content.match(/path=["']([^"']+)["']/g);
            routes = routeMatches?.map(match => match.replace(/path=["']([^"']+)["']/, '$1')) || [];
            isPageFile = true;
          }
          
          // Next.js file-based routing
          if (file.path.includes('pages/') || file.path.includes('app/')) {
            const routePath = file.path.replace(/^.*?(pages|app)\//, '/').replace(/\.[^.]+$/, '');
            routes = [routePath === '/index' ? '/' : routePath];
            isPageFile = true;
          }
        } else if (framework === 'Vue.js') {
          // Vue Router patterns
          if (file.content.includes('router') && file.content.includes('path:')) {
            const routeMatches = file.content.match(/path:\s*["']([^"']+)["']/g);
            routes = routeMatches?.map(match => match.replace(/path:\s*["']([^"']+)["']/, '$1')) || [];
            isPageFile = true;
          }
        } else if (framework === 'HTML/Vanilla JS') {
          // HTML files are pages
          if (file.name.endsWith('.html')) {
            routes = ['/' + file.name.replace('.html', '')];
            if (file.name === 'index.html') routes = ['/'];
            isPageFile = true;
          }
        }

        if (isPageFile) {
          // Extract title from content
          const titleMatch = file.content.match(/<title>([^<]+)<\/title>/i) ||
                           file.content.match(/title:\s*["']([^"']+)["']/);
          const title = titleMatch?.[1] || file.name.replace(/\.[^.]+$/, '');

          // Extract component references
          const components = extractComponentReferences(file.content, framework);

          pages.push({
            path: file.path,
            title,
            components,
            routes
          });
        }
      }
    }

    return pages;
  };

  const extractComponentReferences = (content: string, framework: string): string[] => {
    const components: string[] = [];

    if (framework === 'React' || framework === 'Next.js') {
      // Extract JSX component usage: <ComponentName />
      const jsxMatches = content.match(/<[A-Z][a-zA-Z0-9]*\s*[^>]*\/?>/g);
      if (jsxMatches) {
        components.push(...jsxMatches.map(match => match.replace(/<([A-Z][a-zA-Z0-9]*)\s*[^>]*\/?>/g, '$1')));
      }
    } else if (framework === 'Vue.js') {
      // Extract Vue component usage: <component-name> or <ComponentName>
      const vueMatches = content.match(/<[a-zA-Z][a-zA-Z0-9-]*\s*[^>]*\/?>/g);
      if (vueMatches) {
        components.push(...vueMatches.map(match => match.replace(/<([a-zA-Z][a-zA-Z0-9-]*)\s*[^>]*\/?>/g, '$1')));
      }
    }

    return [...new Set(components)]; // Remove duplicates
  };

  const extractUrls = (files: FileInfo[], pages: any[], framework: string) => {
    const urls: Array<{
      url: string;
      title?: string;
      description?: string;
      source: string;
    }> = [];

    // Default development URLs based on framework
    const defaultPorts: Record<string, number> = {
      'React': 3000,
      'Vue.js': 8080,
      'Angular': 4200,
      'Next.js': 3000,
      'Nuxt.js': 3000,
      'Svelte': 5000
    };

    const basePort = defaultPorts[framework] || 3000;
    const baseUrl = `http://localhost:${basePort}`;

    // Add discovered routes
    pages.forEach(page => {
      page.routes.forEach((route: string) => {
        urls.push({
          url: baseUrl + route,
          title: page.title,
          description: `Page: ${page.title}`,
          source: 'discovered'
        });
      });
    });

    // Add common paths if no routes discovered
    if (urls.length === 0) {
      urls.push({
        url: baseUrl,
        title: 'Home Page',
        description: 'Main application page',
        source: 'default'
      });
    }

    // Look for API endpoints in code
    files.forEach(file => {
      if (file.content) {
        // Find API endpoints using simpler regex
        const apiPattern = /\/api\/[a-zA-Z0-9\/\-_]+/g;
        const apiMatches = file.content.match(apiPattern);
        if (apiMatches) {
          apiMatches.forEach(endpoint => {
            urls.push({
              url: baseUrl + endpoint,
              title: 'API Endpoint',
              description: `API: ${endpoint}`,
              source: 'api'
            });
          });
        }
      }
    });

    return urls;
  };

  const analyzeElements = async (files: FileInfo[], framework: string): Promise<ProjectElement[]> => {
    const elements: ProjectElement[] = [];

    for (const file of files) {
      if (file.content) {
        // Extract different types of elements based on framework
        const fileElements = extractElementsFromFile(file, framework);
        elements.push(...fileElements);
      }
    }

    return elements;
  };

  const extractElementsFromFile = (file: FileInfo, framework: string): ProjectElement[] => {
    const elements: ProjectElement[] = [];
    const content = file.content || '';

    // Common HTML elements to look for
    const elementSelectors = [
      'button', 'input', 'textarea', 'select', 'a', 'form',
      '[data-testid]', '[aria-label]', '[role="button"]',
      '.btn', '.button', '.form-control', '.input'
    ];

    if (framework === 'React' || framework === 'Next.js') {
      // JSX patterns
      const jsxElementRegex = /<(button|input|textarea|select|a|form|div|span)([^>]*?)(?:\/>|>[^<]*<\/\1>)/gi;
      let match;

      while ((match = jsxElementRegex.exec(content)) !== null) {
        const [fullMatch, tagName, attributes] = match;
        
        // Extract meaningful attributes
        const testId = attributes.match(/data-testid=["']([^"']+)["']/)?.[1];
        const className = attributes.match(/className=["']([^"']+)["']/)?.[1];
        const id = attributes.match(/id=["']([^"']+)["']/)?.[1];
        const placeholder = attributes.match(/placeholder=["']([^"']+)["']/)?.[1];
        const ariaLabel = attributes.match(/aria-label=["']([^"']+)["']/)?.[1];
        
        // Generate selector
        let selector = tagName.toLowerCase();
        if (id) selector = `#${id}`;
        else if (testId) selector = `[data-testid="${testId}"]`;
        else if (className) selector = `.${className.split(' ')[0]}`;

        // Generate description
        const description = ariaLabel || placeholder || testId || `${tagName} element`;

        elements.push({
          id: `${file.path}-${elements.length}`,
          projectId: 'temp-project-id', // TODO: Pass actual projectId as prop
          selector,
          elementType: tagName.toLowerCase() as any,
          description,
          attributes: {
            text: placeholder || ariaLabel || '',
            id,
            class: className,
            'data-testid': testId,
            'aria-label': ariaLabel,
            placeholder,
            tagName: tagName.toLowerCase(),
            sourceFile: file.path
          },
          confidence: testId ? 0.95 : (id ? 0.85 : 0.65),
          sourceUrl: {
            id: `${file.path}-url`,
            url: file.path,
            title: file.name,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          screenshot: null
        });
      }
    } else if (framework === 'HTML/Vanilla JS') {
      // HTML patterns
      const htmlElementRegex = /<(button|input|textarea|select|a|form|div|span)([^>]*?)(?:\/>|>[^<]*<\/\1>)/gi;
      let match;

      while ((match = htmlElementRegex.exec(content)) !== null) {
        const [fullMatch, tagName, attributes] = match;
        
        // Extract meaningful attributes
        const id = attributes.match(/id=["']([^"']+)["']/)?.[1];
        const className = attributes.match(/class=["']([^"']+)["']/)?.[1];
        const placeholder = attributes.match(/placeholder=["']([^"']+)["']/)?.[1];
        const ariaLabel = attributes.match(/aria-label=["']([^"']+)["']/)?.[1];
        
        // Generate selector
        let selector = tagName.toLowerCase();
        if (id) selector = `#${id}`;
        else if (className) selector = `.${className.split(' ')[0]}`;

        // Generate description
        const description = ariaLabel || placeholder || id || `${tagName} element`;

        elements.push({
          id: `${file.path}-${elements.length}`,
          projectId: 'temp-project-id', // TODO: Pass actual projectId as prop
          selector,
          elementType: tagName.toLowerCase() as any,
          description,
          attributes: {
            text: placeholder || ariaLabel || '',
            id,
            class: className,
            'aria-label': ariaLabel,
            placeholder,
            tagName: tagName.toLowerCase(),
            sourceFile: file.path
          },
          confidence: id ? 0.85 : (className ? 0.65 : 0.45),
          sourceUrl: {
            id: `${file.path}-url`,
            url: file.path,
            title: file.name,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          screenshot: null
        });
      }
    }

    return elements;
  };

  const generateStatistics = (files: FileInfo[], pages: any[], elements: ProjectElement[]) => {
    const componentFiles = files.filter(f => 
      f.name.endsWith('.tsx') || 
      f.name.endsWith('.jsx') || 
      f.name.endsWith('.vue') || 
      f.name.endsWith('.component.ts') ||
      f.name.endsWith('.svelte')
    ).length;

    const routeFiles = files.filter(f =>
      f.path.includes('router') ||
      f.path.includes('routes') ||
      f.path.includes('pages')
    ).length;

    return {
      totalFiles: files.length,
      componentFiles,
      routeFiles,
      elementsFound: elements.length,
      pagesDiscovered: pages.length
    };
  };

  if (!isAnalyzing && !analysisResult) {
    return null;
  }

  return (
    <div className={`project-analyzer ${className}`}>
      {isAnalyzing && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Analyzing Your Project
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {currentStep}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="text-center text-sm text-gray-500">
            {Math.round(progress)}% complete
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="text-red-500 text-xl">⚠️</div>
            <div>
              <div className="font-medium text-red-800 mb-1">Analysis Failed</div>
              <div className="text-red-700 text-sm">{error}</div>
            </div>
          </div>
        </div>
      )}

      {analysisResult && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-4">🎉</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Project Analysis Complete!
            </h3>
            <p className="text-sm text-gray-600">
              Your project has been successfully analyzed and is ready for test automation.
            </p>
          </div>

          {/* Analysis Summary */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-800 mb-3">Analysis Summary</h4>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {analysisResult.statistics.elementsFound}
                </div>
                <div className="text-green-700">Elements Found</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {analysisResult.urls.length}
                </div>
                <div className="text-blue-700">URLs Discovered</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {analysisResult.statistics.pagesDiscovered}
                </div>
                <div className="text-purple-700">Pages Found</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {analysisResult.statistics.componentFiles}
                </div>
                <div className="text-orange-700">Components</div>
              </div>
            </div>

            <div className="mt-4 text-center text-sm text-green-700">
              <strong>Framework:</strong> {analysisResult.framework}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}