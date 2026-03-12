import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('TaskCard', () => {
  it('renders task title', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
  });

  it('renders priority badge', () => {
    render(<TaskCard task={mockTask} />);
    const badge = screen.getByText('high');
    expect(badge).toHaveClass('badge', 'high');
  });

  it('renders label', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('bug')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('Users cannot login with email')).toBeInTheDocument();
  });

  it('is draggable', () => {
    const { container } = render(<TaskCard task={mockTask} />);
    const card = container.querySelector('.task-card');
    expect(card).toHaveAttribute('draggable', 'true');
  });

  it('shows overdue styling for past due dates', () => {
    const overdueTask = {
      ...mockTask,
      due_date: '2020-01-01',
      status: 'todo'
    };
    const { container } = render(<TaskCard task={overdueTask} />);
    const card = container.querySelector('.task-card');
    expect(card).toHaveClass('task-card-overdue');
  });

  it('does not show overdue for done tasks', () => {
    const doneTask = {
      ...mockTask,
      due_date: '2020-01-01',
      status: 'done'
    };
    const { container } = render(<TaskCard task={doneTask} />);
    const card = container.querySelector('.task-card');
    expect(card).not.toHaveClass('task-card-overdue');
  });

  it('hides description when empty', () => {
    const noDescTask = { ...mockTask, description: '' };
    const { container } = render(<TaskCard task={noDescTask} />);
    expect(container.querySelector('.task-card-desc')).not.toBeInTheDocument();
  });
});
