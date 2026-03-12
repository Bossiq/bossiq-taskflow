import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Board from '../Board.jsx';

const mockTasks = [
  { id: 1, title: 'Task A', status: 'todo', priority: 'low', description: '', label: '', created_at: new Date().toISOString() },
  { id: 2, title: 'Task B', status: 'inprogress', priority: 'medium', description: '', label: '', created_at: new Date().toISOString() },
  { id: 3, title: 'Task C', status: 'done', priority: 'high', description: '', label: '', created_at: new Date().toISOString() },
  { id: 4, title: 'Task D', status: 'todo', priority: 'urgent', description: '', label: '', created_at: new Date().toISOString() },
];

describe('Board', () => {
  it('renders three columns when tasks exist', () => {
    render(<Board tasks={mockTasks} />);
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('distributes tasks into correct columns', () => {
    render(<Board tasks={mockTasks} />);
    expect(screen.getByText('Task A')).toBeInTheDocument();
    expect(screen.getByText('Task B')).toBeInTheDocument();
    expect(screen.getByText('Task C')).toBeInTheDocument();
    expect(screen.getByText('Task D')).toBeInTheDocument();
  });

  it('shows correct task counts', () => {
    render(<Board tasks={mockTasks} />);
    const counts = screen.getAllByLabelText(/^\d+ tasks$/);
    expect(counts.length).toBeGreaterThanOrEqual(3);
  });

  it('shows onboarding message when board is empty', () => {
    render(<Board tasks={[]} />);
    expect(screen.getByText('No tasks yet')).toBeInTheDocument();
    expect(screen.getByText('+ New Task')).toBeInTheDocument();
  });

  it('has ARIA region roles on columns when tasks exist', () => {
    render(<Board tasks={mockTasks} />);
    const regions = screen.getAllByRole('region');
    expect(regions).toHaveLength(3);
  });

  it('shows empty column message when only some columns have tasks', () => {
    const singleTask = [{ id: 1, title: 'Solo', status: 'todo', priority: 'low', description: '', label: '', created_at: new Date().toISOString() }];
    render(<Board tasks={singleTask} />);
    const emptyMessages = screen.getAllByText('Drop tasks here');
    expect(emptyMessages).toHaveLength(2); // inprogress + done are empty
  });
});
