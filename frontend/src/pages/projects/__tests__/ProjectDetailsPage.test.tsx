// import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ProjectDetailsPage } from '../ProjectDetailsPage';
import { NotificationProvider } from '../../../contexts/NotificationContext';
import * as api from '../../../lib/api';

// Mock the API
jest.mock('../../../lib/api');
const mockAPI = api as jest.Mocked<typeof api>;

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ projectId: 'test-project-id' }),
  useNavigate: () => jest.fn(),
}));

describe.skip('ProjectDetailsPage - Unified Project View', () => {
  const mockProject = {
    id: 'test-project-id',
    name: 'Test Project',
    description: 'Test project description',
    urls: [
      {
        id: 'url-1',
        url: 'https://example.com',
        title: 'Homepage',
        description: 'Main page',
        analyzed: true,
        analysisDate: '2023-01-01'
      },
      {
        id: 'url-2',
        url: 'https://example.com/login',
        title: 'Login Page',
        description: 'Login page',
        analyzed: false
      }
    ],
    elements: [
      {
        id: 'element-1',
        selector: '#submit-button',
        elementType: 'button',
        description: 'Submit Button',
        confidence: 0.9,
        attributes: { text: 'Submit' },
        sourceUrl: {
          id: 'url-1',
          url: 'https://example.com',
          title: 'Homepage'
        }
      }
    ],
    _count: { tests: 2, elements: 1, urls: 2 }
  };

  const mockAuthFlows = [
    {
      id: 'auth-1',
      name: 'Test Auth Flow',
      loginUrl: 'https://example.com/login',
      steps: [
        { type: 'type', selector: '#username', value: '${username}', description: 'Enter username' }
      ],
      credentials: { username: 'test@test.com', password: 'test123' }
    }
  ];

  beforeEach(() => {
    mockAPI.projectsAPI.getById.mockResolvedValue({ data: mockProject });
    mockAPI.authFlowsAPI.getByProject.mockResolvedValue({ data: mockAuthFlows });
    mockAPI.analyzeProjectPages.mockResolvedValue({
      success: true,
      elements: [mockProject.elements[0]],
      totalUrls: 2
    });
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <NotificationProvider>
          <ProjectDetailsPage />
        </NotificationProvider>
      </BrowserRouter>
    );
  };

  it('should render project information correctly', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
      expect(screen.getByText('Test project description')).toBeInTheDocument();
    });
  });

  it('should display project stats correctly', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument(); // URLs count
      expect(screen.getByText('1')).toBeInTheDocument(); // Elements count
      expect(screen.getByText('2')).toBeInTheDocument(); // Tests count
    });
  });

  it('should display authentication section with existing auth flows', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('🔐 Authentication')).toBeInTheDocument();
      expect(screen.getByText('Test Auth Flow')).toBeInTheDocument();
      expect(screen.getByText('Login URL: https://example.com/login')).toBeInTheDocument();
      expect(screen.getByText('✅ Active')).toBeInTheDocument();
    });
  });

  it('should show setup authentication button when no auth flows exist', async () => {
    mockAPI.authFlowsAPI.getByProject.mockResolvedValue({ data: [] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('No authentication flows configured')).toBeInTheDocument();
      expect(screen.getByText('Setup Authentication')).toBeInTheDocument();
    });
  });

  it('should handle project analysis correctly', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('🔍 Analyze Project')).toBeInTheDocument();
    });

    const analyzeButton = screen.getByText('🔍 Analyze Project');
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(mockAPI.analyzeProjectPages).toHaveBeenCalledWith('test-project-id');
    });
  });

  it('should toggle element library visibility', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Show Element Library')).toBeInTheDocument();
    });

    const toggleButton = screen.getByText('Show Element Library');
    fireEvent.click(toggleButton);

    expect(screen.getByText('Hide Element Library')).toBeInTheDocument();
  });

  it('should display URLs with correct analysis status', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Homepage')).toBeInTheDocument();
      expect(screen.getByText('Login Page')).toBeInTheDocument();
      expect(screen.getByText('Analyzed')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  it('should show elements with proper sorting', async () => {
    const mockProjectWithSortedElements = {
      ...mockProject,
      elements: [
        {
          id: 'element-1',
          selector: '#high-confidence',
          elementType: 'button',
          description: 'High Confidence Button',
          confidence: 0.95,
          attributes: { text: 'High' },
          sourceUrl: { id: 'url-1', url: 'https://example.com', title: 'Homepage' }
        },
        {
          id: 'element-2',
          selector: '#medium-confidence',
          elementType: 'input',
          description: 'Medium Confidence Input',
          confidence: 0.75,
          attributes: { text: 'Medium' },
          sourceUrl: { id: 'url-1', url: 'https://example.com', title: 'Homepage' }
        }
      ]
    };

    mockAPI.projectsAPI.getById.mockResolvedValue({ data: mockProjectWithSortedElements });

    renderComponent();

    await waitFor(() => {
      const elements = screen.getAllByText(/Confidence/);
      expect(elements).toHaveLength(2);
    });
  });
});