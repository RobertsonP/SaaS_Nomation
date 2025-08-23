import { Injectable } from '@nestjs/common';

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  type: string;
  content: string;
}

export interface AnalysisResult {
  urls: Array<{
    url: string;
    title?: string;
    description?: string;
    source: string;
  }>;
  elements: Array<{
    selector: string;
    elementType: 'button' | 'input' | 'link' | 'form' | 'navigation' | 'text';
    description: string;
    attributes: Record<string, any>;
    confidence: number;
    source: string;
  }>;
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

@Injectable()
export class ProjectAnalyzerService {
  
  /**
   * Analyze uploaded project files to extract elements, routes, and structure
   */
  async analyzeProjectFiles(files: FileInfo[]): Promise<AnalysisResult> {
    console.log(`🔍 Starting server-side analysis of ${files.length} files`);
    
    try {
      // Step 1: Detect Framework
      const framework = this.detectFramework(files);
      console.log(`📋 Detected framework: ${framework}`);
      
      // Step 2: Discover Pages and Routes
      const pages = this.discoverPages(files, framework);
      console.log(`📄 Discovered ${pages.length} pages/routes`);
      
      // Step 3: Extract URLs
      const urls = this.extractUrls(files, pages, framework);
      console.log(`🌐 Extracted ${urls.length} URLs`);
      
      // Step 4: Analyze Elements
      const elements = this.analyzeElements(files, framework);
      console.log(`🎯 Found ${elements.length} UI elements`);
      
      // Step 5: Generate Statistics
      const statistics = this.generateStatistics(files, pages, elements);
      
      const result: AnalysisResult = {
        urls,
        elements,
        pages,
        framework,
        statistics
      };

      console.log(`✅ Analysis complete: ${elements.length} elements, ${urls.length} URLs, framework: ${framework}`);
      return result;
      
    } catch (error) {
      console.error('❌ Project analysis failed:', error);
      throw new Error(`Project analysis failed: ${error.message}`);
    }
  }

  /**
   * UNIVERSAL FRAMEWORK DETECTION - Supports ALL technologies (400MB+ enterprise projects)
   * Detects: Django, C#/.NET, Java, PHP, Python, Ruby, Go, React, Angular, Vue, and more
   */
  private detectFramework(files: FileInfo[]): string {
    console.log(`🔍 Universal framework detection for ${files.length} files`);
    
    // PRIORITY 1: Package/Config files (most reliable detection)
    
    // JavaScript/TypeScript/Node.js frameworks
    const packageJson = files.find(f => f.name === 'package.json');
    if (packageJson?.content) {
      try {
        const pkg = JSON.parse(packageJson.content);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        
        // Frontend frameworks (priority order)
        if (deps.react || deps['@types/react']) return 'React + TypeScript';
        if (deps.next) return 'Next.js (React)';
        if (deps.gatsby) return 'Gatsby (React)';
        if (deps.vue || deps['@vue/cli-service']) return 'Vue.js';
        if (deps.nuxt) return 'Nuxt.js (Vue)';
        if (deps['@angular/core']) return 'Angular + TypeScript';
        if (deps.svelte) return 'Svelte';
        
        // Backend Node.js
        if (deps.express) return 'Express.js (Node)';
        if (deps.koa) return 'Koa.js (Node)';
        if (deps.fastify) return 'Fastify (Node)';
        if (deps['@nestjs/core']) return 'NestJS (Node + TypeScript)';
        
        // Mobile frameworks
        if (deps['react-native']) return 'React Native';
        if (deps['@ionic/react'] || deps['@ionic/angular']) return 'Ionic Framework';
        
        console.log(`📦 Detected from package.json dependencies`);
      } catch (e) {
        console.warn('Failed to parse package.json:', e);
      }
    }

    // Python frameworks - Multiple detection methods
    const requirementsTxt = files.find(f => f.name === 'requirements.txt');
    const pipfile = files.find(f => f.name === 'Pipfile');
    const pyprojectToml = files.find(f => f.name === 'pyproject.toml');
    const managePy = files.find(f => f.name === 'manage.py');
    
    if (managePy || requirementsTxt || pipfile || pyprojectToml) {
      let pythonContent = '';
      if (requirementsTxt) pythonContent += requirementsTxt.content.toLowerCase();
      if (pipfile) pythonContent += pipfile.content.toLowerCase();
      if (pyprojectToml) pythonContent += pyprojectToml.content.toLowerCase();
      if (managePy) pythonContent += managePy.content.toLowerCase();
      
      if (managePy || pythonContent.includes('django')) return 'Django (Python)';
      if (pythonContent.includes('flask')) return 'Flask (Python)';
      if (pythonContent.includes('fastapi')) return 'FastAPI (Python)';
      if (pythonContent.includes('tornado')) return 'Tornado (Python)';
      if (pythonContent.includes('pyramid')) return 'Pyramid (Python)';
      if (pythonContent.includes('streamlit')) return 'Streamlit (Python)';
      console.log(`🐍 Detected Python framework`);
    }

    // C#/.NET frameworks
    const csprojFiles = files.filter(f => f.name.endsWith('.csproj') || f.name.endsWith('.sln'));
    const globalJson = files.find(f => f.name === 'global.json');
    const hasCs = files.some(f => f.name.endsWith('.cs'));
    const hasRazor = files.some(f => f.name.endsWith('.cshtml') || f.name.endsWith('.razor'));
    
    if (csprojFiles.length > 0 || hasCs || globalJson) {
      if (hasRazor) return '.NET Core/Framework (C# + Razor)';
      if (files.some(f => f.path.includes('Controllers'))) return 'ASP.NET MVC (C#)';
      if (files.some(f => f.path.includes('Pages'))) return 'ASP.NET Core (C#)';
      if (csprojFiles.length > 1) return '.NET Solution (Multiple Projects)';
      console.log(`🏢 Detected .NET/C# framework`);
      return '.NET (C#)';
    }

    // Java frameworks
    const pomXml = files.find(f => f.name === 'pom.xml');
    const buildGradle = files.find(f => f.name === 'build.gradle' || f.name === 'build.gradle.kts');
    const hasJava = files.some(f => f.name.endsWith('.java'));
    
    if (pomXml || buildGradle || hasJava) {
      let javaContent = '';
      if (pomXml) javaContent += pomXml.content.toLowerCase();
      if (buildGradle) javaContent += buildGradle.content.toLowerCase();
      
      if (javaContent.includes('spring-boot')) return 'Spring Boot (Java)';
      if (javaContent.includes('spring-mvc') || javaContent.includes('springframework')) return 'Spring Framework (Java)';
      if (javaContent.includes('hibernate')) return 'Java + Hibernate';
      if (javaContent.includes('struts')) return 'Apache Struts (Java)';
      if (javaContent.includes('android')) return 'Android (Java/Kotlin)';
      console.log(`☕ Detected Java framework`);
      return 'Java Enterprise';
    }

    // PHP frameworks
    const composerJson = files.find(f => f.name === 'composer.json');
    const hasPhp = files.some(f => f.name.endsWith('.php'));
    const hasBlade = files.some(f => f.name.endsWith('.blade.php'));
    
    if (composerJson?.content) {
      try {
        const composer = JSON.parse(composerJson.content);
        const deps = { ...composer.require, ...composer['require-dev'] };
        
        if (deps['laravel/framework']) return 'Laravel (PHP)';
        if (deps['symfony/symfony'] || deps['symfony/framework-bundle']) return 'Symfony (PHP)';
        if (deps['codeigniter/framework']) return 'CodeIgniter (PHP)';
        if (deps['cakephp/cakephp']) return 'CakePHP';
        if (deps['zendframework/zend-mvc']) return 'Zend Framework (PHP)';
        console.log(`🐘 Detected PHP framework from composer.json`);
      } catch (e) {
        console.warn('Failed to parse composer.json:', e);
      }
    }
    if (hasPhp) {
      if (hasBlade) return 'Laravel (PHP + Blade)';
      if (files.some(f => f.name === 'index.php')) return 'PHP Application';
    }

    // Ruby frameworks
    const gemfile = files.find(f => f.name === 'Gemfile');
    const hasRuby = files.some(f => f.name.endsWith('.rb'));
    const hasErb = files.some(f => f.name.endsWith('.erb'));
    
    if (gemfile?.content) {
      const content = gemfile.content.toLowerCase();
      if (content.includes('rails')) return 'Ruby on Rails';
      if (content.includes('sinatra')) return 'Sinatra (Ruby)';
      if (content.includes('hanami')) return 'Hanami (Ruby)';
      console.log(`💎 Detected Ruby framework`);
    }
    if (hasRuby && hasErb) return 'Ruby on Rails (ERB)';

    // Go frameworks
    const goMod = files.find(f => f.name === 'go.mod');
    const hasGo = files.some(f => f.name.endsWith('.go'));
    
    if (goMod?.content) {
      const content = goMod.content.toLowerCase();
      if (content.includes('gin-gonic/gin')) return 'Gin Framework (Go)';
      if (content.includes('gorilla/mux')) return 'Gorilla Mux (Go)';
      if (content.includes('echo')) return 'Echo Framework (Go)';
      if (content.includes('fiber')) return 'Fiber (Go)';
      console.log(`🐹 Detected Go framework`);
    }
    if (hasGo) return 'Go Application';

    // Rust frameworks
    const cargoToml = files.find(f => f.name === 'Cargo.toml');
    if (cargoToml?.content) {
      const content = cargoToml.content.toLowerCase();
      if (content.includes('actix-web')) return 'Actix Web (Rust)';
      if (content.includes('warp')) return 'Warp (Rust)';
      if (content.includes('rocket')) return 'Rocket (Rust)';
      console.log(`🦀 Detected Rust framework`);
      return 'Rust Application';
    }

    // Mobile frameworks
    const pubspecYaml = files.find(f => f.name === 'pubspec.yaml');
    if (pubspecYaml) return 'Flutter (Dart)';
    
    const hasSwift = files.some(f => f.name.endsWith('.swift'));
    const hasXcode = files.some(f => f.path.includes('.xcodeproj'));
    if (hasSwift || hasXcode) return 'iOS (Swift/Objective-C)';
    
    const hasKotlin = files.some(f => f.name.endsWith('.kt'));
    const androidManifest = files.find(f => f.name === 'AndroidManifest.xml');
    if (hasKotlin || androidManifest) return 'Android (Kotlin/Java)';

    // PRIORITY 2: File-based detection (fallback)
    const fileStats = {
      vue: files.filter(f => f.name.endsWith('.vue')).length,
      react: files.filter(f => f.name.endsWith('.tsx') || f.name.endsWith('.jsx')).length,
      angular: files.filter(f => f.name.includes('component.ts') || f.name.includes('.module.ts')).length,
      svelte: files.filter(f => f.name.endsWith('.svelte')).length,
      php: files.filter(f => f.name.endsWith('.php')).length,
      python: files.filter(f => f.name.endsWith('.py')).length,
      java: files.filter(f => f.name.endsWith('.java')).length,
      ruby: files.filter(f => f.name.endsWith('.rb')).length,
      go: files.filter(f => f.name.endsWith('.go')).length,
      csharp: files.filter(f => f.name.endsWith('.cs')).length,
      typescript: files.filter(f => f.name.endsWith('.ts')).length,
      javascript: files.filter(f => f.name.endsWith('.js')).length,
      html: files.filter(f => f.name.endsWith('.html')).length
    };

    // Find most dominant file type
    const dominantType = Object.entries(fileStats)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)[0];

    if (dominantType) {
      const [type, count] = dominantType;
      console.log(`📁 File-based detection: ${type} (${count} files)`);
      
      switch (type) {
        case 'vue': return 'Vue.js';
        case 'react': return 'React';
        case 'angular': return 'Angular';
        case 'svelte': return 'Svelte';
        case 'php': return 'PHP Application';
        case 'python': return 'Python Application';
        case 'java': return 'Java Application';
        case 'ruby': return 'Ruby Application';
        case 'go': return 'Go Application';
        case 'csharp': return '.NET (C#)';
        case 'typescript': return 'TypeScript Application';
        case 'javascript': return 'JavaScript Application';
        case 'html': return 'Static HTML/CSS';
      }
    }

    // PRIORITY 3: Unknown/Mixed projects
    const totalFiles = files.length;
    if (totalFiles > 1000) {
      console.log(`🏢 Large project detected (${totalFiles} files) - likely enterprise/monorepo`);
      return 'Enterprise Multi-Technology Project';
    }
    
    if (files.some(f => f.name.endsWith('.html'))) return 'HTML/Static Website';
    
    console.log(`❓ Framework detection uncertain - multi-technology project`);
    return 'Multi-Technology Project';
  }

  /**
   * Discover pages and routes from the project structure
   */
  private discoverPages(files: FileInfo[], framework: string): Array<{
    path: string;
    title: string;
    components: string[];
    routes: string[];
  }> {
    const pages: Array<{
      path: string;
      title: string;
      components: string[];
      routes: string[];
    }> = [];

    for (const file of files) {
      if (!file.content) continue;

      let isPageFile = false;
      let routes: string[] = [];
      
      // Framework-specific route detection
      if (framework === 'React' || framework === 'Next.js') {
        // React Router patterns
        if (file.content.includes('Route') && file.content.includes('path=')) {
          const routeMatches = file.content.match(/path=["']([^"']+)["']/g);
          routes = routeMatches?.map(match => match.replace(/path=["']([^"']+)["']/, '$1')) || [];
          isPageFile = true;
        }
        
        // Next.js file-based routing
        if (file.path.includes('pages/') || file.path.includes('app/')) {
          const routePath = file.path
            .replace(/^.*?(pages|app)\//, '/')
            .replace(/\.[^.]+$/, '')
            .replace(/\/index$/, '');
          routes = [routePath === '' ? '/' : routePath];
          isPageFile = true;
        }
      } else if (framework === 'Vue.js') {
        // Vue Router patterns
        if (file.content.includes('router') && file.content.includes('path:')) {
          const routeMatches = file.content.match(/path:\s*["']([^"']+)["']/g);
          routes = routeMatches?.map(match => match.replace(/path:\s*["']([^"']+)["']/, '$1')) || [];
          isPageFile = true;
        }
      } else if (framework === 'HTML/Static') {
        // HTML files are pages
        if (file.name.endsWith('.html')) {
          const routeName = file.name.replace('.html', '');
          routes = [routeName === 'index' ? '/' : '/' + routeName];
          isPageFile = true;
        }
      }

      if (isPageFile) {
        // Extract title
        const titleMatch = file.content.match(/<title>([^<]+)<\/title>/i) ||
                         file.content.match(/title:\s*["']([^"']+)["']/);
        const title = titleMatch?.[1] || file.name.replace(/\.[^.]+$/, '');

        // Extract component references
        const components = this.extractComponentReferences(file.content, framework);

        pages.push({
          path: file.path,
          title,
          components,
          routes
        });
      }
    }

    return pages;
  }

  /**
   * Extract component references from file content
   */
  private extractComponentReferences(content: string, framework: string): string[] {
    const components: string[] = [];

    if (framework === 'React' || framework === 'Next.js') {
      // Extract JSX component usage: <ComponentName />
      const jsxMatches = content.match(/<[A-Z][a-zA-Z0-9]*\s*[^>]*\/?>/g);
      if (jsxMatches) {
        components.push(...jsxMatches.map(match => 
          match.replace(/<([A-Z][a-zA-Z0-9]*)\s*[^>]*\/?>/g, '$1')
        ));
      }
    } else if (framework === 'Vue.js') {
      // Extract Vue component usage
      const vueMatches = content.match(/<[a-zA-Z][a-zA-Z0-9-]*\s*[^>]*\/?>/g);
      if (vueMatches) {
        components.push(...vueMatches.map(match => 
          match.replace(/<([a-zA-Z][a-zA-Z0-9-]*)\s*[^>]*\/?>/g, '$1')
        ));
      }
    }

    return [...new Set(components)]; // Remove duplicates
  }

  /**
   * Extract URLs and endpoints from the project
   */
  private extractUrls(files: FileInfo[], pages: any[], framework: string): Array<{
    url: string;
    title?: string;
    description?: string;
    source: string;
  }> {
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
      'Svelte': 5000,
      'HTML/Static': 3000
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

    // Add default route if no routes discovered
    if (urls.length === 0) {
      urls.push({
        url: baseUrl,
        title: 'Home Page',
        description: 'Main application page',
        source: 'default'
      });
    }

    // Extract API endpoints from code
    files.forEach(file => {
      if (file.content) {
        // Find API endpoints in various formats
        const apiPatterns = [
          /fetch\(['"]([^'"]*\/api\/[^'"]+)['"]/g,  // fetch("/api/endpoint")
          /axios\.[a-z]+\(['"]([^'"]*\/api\/[^'"]+)['"]/g,  // axios.get("/api/endpoint")
        ];

        apiPatterns.forEach(pattern => {
          const matches = file.content.match(pattern);
          if (matches) {
            matches.forEach(match => {
              let endpoint = match.replace(/['"]/g, '');
              if (endpoint.startsWith('/api/')) {
                urls.push({
                  url: baseUrl + endpoint,
                  title: 'API Endpoint',
                  description: `API: ${endpoint}`,
                  source: 'api'
                });
              }
            });
          }
        });
      }
    });

    return urls;
  }

  /**
   * Analyze UI elements from project files
   */
  private analyzeElements(files: FileInfo[], framework: string): Array<{
    selector: string;
    elementType: 'button' | 'input' | 'link' | 'form' | 'navigation' | 'text';
    description: string;
    attributes: Record<string, any>;
    confidence: number;
    source: string;
  }> {
    const elements: Array<{
      selector: string;
      elementType: 'button' | 'input' | 'link' | 'form' | 'navigation' | 'text';
      description: string;
      attributes: Record<string, any>;
      confidence: number;
      source: string;
    }> = [];

    for (const file of files) {
      if (!file.content) continue;
      
      const fileElements = this.extractElementsFromFile(file, framework);
      elements.push(...fileElements);
    }

    return elements;
  }

  /**
   * Extract UI elements from a specific file
   */
  private extractElementsFromFile(file: FileInfo, framework: string): Array<{
    selector: string;
    elementType: 'button' | 'input' | 'link' | 'form' | 'navigation' | 'text';
    description: string;
    attributes: Record<string, any>;
    confidence: number;
    source: string;
  }> {
    const elements: Array<{
      selector: string;
      elementType: 'button' | 'input' | 'link' | 'form' | 'navigation' | 'text';
      description: string;
      attributes: Record<string, any>;
      confidence: number;
      source: string;
    }> = [];
    
    const content = file.content;

    if (framework === 'React' || framework === 'Next.js') {
      // JSX element patterns
      const jsxElementRegex = /<(button|input|textarea|select|a|form|div|span)([^>]*?)(?:\/>|>[^<]*<\/\1>)/gi;
      let match;

      while ((match = jsxElementRegex.exec(content)) !== null) {
        const [fullMatch, tagName, attributes] = match;
        
        // Extract meaningful attributes
        const testId = this.extractAttribute(attributes, 'data-testid');
        const className = this.extractAttribute(attributes, 'className');
        const id = this.extractAttribute(attributes, 'id');
        const placeholder = this.extractAttribute(attributes, 'placeholder');
        const ariaLabel = this.extractAttribute(attributes, 'aria-label');
        const type = this.extractAttribute(attributes, 'type');
        
        // Generate selector with confidence scoring
        const selectorInfo = this.generateSelector(tagName, id, testId, className);
        
        // Generate description
        const description = ariaLabel || placeholder || testId || `${tagName} element`;

        elements.push({
          selector: selectorInfo.selector,
          elementType: this.mapElementType(tagName, type),
          description,
          attributes: {
            text: placeholder || ariaLabel || '',
            id,
            className,
            'data-testid': testId,
            'aria-label': ariaLabel,
            placeholder,
            type,
            tagName: tagName.toLowerCase(),
            sourceFile: file.path
          },
          confidence: selectorInfo.confidence,
          source: 'source-code-analysis'
        });
      }
    } else if (framework.includes('PHP') || framework === 'Laravel (PHP)') {
      // PHP template files (Blade, Twig, plain PHP with HTML)
      const phpHtmlRegex = /<(button|input|textarea|select|a|form|div|span)([^>]*?)(?:\/>|>[^<]*<\/\1>)/gi;
      let match;

      while ((match = phpHtmlRegex.exec(content)) !== null) {
        const [fullMatch, tagName, attributes] = match;
        
        // Extract attributes (similar to HTML but may contain PHP variables)
        const id = this.extractAttribute(attributes, 'id');
        const className = this.extractAttribute(attributes, 'class');
        const placeholder = this.extractAttribute(attributes, 'placeholder');
        const ariaLabel = this.extractAttribute(attributes, 'aria-label');
        const type = this.extractAttribute(attributes, 'type');
        const name = this.extractAttribute(attributes, 'name');
        
        // Generate selector
        const selectorInfo = this.generateSelector(tagName, id, null, className);
        
        // Generate description
        const description = ariaLabel || placeholder || name || id || `${tagName} element`;

        elements.push({
          selector: selectorInfo.selector,
          elementType: this.mapElementType(tagName, type),
          description,
          attributes: {
            text: placeholder || ariaLabel || '',
            id,
            class: className,
            'aria-label': ariaLabel,
            placeholder,
            type,
            name,
            tagName: tagName.toLowerCase(),
            sourceFile: file.path
          },
          confidence: selectorInfo.confidence,
          source: 'php-template-analysis'
        });
      }
    } else if (framework.includes('Python') || framework === 'Django (Python)' || framework === 'Flask (Python)') {
      // Django/Flask templates (Jinja2, Django templates)
      const pythonTemplateRegex = /<(button|input|textarea|select|a|form|div|span)([^>]*?)(?:\/>|>[^<]*<\/\1>)/gi;
      let match;

      while ((match = pythonTemplateRegex.exec(content)) !== null) {
        const [fullMatch, tagName, attributes] = match;
        
        // Extract attributes
        const id = this.extractAttribute(attributes, 'id');
        const className = this.extractAttribute(attributes, 'class');
        const placeholder = this.extractAttribute(attributes, 'placeholder');
        const ariaLabel = this.extractAttribute(attributes, 'aria-label');
        const type = this.extractAttribute(attributes, 'type');
        const name = this.extractAttribute(attributes, 'name');
        
        // Generate selector
        const selectorInfo = this.generateSelector(tagName, id, null, className);
        
        // Generate description
        const description = ariaLabel || placeholder || name || id || `${tagName} element`;

        elements.push({
          selector: selectorInfo.selector,
          elementType: this.mapElementType(tagName, type),
          description,
          attributes: {
            text: placeholder || ariaLabel || '',
            id,
            class: className,
            'aria-label': ariaLabel,
            placeholder,
            type,
            name,
            tagName: tagName.toLowerCase(),
            sourceFile: file.path
          },
          confidence: selectorInfo.confidence,
          source: 'python-template-analysis'
        });
      }
    } else if (framework === 'HTML/Static') {
      // HTML element patterns
      const htmlElementRegex = /<(button|input|textarea|select|a|form|div|span)([^>]*?)(?:\/>|>[^<]*<\/\1>)/gi;
      let match;

      while ((match = htmlElementRegex.exec(content)) !== null) {
        const [fullMatch, tagName, attributes] = match;
        
        // Extract attributes
        const id = this.extractAttribute(attributes, 'id');
        const className = this.extractAttribute(attributes, 'class');
        const placeholder = this.extractAttribute(attributes, 'placeholder');
        const ariaLabel = this.extractAttribute(attributes, 'aria-label');
        const type = this.extractAttribute(attributes, 'type');
        
        // Generate selector
        const selectorInfo = this.generateSelector(tagName, id, null, className);
        
        // Generate description
        const description = ariaLabel || placeholder || id || `${tagName} element`;

        elements.push({
          selector: selectorInfo.selector,
          elementType: this.mapElementType(tagName, type),
          description,
          attributes: {
            text: placeholder || ariaLabel || '',
            id,
            class: className,
            'aria-label': ariaLabel,
            placeholder,
            type,
            tagName: tagName.toLowerCase(),
            sourceFile: file.path
          },
          confidence: selectorInfo.confidence,
          source: 'source-code-analysis'
        });
      }
    }

    // Fallback: Universal HTML element detection for any file containing HTML-like content
    if (elements.length === 0 && content.includes('<') && content.includes('>')) {
      console.log(`🔄 Running fallback HTML analysis for ${file.name}`);
      const universalHtmlRegex = /<(button|input|textarea|select|a|form|div|span|h[1-6]|p|img)([^>]*?)(?:\/>|>[^<]*<\/\1>)/gi;
      let match;

      while ((match = universalHtmlRegex.exec(content)) !== null) {
        const [fullMatch, tagName, attributes] = match;
        
        // Extract any available attributes
        const id = this.extractAttribute(attributes, 'id');
        const className = this.extractAttribute(attributes, 'class') || this.extractAttribute(attributes, 'className');
        const placeholder = this.extractAttribute(attributes, 'placeholder');
        const ariaLabel = this.extractAttribute(attributes, 'aria-label');
        const type = this.extractAttribute(attributes, 'type');
        const name = this.extractAttribute(attributes, 'name');
        const dataTestId = this.extractAttribute(attributes, 'data-testid') || this.extractAttribute(attributes, 'data-test');
        
        // Skip if no meaningful identifiers
        if (!id && !className && !name && !dataTestId && !placeholder && !ariaLabel) {
          continue;
        }
        
        // Generate selector
        const selectorInfo = this.generateSelector(tagName, id, dataTestId, className);
        
        // Generate description
        const description = ariaLabel || placeholder || name || dataTestId || id || `${tagName} element in ${file.name}`;

        elements.push({
          selector: selectorInfo.selector,
          elementType: this.mapElementType(tagName, type),
          description,
          attributes: {
            text: placeholder || ariaLabel || '',
            id,
            class: className,
            className,
            'aria-label': ariaLabel,
            placeholder,
            type,
            name,
            'data-testid': dataTestId,
            tagName: tagName.toLowerCase(),
            sourceFile: file.path
          },
          confidence: Math.max(selectorInfo.confidence - 10, 40), // Lower confidence for fallback
          source: 'universal-html-analysis'
        });
      }
    }

    return elements;
  }

  /**
   * Extract attribute value from HTML/JSX attributes string
   */
  private extractAttribute(attributesStr: string, attributeName: string): string | undefined {
    const regex = new RegExp(`${attributeName}=["']([^"']+)["']`);
    const match = attributesStr.match(regex);
    return match?.[1];
  }

  /**
   * Generate optimal CSS selector with confidence score
   */
  private generateSelector(tagName: string, id?: string, testId?: string, className?: string): {
    selector: string;
    confidence: number;
  } {
    let selector = tagName.toLowerCase();
    let confidence = 0.3; // Base confidence for tag selector

    // Priority: testId > id > className > tag
    if (testId) {
      selector = `[data-testid="${testId}"]`;
      confidence = 0.95;
    } else if (id) {
      selector = `#${id}`;
      confidence = 0.85;
    } else if (className) {
      const firstClass = className.split(' ')[0];
      selector = `.${firstClass}`;
      confidence = 0.65;
    }

    return { selector, confidence };
  }

  /**
   * Map HTML tag to element type enum
   */
  private mapElementType(tagName: string, type?: string): 'button' | 'input' | 'link' | 'form' | 'navigation' | 'text' {
    const tag = tagName.toLowerCase();
    
    switch (tag) {
      case 'button':
        return 'button';
      case 'input':
        if (type === 'submit' || type === 'button') return 'button';
        return 'input';
      case 'textarea':
      case 'select':
        return 'input';
      case 'a':
        return 'link';
      case 'form':
        return 'form';
      case 'nav':
        return 'navigation';
      default:
        return 'text';
    }
  }

  /**
   * Generate analysis statistics
   */
  private generateStatistics(files: FileInfo[], pages: any[], elements: any[]) {
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
  }
}