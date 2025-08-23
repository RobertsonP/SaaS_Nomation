import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { SimplifiedAuthSetup } from '../../components/auth/SimplifiedAuthSetup';

export function AuthSetupPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editAuthFlowId = searchParams.get('edit');

  const handleComplete = () => {
    // Navigate back to project details page after successful auth setup
    navigate(`/projects/${projectId}`);
  };

  const handleCancel = () => {
    // Navigate back to project details page if user cancels
    navigate(`/projects/${projectId}`);
  };

  if (!projectId) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Project</h1>
          <p className="text-gray-600">Project ID is missing from the URL.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <SimplifiedAuthSetup
        projectId={projectId}
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    </div>
  );
}