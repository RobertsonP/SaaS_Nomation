import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CheckSquare,
  ChevronsUpDown,
  Clock,
  Eraser,
  GripVertical,
  Keyboard,
  ListChecks,
  type LucideIcon,
  MousePointerClick,
  Move,
  Pencil,
  Play,
  Square,
  Trash2,
  Type as TypeIcon,
  Upload,
} from 'lucide-react';
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

type Tone = 'moss' | 'slate' | 'amber' | 'clay' | 'info' | 'mute';

const STEP_META: Record<string, { tone: Tone; Icon: LucideIcon }> = {
  click: { tone: 'info', Icon: MousePointerClick },
  doubleclick: { tone: 'info', Icon: MousePointerClick },
  rightclick: { tone: 'info', Icon: MousePointerClick },
  hover: { tone: 'info', Icon: MousePointerClick },
  type: { tone: 'moss', Icon: TypeIcon },
  clear: { tone: 'moss', Icon: Eraser },
  select: { tone: 'moss', Icon: ChevronsUpDown },
  check: { tone: 'moss', Icon: CheckSquare },
  uncheck: { tone: 'moss', Icon: Square },
  upload: { tone: 'moss', Icon: Upload },
  scroll: { tone: 'amber', Icon: Move },
  press: { tone: 'amber', Icon: Keyboard },
  wait: { tone: 'slate', Icon: Clock },
  assert: { tone: 'moss', Icon: ListChecks },
};

function toneToken(tone: Tone): { bg: string; fg: string; edge: string } {
  switch (tone) {
    case 'moss':
      return { bg: 'var(--moss-soft)', fg: 'var(--moss)', edge: 'var(--moss-edge)' };
    case 'amber':
      return { bg: 'var(--amber-soft)', fg: 'var(--amber)', edge: 'var(--amber-edge)' };
    case 'clay':
      return { bg: 'var(--clay-soft)', fg: 'var(--clay)', edge: 'var(--clay-edge)' };
    case 'slate':
      return { bg: 'var(--slate-soft)', fg: 'var(--slate)', edge: 'var(--slate-edge)' };
    case 'info':
      return { bg: 'var(--info-soft)', fg: 'var(--info)', edge: 'var(--info-edge)' };
    case 'mute':
    default:
      return { bg: 'var(--surface-2)', fg: 'var(--ink-2)', edge: 'var(--hair)' };
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
    isOver,
  } = useSortable({
    id: step.id,
    data: { type: 'step', step },
  });

  const meta = STEP_META[step.type] ?? { tone: 'mute' as Tone, Icon: MousePointerClick };
  const tone = toneToken(meta.tone);

  const baseStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    background: 'var(--surface)',
    border: `1px solid ${isActiveVideoStep ? 'var(--moss)' : 'var(--hair)'}`,
    borderRadius: 8,
    padding: 8,
    boxShadow: isActiveVideoStep ? '0 0 0 2px var(--moss-soft)' : 'none',
    opacity: isDragging ? 0.5 : 1,
    outline: isOver ? '1px dashed var(--moss)' : 'none',
  };

  return (
    <div ref={setNodeRef} style={baseStyle}>
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <div
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          style={{
            cursor: 'grab',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--ink-3)',
            flexShrink: 0,
          }}
        >
          <GripVertical size={14} />
        </div>

        <span
          className="tabular"
          style={{
            display: 'inline-grid',
            placeItems: 'center',
            minWidth: 22,
            height: 20,
            padding: '0 6px',
            borderRadius: 4,
            background: 'var(--surface-2)',
            color: 'var(--ink-2)',
            fontSize: 11,
            fontWeight: 600,
            border: '1px solid var(--hair)',
            flexShrink: 0,
          }}
        >
          {index + 1}
        </span>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 7px',
            borderRadius: 999,
            background: tone.bg,
            color: tone.fg,
            border: `1px solid ${tone.edge}`,
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          <meta.Icon size={11} />
          {step.type}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {step.description}
          </div>
          <div
            className="row"
            style={{ gap: 6, fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}
          >
            <code
              className="mono"
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: 'var(--slate)',
              }}
            >
              {step.selector}
            </code>
            {step.value && (
              <>
                <span style={{ color: 'var(--ink-4)' }}>→</span>
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--ink-2)',
                    fontWeight: 500,
                  }}
                >
                  {step.value}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="row" style={{ gap: 2, flexShrink: 0 }}>
          {onLiveExecute && projectId && (
            <button
              type="button"
              onClick={() => onLiveExecute(step)}
              disabled={isExecuting}
              className="icon-btn"
              title={isExecuting ? 'Executing step…' : 'Run this step'}
              style={isExecuting ? { color: 'var(--amber)' } : undefined}
            >
              {isExecuting ? (
                <div
                  className="animate-spin"
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    border: '1.5px solid currentColor',
                    borderTopColor: 'transparent',
                  }}
                />
              ) : (
                <Play size={12} />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="icon-btn"
            title="Edit step"
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="icon-btn"
            title="Delete step"
            style={{ color: 'var(--clay)' }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

