// import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ProjectsPage } from '../ProjectsPage';
import { NotificationProvider } from '../../../contexts/NotificationContext';
import * as api from '../../../lib/api';

// Mock the API
jest.mock('../../../lib/api');
const mockAPI = api as jest.Mocked<typeof api>;

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

describe.skip('ProjectsPage - Auth Form Fix', () => {
  const mockProjects = [
    {
      id: 'project-1',
      name: 'Test Project',
      description: 'Test description',
      urls: [
        { id: 'url-1', url: 'https://example.com', title: 'Homepage' }
      ],
      createdAt: '2023-01-01',
      _count: { tests: 1, elements: 5 }
    }
  ];

  const mockAuthFlows = [
    {
      id: 'auth-1',
      name: 'Existing Auth Flow',
      loginUrl: 'https://example.com/login',
      steps: [
        { type: 'type', selector: '#username', value: '${username}', description: 'Enter username' },
        { type: 'type', selector: '#password', value: '${password}', description: 'Enter password' }
      ],
      credentials: { username: 'existing@test.com', password: 'existing123' }
    }
  ];

  beforeEach(() => {
    mockAPI.projectsAPI.getAll.mockResolvedValue({ data: mockProjects });
    mockAPI.authFlowsAPI.getByProject.mockResolvedValue({ data: mockAuthFlows });
    mockAPI.authFlowsAPI.create.mockResolvedValue({ data: mockAuthFlows[0] });
    mockAPI.analyzeProjectPages.mockResolvedValue({
      success: true,
      elements: [],
      totalUrls: 1
    });
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <NotificationProvider>
          <ProjectsPage />
        </NotificationProvider>
      </BrowserRouter>
    );
  };

  it('should render projects list correctly', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Test Project')).toBeInTheDocument();
      expect(screen.getByText('Test description')).toBeInTheDocument();
      expect(screen.getByText('1 tests')).toBeInTheDocument();
      expect(screen.getByText('5 elements')).toBeInTheDocument();
    });
  });

  it('should load existing auth flow data when auth button is clicked', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('🔐 Auth')).toBeInTheDocument();
    });

    const authButton = screen.getByText('🔐 Auth');
    fireEvent.click(authButton);

    await waitFor(() => {
      expect(mockAPI.authFlowsAPI.getByProject).toHaveBeenCalledWith('project-1');
    });

    // Check that form is populated with existing data
    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing Auth Flow')).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://example.com/login')).toBeInTheDocument();
      expect(screen.getByDisplayValue('existing@test.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('existing123')).toBeInTheDocument();
    });
  });

  it('should show empty form when no existing auth flows', async () => {
    mockAPI.authFlowsAPI.getByProject.mockResolvedValue({ data: [] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('🔐 Auth')).toBeInTheDocument();
    });

    const authButton = screen.getByText('🔐 Auth');
    fireEvent.click(authButton);

    await waitFor(() => {
      // Should have empty form with default values
      expect(screen.getByPlaceholderText('e.g., Admin Login, User Portal Access')).toHaveValue('');
      expect(screen.getByPlaceholderText('https://yoursite.com/login')).toHaveValue('');
      expect(screen.getByPlaceholderText('your.username@example.com')).toHaveValue('');
      expect(screen.getByPlaceholderText('Your secure password')).toHaveValue('');
    });
  });

  it('should handle API error when loading auth flows', async () => {
    mockAPI.authFlowsAPI.getByProject.mockRejectedValue(new Error('API Error'));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('🔐 Auth')).toBeInTheDocument();
    });

    const authButton = screen.getByText('🔐 Auth');
    fireEvent.click(authButton);

    // Should still show form with default values even if API fails
    await waitFor(() => {
      expect(screen.getByPlaceholderText('e.g., Admin Login, User Portal Access')).toBeInTheDocument();
    });
  });

  it('should show default auth steps when no existing auth flows', async () => {
    mockAPI.authFlowsAPI.getByProject.mockResolvedValue({ data: [] });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('🔐 Auth')).toBeInTheDocument();
    });

    const authButton = screen.getByText('🔐 Auth');
    fireEvent.click(authButton);

    await waitFor(() => {
      // Should have default steps
      expect(screen.getByDisplayValue('#username')).toBeInTheDocument();
      expect(screen.getByDisplayValue('#password')).toBeInTheDocument();
      expect(screen.getByDisplayValue('#login-button')).toBeInTheDocument();
    });
  });

  it('should preserve existing auth steps when loading auth flows', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('🔐 Auth')).toBeInTheDocument();
    });

    const authButton = screen.getByText('🔐 Auth');
    fireEvent.click(authButton);

    await waitFor(() => {
      // Should preserve existing steps
      expect(screen.getByDisplayValue('#username')).toBeInTheDocument();
      expect(screen.getByDisplayValue('#password')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Enter username')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Enter password')).toBeInTheDocument();
    });
  });

  it('should call save auth flow with correct data', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('🔐 Auth')).toBeInTheDocument();
    });

    const authButton = screen.getByText('🔐 Auth');
    fireEvent.click(authButton);

    await waitFor(() => {
      expect(screen.getByText('Save Authentication')).toBeInTheDocument();
    });

    const saveButton = screen.getByText('Save Authentication');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockAPI.authFlowsAPI.create).toHaveBeenCalledWith('project-1', {
        name: 'Existing Auth Flow',
        loginUrl: 'https://example.com/login',
        username: 'existing@test.com',
        password: 'existing123',
        steps: expect.any(Array)
      });
    });
  });
});