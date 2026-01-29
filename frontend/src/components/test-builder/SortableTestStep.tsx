import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TestStep } from '../../types/test.types';

interface SortableTestStepProps {
  step: TestStep;
  index: number;
  onRemove: () => void;
  onEdit: () => void;
  onLiveExecute?: (step: TestStep) => void;
  isExecuting?: boolean;
  projectId?: string;
  isActiveVideoStep?: boolean; // NEW: Prop for video timestamp highlighting
}

export function SortableTestStep({ step, index, onRemove, onEdit, onLiveExecute, isExecuting, projectId, isActiveVideoStep }: SortableTestStepProps) {
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
      case 'click': return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300';
      case 'doubleclick': return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300';
      case 'rightclick': return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300';
      case 'hover': return 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300';
      case 'type': return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300';
      case 'clear': return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300';
      case 'select': return 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300';
      case 'check': return 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300';
      case 'uncheck': return 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300';
      case 'upload': return 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300';
      case 'scroll': return 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300';
      case 'press': return 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300';
      case 'wait': return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300';
      case 'assert': return 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
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
        border rounded-lg p-2 bg-white dark:bg-gray-800 shadow-sm transition-all duration-200
        ${isDragging ? 'opacity-50 shadow-lg scale-105 z-50' : ''}
        ${isOver ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 dark:border-gray-700'}
        ${isActiveVideoStep ? 'border-purple-400 dark:border-purple-500 ring-2 ring-purple-300 dark:ring-purple-600 bg-purple-50 dark:bg-purple-900/30' : ''}
        hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600
      `}
    >
      <div className="flex items-center gap-2">
        {/* Compact Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab hover:cursor-grabbing p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
          title="Drag to reorder"
        >
          <svg className="w-3 h-3 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </div>

        {/* Step Number */}
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex-shrink-0">
          {index + 1}
        </span>

        {/* Step Type */}
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getStepTypeColor(step.type)}`}>
          <span className="mr-1">{getStepTypeIcon(step.type)}</span>
          {step.type.toUpperCase()}
        </span>
        
        {/* Step Content - Compact */}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-900 dark:text-white truncate">
            {step.description}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            <code className="font-mono truncate">{step.selector}</code>
            {step.value && (
              <>
                <span>→</span>
                <span className="truncate font-medium">{step.value}</span>
              </>
            )}
          </div>
        </div>
        
        {/* Compact Action Buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Live Execute Button */}
          {onLiveExecute && projectId && (
            <button
              onClick={() => onLiveExecute(step)}
              disabled={isExecuting}
              className={`p-1 rounded transition-colors ${
                isExecuting
                  ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 cursor-wait'
                  : 'text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30'
              }`}
              title={isExecuting ? "Executing step..." : "Execute this step live"}
            >
              {isExecuting ? (
                <div className="w-3 h-3 animate-spin rounded-full border border-current border-t-transparent" />
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6-6h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z" />
                </svg>
              )}
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-1 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
            title="Edit step"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onRemove}
            className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
            title="Delete step"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}