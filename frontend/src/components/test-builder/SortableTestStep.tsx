import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TestStep {
  id: string;
  type: 'click' | 'type' | 'wait' | 'assert' | 'hover' | 'scroll' | 'select' | 'clear' | 'doubleclick' | 'rightclick' | 'press' | 'upload' | 'check' | 'uncheck';
  selector: string;
  value?: string;
  description: string;
}

interface SortableTestStepProps {
  step: TestStep;
  index: number;
  onRemove: () => void;
  onEdit: () => void;
}

export function SortableTestStep({ step, index, onRemove, onEdit }: SortableTestStepProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver
  } = useSortable({ 
    id: step.id,
    data: {
      type: 'step',
      step
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getStepTypeColor = (type: string) => {
    switch (type) {
      case 'click': return 'bg-blue-100 text-blue-800';
      case 'doubleclick': return 'bg-blue-100 text-blue-800';
      case 'rightclick': return 'bg-blue-100 text-blue-800';
      case 'hover': return 'bg-indigo-100 text-indigo-800';
      case 'type': return 'bg-green-100 text-green-800';
      case 'clear': return 'bg-green-100 text-green-800';
      case 'select': return 'bg-emerald-100 text-emerald-800';
      case 'check': return 'bg-emerald-100 text-emerald-800';
      case 'uncheck': return 'bg-emerald-100 text-emerald-800';
      case 'upload': return 'bg-cyan-100 text-cyan-800';
      case 'scroll': return 'bg-orange-100 text-orange-800';
      case 'press': return 'bg-orange-100 text-orange-800';
      case 'wait': return 'bg-yellow-100 text-yellow-800';
      case 'assert': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStepTypeIcon = (type: string) => {
    switch (type) {
      case 'click': return '👆';
      case 'doubleclick': return '👆👆';
      case 'rightclick': return '👆';
      case 'hover': return '🫸';
      case 'type': return '⌨️';
      case 'clear': return '🧹';
      case 'select': return '📋';
      case 'check': return '☑️';
      case 'uncheck': return '◻️';
      case 'upload': return '📁';
      case 'scroll': return '↕️';
      case 'press': return '⌨️';
      case 'wait': return '⏳';
      case 'assert': return '✓';
      default: return '📝';
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`
        border rounded-lg p-4 bg-white shadow-sm transition-all duration-200
        ${isDragging ? 'opacity-50 shadow-lg scale-105 z-50' : ''}
        ${isOver ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}
        hover:shadow-md hover:border-gray-300
      `}
    >
      <div className="flex items-start justify-between">
        {/* Drag Handle */}
        <div 
          {...attributes} 
          {...listeners} 
          className="cursor-grab hover:cursor-grabbing p-2 mr-3 rounded-md hover:bg-gray-100 transition-colors"
          title="Drag to reorder"
        >
          <svg 
            className="w-5 h-5 text-gray-400" 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </div>
        
        {/* Step Content */}
        <div className="flex-1 min-w-0">
          {/* Step Header */}
          <div className="flex items-center space-x-2 mb-3">
            <span className="inline-flex items-center space-x-1 bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded">
              <span>Step {index + 1}</span>
            </span>
            <span className={`inline-flex items-center space-x-1 text-sm font-medium px-2 py-1 rounded ${getStepTypeColor(step.type)}`}>
              <span>{getStepTypeIcon(step.type)}</span>
              <span>{step.type.toUpperCase()}</span>
            </span>
          </div>
          
          {/* Step Description */}
          <div className="space-y-2">
            <p className="font-medium text-gray-900 leading-snug">
              {step.description}
            </p>
            
            {/* Selector Display */}
            <div className="bg-gray-50 rounded-md p-2 border">
              <p className="text-sm text-gray-600 mb-1 font-medium">CSS Selector:</p>
              <code className="text-sm font-mono text-gray-800 break-all">
                {step.selector}
              </code>
            </div>
            
            {/* Value Display */}
            {step.value && (
              <div className="bg-gray-50 rounded-md p-2 border">
                <p className="text-sm text-gray-600 mb-1 font-medium">
                  {step.type === 'type' ? 'Text to Type:' : 
                   step.type === 'wait' ? 'Wait Time (ms):' : 
                   'Expected Text:'}
                </p>
                <p className="text-sm text-gray-800">
                  {step.value}
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center space-x-1 ml-3">
          <button
            onClick={onEdit}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            title="Edit step"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onRemove}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title="Delete step"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}