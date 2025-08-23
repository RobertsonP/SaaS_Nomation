import React, { useState, useEffect } from 'react';
import { authFlowsAPI } from '../../lib/api';

interface AuthTemplate {
  name: string;
  description: string;
  domains: string[];
  steps: Array<{
    type: 'type' | 'click' | 'wait';
    selector: string;
    value?: string;
    description: string;
    timeout?: number;
    optional?: boolean;
  }>;
  successIndicators: string[];
  commonIssues: string[];
}

interface SimplifiedAuthSetupProps {
  projectId: string;
  onComplete: () => void;
  onCancel: () => void;
}

export const SimplifiedAuthSetup: React.FC<SimplifiedAuthSetupProps> = ({
  projectId,
  onComplete,
  onCancel
}) => {
  const [step, setStep] = useState<'credentials' | 'test' | 'review'>('credentials');
  const [, setTemplates] = useState<AuthTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<AuthTemplate | null>(null);
  
  const [credentials, setCredentials] = useState({
    name: 'Main Authentication',
    loginUrl: '',
    username: '',
    password: ''
  });
  
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      console.log('🔄 Loading auth templates...');
      const response = await authFlowsAPI.getTemplates();
      const templates = response.data;
      console.log(`✅ Loaded ${templates.length} auth templates`);
      
      setTemplates(templates);
      if (templates.length > 0) {
        setSelectedTemplate(templates[0]); // Select first template by default
        console.log(`📋 Selected default template: ${templates[0].name}`);
      }
    } catch (error: any) {
      console.error('❌ Failed to load templates:', error);
      console.error('❌ Error details:', error.response?.data || error.message);
      
      // Provide user feedback
      setTestResult({
        success: false,
        message: 'Failed to load authentication templates',
        suggestions: [
          'Check your internet connection',
          'Verify you are logged in',
          'Try refreshing the page'
        ]
      });
    }
  };

  const handleTestAuthentication = async () => {
    if (!selectedTemplate || !credentials.loginUrl || !credentials.username || !credentials.password) {
      console.warn('❌ Missing required fields for authentication test');
      setTestResult({
        success: false,
        message: 'Please fill in all required fields',
        suggestions: [
          'Enter the login URL (e.g., https://tts.am/login)',
          'Enter your username',
          'Enter your password',
          'Select an authentication template'
        ]
      });
      return;
    }

    console.log('🧪 Starting authentication test...');
    console.log(`📍 Login URL: ${credentials.loginUrl}`);
    console.log(`👤 Username: ${credentials.username}`);
    console.log(`🔑 Password: ${credentials.password.substring(0, 3)}***`);
    console.log(`📋 Template: ${selectedTemplate.name}`);
    console.log(`🔧 Steps: ${selectedTemplate.steps.length} steps`);

    setTesting(true);
    setTestResult(null); // Clear previous results
    
    try {
      const response = await authFlowsAPI.testAuth({
        loginUrl: credentials.loginUrl,
        username: credentials.username,
        password: credentials.password,
        steps: selectedTemplate.steps
      });
      
      const result = response.data;
      console.log('✅ Authentication test completed:', result);
      
      setTestResult(result);
      
      if (result.success) {
        console.log('🎉 Authentication test successful!');
        setStep('review');
      } else {
        console.log('❌ Authentication test failed:', result.message);
        console.log('💡 Suggestions:', result.suggestions);
      }
    } catch (error: any) {
      console.error('❌ Authentication test failed:', error);
      console.error('❌ Error details:', error.response?.data || error.message);
      
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      
      setTestResult({
        success: false,
        message: `Authentication test failed: ${errorMessage}`,
        suggestions: [
          'Check your internet connection',
          'Verify the login URL is correct',
          'Check if the username and password are correct',
          'Try testing manually on the website first'
        ]
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAuthFlow = async () => {
    if (!selectedTemplate) return;

    setSaving(true);
    try {
      await authFlowsAPI.create(projectId, {
        name: credentials.name,
        loginUrl: credentials.loginUrl,
        username: credentials.username,
        password: credentials.password,
        steps: selectedTemplate.steps
      });
      
      onComplete();
    } catch (error) {
      console.error('Failed to save auth flow:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">🔐 Simplified Authentication Setup</h2>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <div className={`px-2 py-1 rounded ${step === 'credentials' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}>
              1. Credentials
            </div>
            <div className={`px-2 py-1 rounded ${step === 'test' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}>
              2. Test
            </div>
            <div className={`px-2 py-1 rounded ${step === 'review' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}>
              3. Review
            </div>
          </div>
        </div>

        {step === 'credentials' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">How it works:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✅ We'll automatically detect the best authentication approach</li>
                <li>✅ Test your credentials safely before saving</li>
                <li>✅ Get detailed feedback if something goes wrong</li>
                <li>✅ No complex step configuration needed</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Authentication Flow Name
                </label>
                <input
                  type="text"
                  value={credentials.name}
                  onChange={(e) => setCredentials({...credentials, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Admin Login, User Portal"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Login Page URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={credentials.loginUrl}
                  onChange={(e) => setCredentials({...credentials, loginUrl: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="https://yoursite.com/login"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username/Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={credentials.username}
                  onChange={(e) => setCredentials({...credentials, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="your.username@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Your secure password"
                />
              </div>
            </div>

            {selectedTemplate && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Selected Template: {selectedTemplate.name}</h4>
                <p className="text-sm text-gray-600 mb-3">{selectedTemplate.description}</p>
                <div className="text-xs text-gray-500">
                  <strong>Steps:</strong> {selectedTemplate.steps.map(s => s.description).join(' → ')}
                </div>
              </div>
            )}

            <div className="flex space-x-4">
              <button
                onClick={() => setStep('test')}
                disabled={!credentials.loginUrl || !credentials.username || !credentials.password}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Test Authentication
              </button>
              <button
                onClick={onCancel}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {step === 'test' && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-medium mb-2">Testing Authentication...</h3>
              <p className="text-gray-600">We'll verify your credentials work correctly</p>
            </div>

            {!testResult && !testing && (
              <div className="text-center">
                <button
                  onClick={handleTestAuthentication}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
                >
                  Start Authentication Test
                </button>
              </div>
            )}

            {testing && (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                <p className="text-gray-600">Testing authentication flow...</p>
              </div>
            )}

            {testResult && (
              <div className={`p-4 rounded-lg ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center mb-3">
                  <span className={`text-2xl mr-3 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.success ? '✅' : '❌'}
                  </span>
                  <h4 className={`font-medium ${testResult.success ? 'text-green-900' : 'text-red-900'}`}>
                    {testResult.success ? 'Authentication Successful!' : 'Authentication Failed'}
                  </h4>
                </div>
                
                <p className={`text-sm mb-3 ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {testResult.message}
                </p>

                {testResult.details && (
                  <div className="text-sm space-y-2">
                    <p><strong>Steps completed:</strong> {testResult.details.stepsCompleted}/{testResult.details.totalSteps}</p>
                    {testResult.details.finalUrl && (
                      <p><strong>Final URL:</strong> {testResult.details.finalUrl}</p>
                    )}
                  </div>
                )}

                {testResult.suggestions && testResult.suggestions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium mb-1">Suggestions:</p>
                    <ul className="text-sm list-disc list-inside space-y-1">
                      {testResult.suggestions.map((suggestion: string, idx: number) => (
                        <li key={idx}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex space-x-4">
              <button
                onClick={() => setStep('credentials')}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                ← Back to Credentials
              </button>
              
              {testResult?.success && (
                <button
                  onClick={() => setStep('review')}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Continue to Review
                </button>
              )}
              
              {testResult && !testResult.success && (
                <button
                  onClick={handleTestAuthentication}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        )}

        {step === 'review' && testResult?.success && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="text-green-600 text-4xl mb-4">✅</div>
              <h3 className="text-lg font-medium mb-2">Authentication Ready!</h3>
              <p className="text-gray-600">Your authentication flow has been tested and is ready to use</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Flow Name:</span>
                <span>{credentials.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium">Login URL:</span>
                <span className="truncate ml-2">{credentials.loginUrl}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium">Template:</span>
                <span>{selectedTemplate?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-medium">Success Rate:</span>
                <span className="text-green-600">Verified ✓</span>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={handleSaveAuthFlow}
                disabled={saving}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {saving ? 'Saving...' : 'Save Authentication Flow'}
              </button>
              <button
                onClick={() => setStep('test')}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                ← Test Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};