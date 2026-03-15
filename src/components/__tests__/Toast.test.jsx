import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Toast from '../Toast.jsx';

describe('Toast', () => {
  it('renders message', () => {
    render(<Toast message="Task created" type="success" onClose={() => {}} />);
    expect(screen.getByText('Task created')).toBeInTheDocument();
  });

  it('renders success icon', () => {
    const { container } = render(<Toast message="Done" type="success" onClose={() => {}} />);
    expect(container.querySelector('.toast-icon svg')).toBeInTheDocument();
  });

  it('renders error icon', () => {
    const { container } = render(<Toast message="Failed" type="error" onClose={() => {}} />);
    expect(container.querySelector('.toast-icon svg')).toBeInTheDocument();
  });

  it('calls onClose after timeout', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Toast message="Test" type="info" onClose={onClose} />);
    vi.advanceTimersByTime(3000);
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('has correct type class', () => {
    const { container } = render(<Toast message="Msg" type="error" onClose={() => {}} />);
    const toast = container.querySelector('.toast');
    expect(toast).toHaveClass('toast-error');
  });
});
