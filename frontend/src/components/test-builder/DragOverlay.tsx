import { DragOverlay as DnDKitDragOverlay } from '@dnd-kit/core';
import { TestStep } from '../../types/test.types';
import { SortableTestStep } from './SortableTestStep';

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
            onEdit={() => {}}
          />
        </div>
      ) : null}
    </DnDKitDragOverlay>
  );
}