import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsAPI } from '../../lib/api';
import { useNotification } from '../../contexts/NotificationContext';

interface OnboardingWizardProps {
  onComplete: () => void;
  onClose: () => void;
}

export function OnboardingWizard({ onComplete, onClose }: OnboardingWizardProps) {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    url: ''
  });

  const handleCreateDemo = async () => {
    setIsSubmitting(true);
    try {
      const demoData = {
        name: 'Demo Project: Testim.io',
        description: 'A sample project to demonstrate automated testing capabilities.',
        urls: [
          {
            url: 'https://demo.testim.io/',
            title: 'Home Page',
            description: 'Main landing page'
          },
          {
            url: 'https://demo.testim.io/login',
            title: 'Login Page',
            description: 'Authentication page'
          }
        ]
      };

      const response = await projectsAPI.create(demoData);
      showSuccess('Demo Created', 'Demo project created successfully! Let\'s look at it.');
      onComplete();
      navigate(`/projects/${response.data.id}`);
    } catch (error) {
      console.error('Failed to create demo project:', error);
      showError('Error', 'Failed to create demo project.');
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.url) return;

    setIsSubmitting(true);
    try {
      const projectData = {
        name: formData.name,
        description: 'My first Nomation project',
        urls: [
          {
            url: formData.url,
            title: 'Starting Page',
            description: 'Main entry point'
          }
        ]
      };

      const response = await projectsAPI.create(projectData);
      showSuccess('Project Created', `Project "${formData.name}" created successfully!`);
      onComplete();
      navigate(`/projects/${response.data.id}`);
    } catch (error) {
      console.error('Failed to create project:', error);
      showError('Error', 'Failed to create project.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col min-h-[500px] animate-fade-in">
        
        {/* Header / Progress */}
        <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🚀</span>
            <span className="font-bold text-gray-800 text-lg">Welcome to Nomation</span>
          </div>
          <div className="flex space-x-2">
            <div className={`w-3 h-3 rounded-full transition-all ${step >= 1 ? 'bg-blue-600 scale-110' : 'bg-gray-300'}`} />
            <div className={`w-3 h-3 rounded-full transition-all ${step >= 2 ? 'bg-blue-600 scale-110' : 'bg-gray-300'}`} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
          
          {step === 1 && (
            <div className="space-y-8 animate-slide-up max-w-lg">
              <div className="text-6xl mb-4">👋</div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-3">Hi there! I'm your AI QA Partner.</h2>
                <p className="text-lg text-gray-600">
                  I help you create bulletproof automated tests in minutes, not days. 
                  Let's get your first project set up.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <button
                  onClick={() => setStep(2)}
                  className="group p-6 bg-blue-50 border-2 border-blue-100 rounded-xl hover:border-blue-500 hover:shadow-md transition-all text-left"
                >
                  <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">✨</div>
                  <h3 className="font-bold text-blue-900 mb-1">Create New Project</h3>
                  <p className="text-sm text-blue-700">I have a website I want to test right now.</p>
                </button>

                <button
                  onClick={handleCreateDemo}
                  disabled={isSubmitting}
                  className="group p-6 bg-purple-50 border-2 border-purple-100 rounded-xl hover:border-purple-500 hover:shadow-md transition-all text-left relative overflow-hidden"
                >
                  {isSubmitting && (
                    <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                    </div>
                  )}
                  <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">🎓</div>
                  <h3 className="font-bold text-purple-900 mb-1">Try Demo Project</h3>
                  <p className="text-sm text-purple-700">Show me how it works with a sample site.</p>
                </button>
              </div>
              
              <button 
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-sm underline"
              >
                Skip onboarding
              </button>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6 animate-slide-up text-left">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900">What are we testing?</h2>
                <p className="text-gray-600">Tell me about your application.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. My E-commerce App"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-lg"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Starting URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-lg font-mono text-blue-600"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
              </div>

              <div className="pt-4 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    '🚀 Create Project'
                  )}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
