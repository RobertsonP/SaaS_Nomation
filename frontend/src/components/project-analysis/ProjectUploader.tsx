import { useState, useCallback, useRef } from 'react'

// Interface kept for future use in enhanced file analysis
// interface ProjectFile {
//   name: string
//   path: string
//   content: string
//   type: 'component' | 'page' | 'template' | 'test' | 'config' | 'other'
//   framework?: 'react' | 'vue' | 'angular' | 'unknown'
// }

interface ProjectAnalysis {
  framework: 'react' | 'vue' | 'angular' | 'mixed' | 'unknown'
  components: Array<{
    name: string
    filePath: string
    elements: Array<{
      type: string
      selector: string
      text?: string
      placeholder?: string
      action?: string
      description: string
    }>
  }>
  totalFiles: number
  processedFiles: number
  errors: string[]
}

interface ProjectUploaderProps {
  onAnalysisComplete: (analysis: ProjectAnalysis) => void
  onAnalysisProgress: (progress: { current: number; total: number; message: string }) => void
}

export function ProjectUploader({ onAnalysisComplete, onAnalysisProgress }: ProjectUploaderProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState({ current: 0, total: 0, message: '' })
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [lastFailedFiles, setLastFailedFiles] = useState<File[]>([])

  // File validation
  const isValidFile = (file: File): boolean => {
    const validExtensions = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.html', '.json', '.md']
    const fileName = file.name.toLowerCase()
    
    // Skip common unwanted files
    const skipPatterns = [
      'node_modules/', '.git/', 'dist/', 'build/', '.next/',
      'coverage/', '.vscode/', '.idea/', 'package-lock.json'
    ]
    
    const shouldSkip = skipPatterns.some(pattern => 
      file.webkitRelativePath?.toLowerCase().includes(pattern) ||
      fileName.includes(pattern)
    )
    
    if (shouldSkip) return false
    
    return validExtensions.some(ext => fileName.endsWith(ext))
  }

  // Framework detection
  const detectFramework = (files: File[]): 'react' | 'vue' | 'angular' | 'mixed' | 'unknown' => {
    const hasReact = files.some(f => f.name.includes('.jsx') || f.name.includes('.tsx') || f.name.includes('react'))
    const hasVue = files.some(f => f.name.includes('.vue'))
    const hasAngular = files.some(f => f.name.includes('angular') || f.name.includes('component.ts'))
    
    const frameworkCount = [hasReact, hasVue, hasAngular].filter(Boolean).length
    
    if (frameworkCount > 1) return 'mixed'
    if (hasReact) return 'react'
    if (hasVue) return 'vue'
    if (hasAngular) return 'angular'
    return 'unknown'
  }

  // React component analysis
  const analyzeReactComponent = (content: string, _filePath: string) => {
    const elements: any[] = []
    
    // Match JSX elements with common patterns
    const jsxPatterns = [
      // Buttons with onClick
      /<button[^>]*onClick[^>]*>(.*?)<\/button>/gi,
      // Inputs with various props
      /<input[^>]*(?:type|placeholder|name|id)[^>]*\/?>/gi,
      // Forms
      /<form[^>]*onSubmit[^>]*>/gi,
      // Links
      /<a[^>]*href[^>]*>(.*?)<\/a>/gi,
      // Divs with click handlers
      /<div[^>]*onClick[^>]*>/gi
    ]
    
    jsxPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const elementHtml = match[0]
        const innerText = match[1] || ''
        
        // Extract attributes
        const classMatch = elementHtml.match(/className=["']([^"']+)["']/i)
        const idMatch = elementHtml.match(/id=["']([^"']+)["']/i)
        const placeholderMatch = elementHtml.match(/placeholder=["']([^"']+)["']/i)
        const typeMatch = elementHtml.match(/type=["']([^"']+)["']/i)
        
        // Generate selector
        let selector = elementHtml.match(/<(\w+)/)?.[1] || 'element'
        if (idMatch) selector += `#${idMatch[1]}`
        if (classMatch) selector += `.${classMatch[1].split(' ')[0]}`
        
        elements.push({
          type: typeMatch?.[1] || selector.split(/[#.]/)[0],
          selector,
          text: innerText.trim(),
          placeholder: placeholderMatch?.[1],
          action: elementHtml.includes('onClick') ? 'click' : 
                  elementHtml.includes('onSubmit') ? 'submit' : 'interact',
          description: `${selector} ${innerText ? `with text "${innerText}"` : ''}`.trim()
        })
      }
    })
    
    return elements
  }

  // Vue component analysis
  const analyzeVueComponent = (content: string, _filePath: string) => {
    const elements: any[] = []
    
    // Extract template section
    const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/i)
    if (!templateMatch) return elements
    
    const template = templateMatch[1]
    
    // Vue-specific patterns
    const vuePatterns = [
      // Buttons with @click
      /<button[^>]*@click[^>]*>(.*?)<\/button>/gi,
      // Inputs with v-model
      /<input[^>]*v-model[^>]*\/?>/gi,
      // Forms with @submit
      /<form[^>]*@submit[^>]*>/gi
    ]
    
    vuePatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(template)) !== null) {
        const elementHtml = match[0]
        const innerText = match[1] || ''
        
        const classMatch = elementHtml.match(/class=["']([^"']+)["']/i)
        const idMatch = elementHtml.match(/id=["']([^"']+)["']/i)
        const vModelMatch = elementHtml.match(/v-model=["']([^"']+)["']/i)
        
        let selector = elementHtml.match(/<(\w+)/)?.[1] || 'element'
        if (idMatch) selector += `#${idMatch[1]}`
        if (classMatch) selector += `.${classMatch[1].split(' ')[0]}`
        
        elements.push({
          type: selector.split(/[#.]/)[0],
          selector,
          text: innerText.trim(),
          action: elementHtml.includes('@click') ? 'click' : 
                  elementHtml.includes('@submit') ? 'submit' : 'interact',
          description: `${selector} ${vModelMatch ? `(bound to ${vModelMatch[1]})` : ''} ${innerText ? `with text "${innerText}"` : ''}`.trim()
        })
      }
    })
    
    return elements
  }

  // Angular component analysis
  const analyzeAngularComponent = (content: string, _filePath: string) => {
    const elements: any[] = []
    
    // Angular-specific patterns
    const ngPatterns = [
      // Buttons with (click)
      /<button[^>]*\(click\)[^>]*>(.*?)<\/button>/gi,
      // Inputs with [(ngModel)]
      /<input[^>]*\[\(ngModel\)\][^>]*\/?>/gi,
      // Forms with (ngSubmit)
      /<form[^>]*\(ngSubmit\)[^>]*>/gi
    ]
    
    ngPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const elementHtml = match[0]
        const innerText = match[1] || ''
        
        const classMatch = elementHtml.match(/class=["']([^"']+)["']/i)
        const idMatch = elementHtml.match(/id=["']([^"']+)["']/i)
        
        let selector = elementHtml.match(/<(\w+)/)?.[1] || 'element'
        if (idMatch) selector += `#${idMatch[1]}`
        if (classMatch) selector += `.${classMatch[1].split(' ')[0]}`
        
        elements.push({
          type: selector.split(/[#.]/)[0],
          selector,
          text: innerText.trim(),
          action: elementHtml.includes('(click)') ? 'click' : 
                  elementHtml.includes('(ngSubmit)') ? 'submit' : 'interact',
          description: `${selector} ${innerText ? `with text "${innerText}"` : ''}`.trim()
        })
      }
    })
    
    return elements
  }

  // Main analysis function
  const analyzeProject = async (files: File[]) => {
    setIsAnalyzing(true)
    
    const validFiles = files.filter(isValidFile)
    const framework = detectFramework(validFiles)
    
    const analysis: ProjectAnalysis = {
      framework,
      components: [],
      totalFiles: validFiles.length,
      processedFiles: 0,
      errors: []
    }
    
    // Process files
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]
      const progress = {
        current: i + 1,
        total: validFiles.length,
        message: `Analyzing ${file.name}...`
      }
      
      setAnalysisProgress(progress)
      onAnalysisProgress(progress)
      
      try {
        const content = await file.text()
        
        let elements: any[] = []
        
        if (framework === 'react' && (file.name.includes('.jsx') || file.name.includes('.tsx'))) {
          elements = analyzeReactComponent(content, file.webkitRelativePath || file.name)
        } else if (framework === 'vue' && file.name.includes('.vue')) {
          elements = analyzeVueComponent(content, file.webkitRelativePath || file.name)
        } else if (framework === 'angular' && file.name.includes('.component.')) {
          elements = analyzeAngularComponent(content, file.webkitRelativePath || file.name)
        }
        
        if (elements.length > 0) {
          analysis.components.push({
            name: file.name.replace(/\.[^.]+$/, ''),
            filePath: file.webkitRelativePath || file.name,
            elements
          })
        }
        
        analysis.processedFiles++
        
        // Small delay to prevent blocking UI
        await new Promise(resolve => setTimeout(resolve, 10))
        
      } catch (error: any) {
        analysis.errors.push(`Failed to process ${file.name}: ${error.message}`)
      }
    }
    
    setIsAnalyzing(false)
    setRetryAttempt(0) // Reset retry count on success
    setLastFailedFiles([])
    onAnalysisComplete(analysis)
  }

  // Retry mechanism
  const handleRetry = () => {
    if (lastFailedFiles.length > 0 && retryAttempt < 3) {
      setRetryAttempt(prev => prev + 1)
      analyzeProject(lastFailedFiles)
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragActive, setIsDragActive] = useState(false)

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length > 0) {
      setLastFailedFiles(files) // Store for retry
      setRetryAttempt(0)
      analyzeProject(files)
    }
  }, [])

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragActive(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragActive(false)
  }, [])

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragActive(false)
    
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) {
      setLastFailedFiles(files) // Store for retry
      setRetryAttempt(0)
      analyzeProject(files)
    }
  }, [])

  return (
    <div className="w-full">
      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
          isDragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        } ${isAnalyzing ? 'pointer-events-none opacity-50' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".js,.jsx,.ts,.tsx,.vue,.html,.json"
        />
        
        {isAnalyzing ? (
          <div className="space-y-4">
            <div className="text-4xl">🔍</div>
            <div>
              <p className="text-lg font-medium text-gray-900">Analyzing Your Project...</p>
              <p className="text-sm text-gray-600 mt-1">{analysisProgress.message}</p>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${analysisProgress.total > 0 ? (analysisProgress.current / analysisProgress.total) * 100 : 0}%` 
                }}
              />
            </div>
            
            <p className="text-xs text-gray-500">
              Processing file {analysisProgress.current} of {analysisProgress.total}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-4xl">📁</div>
            <div>
              <p className="text-lg font-medium text-gray-900">
                {isDragActive ? 'Drop your project folder here!' : 'Upload Your Project'}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Drag and drop your React, Vue, or Angular project folder here
              </p>
            </div>
            
            <div className="text-xs text-gray-500 max-w-md mx-auto">
              <p className="mb-2">🚀 <strong>Revolutionary Feature:</strong> Test your local development projects without deployment!</p>
              <div className="text-left space-y-1">
                <p>✅ React (.jsx, .tsx files)</p>
                <p>✅ Vue (.vue files)</p> 
                <p>✅ Angular (.component.ts files)</p>
                <p>✅ Automatic element extraction</p>
                <p>✅ Smart selector generation</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}