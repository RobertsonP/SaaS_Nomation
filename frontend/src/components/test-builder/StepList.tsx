import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { ProjectElement } from '../../types/element.types'; // Assuming this is needed for SortableTestStep
import { TestStep } from '../../types/test.types';
import { SortableTestStep } from './SortableTestStep';
import { DragOverlay } from './DragOverlay';

interface StepListProps {
  steps: TestStep[];
  onStepsChange: (newSteps: TestStep[]) => void; // Callback to update parent's steps state
  onEditStep: (step: TestStep) => void;
  onRemoveStep: (id: string) => void;
  onLiveExecuteStep: (step: TestStep) => Promise<void>;
  executingStepId: string | null;
  projectId?: string;
  // For video timestamp highlighting (future enhancement within this component)
  activeVideoStepId?: string | null; // The step currently highlighted in video playback
}

export function StepList({
  steps,
  onStepsChange,
  onEditStep,
  onRemoveStep,
  onLiveExecuteStep,
  executingStepId,
  projectId,
  activeVideoStepId
}: StepListProps) {
  const [activeStep, setActiveStep] = React.useState<TestStep | null>(null);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const active = event.active;
    const activeStepData = steps.find(step => step.id === active.id);
    if (activeStepData) {
      setActiveStep(activeStepData);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
      onStepsChange(arrayMove(
        steps,
        steps.findIndex(item => item.id === active.id),
        steps.findIndex(item => item.id === over?.id)
      ));
    }
    
    setActiveStep(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {steps.map((step, index) => (
            <SortableTestStep
              key={step.id}
              step={step}
              index={index}
              onEdit={() => onEditStep(step)}
              onRemove={() => onRemoveStep(step.id)}
              onLiveExecute={onLiveExecuteStep}
              isExecuting={executingStepId === step.id}
              projectId={projectId}
              // NEW: For video timestamp highlighting
              isActiveVideoStep={activeVideoStepId === step.id}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay
        activeStep={activeStep}
        activeIndex={steps.findIndex(s => s.id === activeStep?.id)}
      />
    </DndContext>
  );
}