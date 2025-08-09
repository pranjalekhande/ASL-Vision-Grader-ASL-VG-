import React from 'react';
import { render, screen } from '@testing-library/react';
import { ScoreDisplay } from '../ScoreDisplay';
import type { ComparisonState } from '../../../hooks/useComparison';

describe('ScoreDisplay Component', () => {
  const mockComparisonState: ComparisonState = {
    isComparing: false,
    progress: 100,
    scores: {
      overall: 85,
      handshape: 90,
      location: 80,
      movement: 85
    },
    heatmap: [
      {
        frameIndex: 0,
        differences: [0.1, 0.2, 0.3]
      }
    ],
    alignedPath: [[0, 0]]
  };

  it('should render scores when comparison is complete', () => {
    render(<ScoreDisplay comparison={mockComparisonState} />);

    expect(screen.getByText('85%', { selector: '.text-4xl' })).toBeInTheDocument();
    expect(screen.getByText('Handshape Accuracy')).toBeInTheDocument();
    expect(screen.getByText('Location Accuracy')).toBeInTheDocument();
    expect(screen.getByText('Movement Accuracy')).toBeInTheDocument();
  });

  it('should show loading state while comparing', () => {
    const comparingState: ComparisonState = {
      ...mockComparisonState,
      isComparing: true,
      progress: 50,
      scores: null,
      heatmap: null,
      alignedPath: null
    };

    render(<ScoreDisplay comparison={comparingState} />);

    expect(screen.getByText('Comparing signs... 50%')).toBeInTheDocument();
  });

  it('should render nothing when no comparison is in progress or complete', () => {
    const emptyState: ComparisonState = {
      isComparing: false,
      progress: 0,
      scores: null,
      heatmap: null,
      alignedPath: null
    };

    const { container } = render(<ScoreDisplay comparison={emptyState} />);
    expect(container.firstChild).toBeNull();
  });

  it('should apply correct color classes based on scores', () => {
    const highScores: ComparisonState = {
      ...mockComparisonState,
      scores: {
        overall: 95,
        handshape: 95,
        location: 95,
        movement: 95
      }
    };

    render(<ScoreDisplay comparison={highScores} />);
    expect(screen.getByText('95%', { selector: '.text-4xl' })).toHaveClass('text-green-500');
  });

  it('should render canvas for heatmap visualization', () => {
    render(<ScoreDisplay comparison={mockComparisonState} />);
    const canvas = screen.getByTestId('heatmap-canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas.tagName.toLowerCase()).toBe('canvas');
  });
});
