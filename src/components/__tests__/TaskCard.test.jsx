import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import TaskCard from '../TaskCard.jsx';

const mockTask = {
  id: 1,
  title: 'Fix login bug',
  description: 'Users cannot login with email',
  priority: 'high',
  status: 'todo',
  label: 'bug',
  created_at: new Date().toISOString(),
  due_date: null
};

const renderWithDnd = (ui) => {
  return render(
    <DragDropContext onDragEnd={() => {}}>
      <Droppable droppableId="mock-board">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            {ui}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

describe('TaskCard', () => {
  it('renders task title', () => {
    renderWithDnd(<TaskCard task={mockTask} index={0} />);
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
  });

  it('renders priority badge', () => {
    renderWithDnd(<TaskCard task={mockTask} index={0} />);
    const badge = screen.getByText('high');
    expect(badge).toHaveClass('badge', 'high');
  });

  it('renders label', () => {
    renderWithDnd(<TaskCard task={mockTask} index={0} />);
    expect(screen.getByText('bug')).toBeInTheDocument();
  });

  it('renders description', () => {
    renderWithDnd(<TaskCard task={mockTask} index={0} />);
    expect(screen.getByText('Users cannot login with email')).toBeInTheDocument();
  });

  it('is draggable', () => {
    const { container } = renderWithDnd(<TaskCard task={mockTask} index={0} />);
    const card = container.querySelector('.task-card');
    // @hello-pangea/dnd applies a tabindex to make elements draggable via keyboard
    expect(card).toHaveAttribute('tabindex', '0');
  });

  it('shows overdue styling for past due dates', () => {
    const overdueTask = {
      ...mockTask,
      due_date: '2020-01-01',
      status: 'todo'
    };
    const { container } = renderWithDnd(<TaskCard task={overdueTask} index={0} />);
    const card = container.querySelector('.task-card');
    expect(card).toHaveClass('task-card-overdue');
  });

  it('does not show overdue for done tasks', () => {
    const doneTask = {
      ...mockTask,
      due_date: '2020-01-01',
      status: 'done'
    };
    const { container } = renderWithDnd(<TaskCard task={doneTask} index={0} />);
    const card = container.querySelector('.task-card');
    expect(card).not.toHaveClass('task-card-overdue');
  });

  it('hides description when empty', () => {
    const noDescTask = { ...mockTask, description: '' };
    const { container } = renderWithDnd(<TaskCard task={noDescTask} index={0} />);
    expect(container.querySelector('.task-card-desc')).not.toBeInTheDocument();
  });
});
