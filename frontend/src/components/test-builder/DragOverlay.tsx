import { DragOverlay as DnDKitDragOverlay } from '@dnd-kit/core';
import { SortableTestStep } from './SortableTestStep';

interface TestStep {
  id: string;
  type: 'click' | 'type' | 'wait' | 'assert';
  selector: string;
  value?: string;
  description: string;
}

interface DragOverlayProps {
  activeStep: TestStep | null;
  activeIndex: number;
}

export function DragOverlay({ activeStep, activeIndex }: DragOverlayProps) {
  return (
    <DnDKitDragOverlay>
      {activeStep ? (
        <div className="transform rotate-5 opacity-90">
          <SortableTestStep
            step={activeStep}
            index={activeIndex}
            onRemove={() => {}}
          />
        </div>
      ) : null}
    </DnDKitDragOverlay>
  );
}