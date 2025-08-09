import '@testing-library/jest-dom';

// Mock canvas context for heatmap tests
const mockContext = {
  clearRect: jest.fn(),
  fillStyle: '',
  fillRect: jest.fn(),
  canvas: document.createElement('canvas'),
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  drawImage: jest.fn(),
  // Add other required CanvasRenderingContext2D properties as needed
} as unknown as CanvasRenderingContext2D;

HTMLCanvasElement.prototype.getContext = jest.fn((contextId: string) => {
  if (contextId === '2d') {
    return mockContext;
  }
  return null;
});
