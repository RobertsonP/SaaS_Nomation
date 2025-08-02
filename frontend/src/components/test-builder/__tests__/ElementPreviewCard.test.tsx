import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// import { ElementPreview } from '../../shared/ElementPreview';

describe.skip('ElementPreviewCard - Preview Button Fix', () => {
  const mockElement = {
    id: 'test-element-1',
    projectId: 'test-project-1',
    selector: '#test-selector',
    elementType: 'button' as const,
    description: 'Test Button',
    confidence: 0.9,
    attributes: {
      text: 'Click Me',
      id: 'test-button',
      class: 'btn btn-primary'
    },
    sourceUrl: {
      id: 'url-1',
      url: 'https://example.com',
      title: 'Test Page'
    },
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z'
  };

  const mockOnSelectElement = jest.fn();
  const mockOnRequestScreenshot = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render preview button when onRequestScreenshot is provided', () => {
    render(
      <ElementPreviewCard
        element={mockElement}
        onSelectElement={mockOnSelectElement}
        onRequestScreenshot={mockOnRequestScreenshot}
      />
    );

    // Should show preview button
    expect(screen.getByText('📸 Preview')).toBeInTheDocument();
  });

  it('should not render preview button when onRequestScreenshot is not provided', () => {
    render(
      <ElementPreviewCard
        element={mockElement}
        onSelectElement={mockOnSelectElement}
      />
    );

    // Should not show preview button
    expect(screen.queryByText('📸 Preview')).not.toBeInTheDocument();
  });

  it('should call onRequestScreenshot when preview button is clicked', async () => {
    mockOnRequestScreenshot.mockResolvedValue('base64-screenshot-data');

    render(
      <ElementPreviewCard
        element={mockElement}
        onSelectElement={mockOnSelectElement}
        onRequestScreenshot={mockOnRequestScreenshot}
      />
    );

    const previewButton = screen.getByText('📸 Preview');
    fireEvent.click(previewButton);

    await waitFor(() => {
      expect(mockOnRequestScreenshot).toHaveBeenCalledWith(
        'test-element-1',
        '#test-selector',
        'https://example.com'
      );
    });
  });

  it('should show loading state when capturing screenshot', async () => {
    mockOnRequestScreenshot.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(
      <ElementPreviewCard
        element={mockElement}
        onSelectElement={mockOnSelectElement}
        onRequestScreenshot={mockOnRequestScreenshot}
      />
    );

    const previewButton = screen.getByText('📸 Preview');
    fireEvent.click(previewButton);

    // Should show loading state
    expect(screen.getByText('Capturing...')).toBeInTheDocument();
  });

  it('should show refresh button when screenshot exists', () => {
    const elementWithScreenshot = {
      ...mockElement,
      attributes: {
        ...mockElement.attributes,
        screenshot: 'base64-screenshot-data'
      }
    };

    render(
      <ElementPreviewCard
        element={elementWithScreenshot}
        onSelectElement={mockOnSelectElement}
        onRequestScreenshot={mockOnRequestScreenshot}
      />
    );

    // Should show refresh button instead of preview
    expect(screen.getByText('🔄 Refresh')).toBeInTheDocument();
    expect(screen.queryByText('📸 Preview')).not.toBeInTheDocument();
  });

  it('should display element information correctly', () => {
    render(
      <ElementPreviewCard
        element={mockElement}
        onSelectElement={mockOnSelectElement}
        onRequestScreenshot={mockOnRequestScreenshot}
      />
    );

    // Check element information
    expect(screen.getByText('Test Button')).toBeInTheDocument();
    expect(screen.getByText('button')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument(); // confidence
    expect(screen.getByText('Text: "Click Me"')).toBeInTheDocument();
    expect(screen.getByText('ID: test-button')).toBeInTheDocument();
  });

  it('should call onSelectElement when "Use in Test" button is clicked', () => {
    render(
      <ElementPreviewCard
        element={mockElement}
        onSelectElement={mockOnSelectElement}
        onRequestScreenshot={mockOnRequestScreenshot}
      />
    );

    const useInTestButton = screen.getByText('Use in Test');
    fireEvent.click(useInTestButton);

    expect(mockOnSelectElement).toHaveBeenCalledWith(mockElement);
  });
});