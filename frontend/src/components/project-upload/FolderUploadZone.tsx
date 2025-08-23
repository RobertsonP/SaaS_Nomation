import { useState, useCallback, useRef, useEffect } from 'react';

interface FileInfo {
  name: string;
  path: string;
  size: number;
  type: string;
  content?: string;
}

interface FolderUploadZoneProps {
  onFolderUploaded: (files: FileInfo[]) => void;
  onAnalysisStart?: () => void;
  acceptedFileTypes?: string[];
  maxFileSize?: number; // in MB
  className?: string;
}

export function FolderUploadZone({
  onFolderUploaded,
  onAnalysisStart,
  acceptedFileTypes = [
    // Web Frontend & JavaScript
    '.html', '.htm', '.tsx', '.jsx', '.vue', '.js', '.ts', '.mjs', '.cjs', '.json', '.json5',
    '.css', '.scss', '.sass', '.less', '.stylus', '.svelte', '.astro', '.lit', '.stencil',
    
    // Backend Programming Languages  
    '.py', '.pyx', '.pyi', '.pyc',           // Python
    '.php', '.phtml', '.php3', '.php4', '.php5', '.php7', '.php8', // PHP
    '.java', '.jsp', '.jspx', '.tag', '.tagx', // Java
    '.cs', '.cshtml', '.razor', '.vb', '.vbhtml', // C#/.NET
    '.rb', '.erb', '.haml', '.slim',         // Ruby
    '.go', '.mod', '.sum',                   // Go
    '.rs', '.toml',                          // Rust
    '.cpp', '.c', '.cc', '.cxx', '.h', '.hpp', // C/C++
    '.swift', '.m', '.mm', '.xib', '.storyboard', // Swift/Objective-C
    '.kt', '.kts',                           // Kotlin
    '.scala', '.sc',                         // Scala
    '.clj', '.cljs', '.cljc', '.edn',       // Clojure
    '.pl', '.pm', '.t',                      // Perl
    '.lua',                                  // Lua
    '.r', '.R',                              // R
    '.jl',                                   // Julia
    '.elm',                                  // Elm
    '.ex', '.exs',                           // Elixir
    '.erl', '.hrl',                          // Erlang
    '.fs', '.fsx', '.fsi',                   // F#
    '.hs', '.lhs',                           // Haskell
    '.ml', '.mli',                           // OCaml
    '.pas', '.pp',                           // Pascal
    '.dart',                                 // Dart (Flutter)
    
    // Configuration & Build Files
    '.xml', '.yml', '.yaml', '.ini', '.env', '.config', '.conf', '.cfg',
    '.dockerfile', '.dockerignore', '.gitignore', '.gitattributes',
    '.editorconfig', '.eslintrc', '.prettierrc', '.babelrc', '.nvmrc',
    '.htaccess', '.nginx', '.apache2',
    
    // Templates & Views
    '.ejs', '.hbs', '.handlebars', '.mustache', '.pug', '.jade',
    '.twig', '.blade.php', '.smarty.tpl',
    '.jinja2', '.j2', '.html.j2',
    '.liquid',
    
    // Database & Data Files
    '.sql', '.ddl', '.dml', '.sqlite', '.sqlite3', '.db',
    '.csv', '.tsv', '.xlsx', '.xls', '.ods',
    '.jsonl', '.ndjson', '.geojson',
    '.xsd', '.xsl', '.xslt',
    
    // DevOps & Infrastructure
    '.tf', '.tfvars', '.hcl',
    '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
    
    // Project Files (All IDEs/Platforms)
    '.csproj', '.vbproj', '.fsproj', '.sln', '.suo',
    '.xcodeproj', '.xcworkspace', '.pbxproj',
    '.idea', '.vscode', '.sublime-project', '.sublime-workspace',
    
    // Documentation & API Specs
    '.md', '.rst', '.txt', '.adoc', '.org',
    '.proto', '.graphql', '.gql',
    '.wsdl', '.wadl', '.raml', '.swagger',
    '.thrift', '.avro',
    
    // Specific Package/Config Files
    'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    'composer.json', 'composer.lock',
    'requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile', 'Pipfile.lock', 'poetry.lock',
    'pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle',
    'Gemfile', 'Gemfile.lock', '.ruby-version',
    'go.mod', 'go.sum',
    'Cargo.toml', 'Cargo.lock',
    'pubspec.yaml', 'pubspec.lock',
    'mix.exs', 'mix.lock',
    'dune', 'dune-project', 'opam',
    'stack.yaml', 'package.yaml', 'cabal.config',
    'sbt', 'build.sbt', 'project/build.properties',
    'global.json', 'nuget.config',
    'tsconfig.json', 'jsconfig.json', 'webpack.config.js',
    'rollup.config.js', 'vite.config.js', 'next.config.js',
    'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
    'Makefile', 'CMakeLists.txt', 'meson.build', 'SConstruct',
    'Jenkinsfile', '.gitlab-ci.yml', '.travis.yml', '.circleci'
  ],
  maxFileSize = 10, // 10MB
  className = ''
}: FolderUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processedFiles, setProcessedFiles] = useState<FileInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [isEnterpriseProject, setIsEnterpriseProject] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ENTERPRISE PROCESSING STAGES - for large projects (400MB+)
  const enterpriseStages = [
    'Reading project files...',
    'Analyzing project structure...',
    'Detecting framework and technology...',
    'Extracting UI elements...',
    'Processing large assets and dependencies...',
    'Building comprehensive element database...',
    'Optimizing for test automation...',
    'Finalizing enterprise analysis...'
  ];

  // Enterprise progress tracking for large uploads
  useEffect(() => {
    let stageInterval: NodeJS.Timeout;
    let stageIndex = 0;

    if (isProcessing && isEnterpriseProject) {
      // Update processing stage every 10-15 seconds for large projects
      const updateInterval = Math.random() * 5000 + 10000; // 10-15 seconds
      
      stageInterval = setInterval(() => {
        stageIndex = (stageIndex + 1) % enterpriseStages.length;
        setProcessingStage(enterpriseStages[stageIndex]);
      }, updateInterval);
    }

    return () => {
      if (stageInterval) clearInterval(stageInterval);
    };
  }, [isProcessing, isEnterpriseProject]);

  // Convert bytes to readable format
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Check if file type is accepted
  const isFileTypeAccepted = (fileName: string) => {
    const lowerFileName = fileName.toLowerCase();
    
    // Check for exact filename matches (like package.json)
    if (acceptedFileTypes.includes(lowerFileName)) {
      return true;
    }
    
    // Check for extension matches
    const extension = '.' + fileName.split('.').pop()?.toLowerCase();
    if (acceptedFileTypes.includes(extension)) {
      return true;
    }
    
    // Special cases for files without extensions or complex extensions
    if (lowerFileName.includes('dockerfile')) return true;
    if (lowerFileName.includes('makefile')) return true;
    if (lowerFileName.endsWith('.blade.php')) return true;
    
    return false;
  };

  // Process uploaded files
  const processFiles = useCallback(async (fileList: FileList) => {
    setIsProcessing(true);
    setError(null);
    setUploadProgress(0);
    setProcessingStage('');
    onAnalysisStart?.();

    // Calculate total size to detect enterprise projects
    const totalSize = Array.from(fileList).reduce((sum, file) => sum + file.size, 0);
    const sizeMB = Math.round(totalSize / (1024 * 1024));
    const isEnterprise = sizeMB > 50 || fileList.length > 1000; // 50MB+ or 1000+ files
    
    setIsEnterpriseProject(isEnterprise);
    
    if (isEnterprise) {
      console.log(`🏢 Enterprise project detected: ${sizeMB}MB, ${fileList.length} files`);
      setProcessingStage('Preparing enterprise project analysis...');
    }

    const processedFiles: FileInfo[] = [];
    const totalFiles = fileList.length;
    let processedCount = 0;

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        
        // Skip if file type not accepted
        if (!isFileTypeAccepted(file.name)) {
          processedCount++;
          setUploadProgress((processedCount / totalFiles) * 100);
          continue;
        }

        // Check file size
        if (file.size > maxFileSize * 1024 * 1024) {
          console.warn(`File ${file.name} is too large (${formatFileSize(file.size)})`);
          processedCount++;
          setUploadProgress((processedCount / totalFiles) * 100);
          continue;
        }

        try {
          // Read file content for text files
          const content = await readFileContent(file);
          
          const fileInfo: FileInfo = {
            name: file.name,
            path: (file as any).webkitRelativePath || file.name,
            size: file.size,
            type: file.type || 'unknown',
            content: content
          };

          processedFiles.push(fileInfo);
        } catch (err) {
          console.error(`Error processing file ${file.name}:`, err);
        }

        processedCount++;
        setUploadProgress((processedCount / totalFiles) * 100);
      }

      setProcessedFiles(processedFiles);
      
      if (processedFiles.length === 0) {
        const totalFiles = fileList.length;
        const rejectedTypes = Array.from(fileList)
          .map(file => '.' + file.name.split('.').pop()?.toLowerCase())
          .filter((ext, index, arr) => arr.indexOf(ext) === index)
          .slice(0, 10); // Show first 10 unique types
          
        setError(`No supported files found in your upload. 
        
📁 You uploaded ${totalFiles} files, but none match our supported types.
🚫 Found file types: ${rejectedTypes.join(', ')}${rejectedTypes.length >= 10 ? '...' : ''}

💡 Try uploading a folder containing source code files like:
• Web: .html, .js, .tsx, .vue, .css
• Backend: .php, .py, .java, .rb, .go
• Config: .json, .yml, package.json
• Or any programming project files`);
      } else {
        onFolderUploaded(processedFiles);
      }

    } catch (err) {
      setError('Failed to process uploaded files. Please try again.');
      console.error('File processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [acceptedFileTypes, maxFileSize, onFolderUploaded, onAnalysisStart]);

  // Read file content as text
  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        resolve(e.target?.result as string || '');
      };
      
      reader.onerror = () => {
        reject(new Error(`Failed to read file: ${file.name}`));
      };
      
      reader.readAsText(file);
    });
  };

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  // Handle folder selection via input
  const handleFolderSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  const triggerFolderSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`folder-upload-zone ${className}`}>
      {/* Hidden file input for folder selection */}
      <input
        ref={fileInputRef}
        type="file"
        // @ts-ignore - webkitdirectory is not in React types but is supported
        webkitdirectory=""
        multiple
        onChange={handleFolderSelect}
        className="hidden"
        accept={acceptedFileTypes.join(',')}
      />

      {/* Drag & Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={triggerFolderSelect}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
          ${isDragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100'
          }
          ${isProcessing ? 'cursor-wait' : 'cursor-pointer'}
        `}
      >
        {isProcessing ? (
          /* ENTERPRISE PROCESSING STATE */
          <div className="space-y-6">
            <div className="text-4xl">
              {isEnterpriseProject ? '🏗️' : '⚙️'}
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">
                {isEnterpriseProject 
                  ? 'Processing Enterprise Project...' 
                  : 'Processing Project Files...'
                }
              </h3>
              <p className="text-sm text-gray-600">
                {processingStage || 
                 `Analyzing ${processedFiles.length} files for test automation`
                }
              </p>
              
              {/* ENHANCED PROGRESS BAR */}
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-1000 ${
                    isEnterpriseProject 
                      ? 'bg-gradient-to-r from-blue-500 to-green-500' 
                      : 'bg-blue-600'
                  }`}
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              
              {/* ENTERPRISE STATS GRID */}
              <div className="grid grid-cols-3 gap-4 text-xs text-gray-600 mt-4">
                <div>
                  📊 {processedFiles.length} files
                </div>
                <div>
                  ⚙️ {Math.round(uploadProgress)}% done
                </div>
                <div>
                  {isEnterpriseProject ? '🏢 Enterprise mode' : '🚀 Standard mode'}
                </div>
              </div>
              
              {/* ENTERPRISE TIME ESTIMATE */}
              {isEnterpriseProject && (
                <div className="text-xs text-gray-500 text-center mt-2">
                  ⏱️ Large enterprise projects may take 2-15 minutes to analyze
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Upload State */
          <div className="space-y-4">
            <div className="text-6xl">
              {isDragOver ? '📂' : '🗂️'}
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-gray-900">
                {isDragOver ? 'Drop Your Project Folder' : 'Upload Project Folder'}
              </h3>
              <p className="text-gray-600">
                {isDragOver 
                  ? 'Release to analyze your project files' 
                  : 'Drag & drop your project folder here or click to browse'
                }
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={triggerFolderSelect}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                📁 Select Project Folder
              </button>
              
              <div className="text-xs text-gray-500">
                <div className="font-medium mb-1">Supports All Programming Languages:</div>
                <div className="text-center">
                  <div className="mb-2">
                    <span className="text-blue-600 font-medium">Web:</span> React, Vue, Angular, HTML, CSS, JS/TS
                  </div>
                  <div className="mb-2">
                    <span className="text-green-600 font-medium">Backend:</span> Python, Java, C#, PHP, Ruby, Go, Rust
                  </div>
                  <div className="mb-2">
                    <span className="text-purple-600 font-medium">Mobile:</span> Flutter, iOS (Swift), Android (Kotlin)
                  </div>
                  <div className="text-gray-400 italic">+ 100+ more file types supported</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="text-red-500 text-xl">⚠️</div>
            <div>
              <div className="font-medium text-red-800 mb-1">Upload Error</div>
              <div className="text-red-700 text-sm">{error}</div>
              <button
                onClick={() => setError(null)}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Summary */}
      {processedFiles.length > 0 && !isProcessing && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="text-green-500 text-xl">✅</div>
            <div className="flex-1">
              <div className="font-medium text-green-800 mb-1">
                Successfully Processed Project
              </div>
              <div className="text-green-700 text-sm mb-3">
                Found {processedFiles.length} supported files ready for analysis
              </div>
              
              {/* File Summary */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="font-medium">Total Files:</span> {processedFiles.length}
                  </div>
                  <div>
                    <span className="font-medium">Total Size:</span>{' '}
                    {formatFileSize(processedFiles.reduce((sum, file) => sum + file.size, 0))}
                  </div>
                </div>
                
                {/* File Types Summary */}
                <div className="text-xs">
                  <span className="font-medium">File Types:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(
                      processedFiles.reduce((acc: Record<string, number>, file) => {
                        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
                        acc[ext] = (acc[ext] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([ext, count], index) => (
                      <span key={`${ext}-${index}`} className="px-2 py-1 bg-green-100 rounded text-xs">
                        {ext} ({count})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}