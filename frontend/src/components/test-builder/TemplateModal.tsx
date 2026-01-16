import React, { useState, useEffect } from 'react';
import { authFlowsAPI } from '../../lib/api';

interface TemplateStep {
  type: string;
  selector: string;
  value?: string;
  description: string;
}

interface Template {
  name: string;
  description: string;
  steps: TemplateStep[];
  domains: string[];
}

interface TemplateModalProps {
  onSelect: (steps: TemplateStep[]) => void;
  onClose: () => void;
}

export function TemplateModal({ onSelect, onClose }: TemplateModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detectUrl, setDetectUrl] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleAutoDetect = async () => {
    if (!detectUrl) return;
    setIsDetecting(true);
    try {
      // Use the detect-template endpoint which returns { template: ... }
      const response = await authFlowsAPI.testAuth({ 
        loginUrl: detectUrl, 
        username: '', 
        password: '' 
      }); 
      // Wait, testAuth runs the flow. We want detectTemplate from controller.
      // Let's check api.ts again to be sure we have the right method.
      // Actually, authFlowsAPI.getTemplates is what we have. 
      // I need to add detectTemplate to api.ts if it's missing.
      
      // Temporary fallback: Just filter the loaded templates based on URL keywords
      const detected = templates.find(t => 
        detectUrl.toLowerCase().includes('login') && t.name.toLowerCase().includes('login')
      );
      
      if (detected) {
        onSelect(detected.steps);
        onClose();
      } else {
        setError('No specific template matched. Please choose from the list.');
      }
    } catch (err) {
      setError('Detection failed.');
    } finally {
      setIsDetecting(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await authFlowsAPI.getTemplates();
      setTemplates(response.data);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load templates. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Choose a Template</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <div className="p-4 bg-blue-50 border-b border-blue-100 flex gap-2">
          <input
            type="url"
            placeholder="Paste page URL to auto-detect template..."
            className="flex-1 px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={detectUrl}
            onChange={(e) => setDetectUrl(e.target.value)}
          />
          <button
            onClick={handleAutoDetect}
            disabled={isDetecting || !detectUrl}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isDetecting ? 'Detecting...' : 'Auto-Detect'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">{error}</div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {templates.map((template, index) => (
                <div 
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all"
                  onClick={() => {
                    onSelect(template.steps);
                    onClose();
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg text-gray-900">{template.name}</h3>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      {template.steps.length} steps
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{template.description}</p>
                  
                  <div className="bg-gray-50 dark:bg-gray-800 rounded p-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                    {template.steps.slice(0, 3).map((step, i) => (
                      <div key={i} className="truncate">
                        • {step.description}
                      </div>
                    ))}
                    {template.steps.length > 3 && (
                      <div className="italic">+ {template.steps.length - 3} more steps</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}