import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MoreHorizontal, Pencil, Play, Trash2 } from 'lucide-react';
import { Pill, PillKind } from '../ui/Pill';
import { TestStep } from '../../types/test.types';

interface SortableTestStepProps {
  step: TestStep;
  index: number;
  onRemove: () => void;
  onEdit: () => void;
  onLiveExecute?: (step: TestStep) => void;
  isExecuting?: boolean;
  projectId?: string;
  isActiveVideoStep?: boolean;
}

function actionPillKind(type: string): PillKind {
  switch (type) {
    case 'assert':
      return 'ok';
    case 'navigate':
    case 'click':
    case 'doubleclick':
    case 'rightclick':
    case 'hover':
      return 'info';
    case 'wait':
      return 'warn';
    case 'screenshot':
      return 'mute';
    default:
      return 'mute';
  }
}

export function SortableTestStep({
  step,
  index,
  onRemove,
  onEdit,
  onLiveExecute,
  isExecuting,
  projectId,
  isActiveVideoStep,
}: SortableTestStepProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: step.id,
    data: { type: 'step', step },
  });

  const cardStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: 'var(--surface)',
    border: `1px solid ${isActiveVideoStep ? 'var(--ink-2)' : 'var(--hair)'}`,
    borderRadius: 6,
    padding: '8px 12px',
    boxShadow: isActiveVideoStep ? 'var(--shadow-md)' : 'none',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={cardStyle}>
      <div className="row" style={{ gap: 10 }}>
        {/* Step number */}
        <span
          className="mono dim"
          style={{ width: 18, fontSize: 10.5, flexShrink: 0 }}
        >
          {String(index + 1).padStart(2, '0')}
        </span>

        {/* Drag handle */}
        <span
          {...attributes}
          {...listeners}
          className="dim"
          title="Drag to reorder"
          style={{
            cursor: 'grab',
            display: 'inline-flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <GripVertical size={13} />
        </span>

        {/* Action pill — lowercase, plain word */}
        <Pill kind={actionPillKind(step.type)} dot={false}>
          {step.type}
        </Pill>

        {/* Selector / target */}
        <span
          className="mono"
          style={{
            fontSize: 11.5,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: 'var(--ink-2)',
          }}
          title={step.selector}
        >
          {step.selector}
        </span>

        {/* Optional value */}
        {step.value && (
          <span
            className="mono"
            style={{
              fontSize: 11.5,
              color: 'var(--moss)',
              maxWidth: 140,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            title={step.value}
          >
            {step.value}
          </span>
        )}

        {/* Description */}
        {step.description && step.description !== step.selector && (
          <span
            className="dim"
            style={{
              fontSize: 11.5,
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            title={step.description}
          >
            {step.description}
          </span>
        )}

        {/* Actions */}
        <div className="row" style={{ gap: 2, flexShrink: 0 }}>
          {onLiveExecute && projectId && (
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={() => onLiveExecute(step)}
              disabled={isExecuting}
              title={isExecuting ? 'Executing…' : 'Run this step'}
            >
              {isExecuting ? (
                <span
                  className="animate-spin"
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    border: '1.5px solid currentColor',
                    borderTopColor: 'transparent',
                    display: 'inline-block',
                  }}
                />
              ) : (
                <Play size={12} />
              )}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onEdit}
            title="Edit step"
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onRemove}
            title="Delete step"
            style={{ color: 'var(--clay)' }}
          >
            <Trash2 size={12} />
          </button>
          <span className="dim" style={{ display: 'none' }}>
            <MoreHorizontal size={12} />
          </span>
        </div>
      </div>
    </div>
  );
}
