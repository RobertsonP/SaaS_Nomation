import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Auto-redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center space-x-2">
          <div className="text-3xl">🤖</div>
          <span className="text-xl font-bold tracking-tight">SaaS Nomation</span>
        </div>
        <div className="flex items-center space-x-4">
          {isAuthenticated ? (
            <Link to="/dashboard" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium">
                Log In
              </Link>
              <Link to="/register" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <header className="px-6 py-20 text-center max-w-5xl mx-auto">
        <div className="inline-block px-3 py-1 mb-6 text-xs font-semibold tracking-wider text-blue-600 uppercase bg-blue-50 rounded-full">
          New: AI-Powered Element Discovery
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 mb-8 leading-tight">
          Bulletproof Automated Testing for <span className="text-blue-600">Modern SaaS</span>
        </h1>
        <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto">
          Create, run, and maintain end-to-end tests in minutes.
          Our AI auto-heals broken selectors so your tests never flake.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
          <Link to="/register" className="px-8 py-4 bg-blue-600 text-white text-lg font-bold rounded-xl hover:bg-blue-700 transition shadow-lg hover:shadow-xl w-full sm:w-auto">
            Start Testing for Free
          </Link>
          <a href="#features" className="px-8 py-4 bg-white text-gray-700 border border-gray-200 text-lg font-bold rounded-xl hover:bg-gray-50 transition w-full sm:w-auto">
            View Features
          </a>
        </div>
        
        {/* Hero Image / Placeholder */}
        <div className="mt-16 rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
          <div className="bg-gray-100 p-2 flex items-center space-x-2 border-b border-gray-200">
            <div className="w-3 h-3 bg-red-400 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
            <div className="flex-1 bg-white rounded-md h-6 mx-2"></div>
          </div>
          <div className="bg-white p-8 h-96 flex items-center justify-center bg-gradient-to-br from-blue-50 to-white">
            <div className="text-center">
              <div className="text-6xl mb-4">🎥</div>
              <p className="text-gray-400 font-medium">Video Recording & Time-Travel Debugging Active</p>
            </div>
          </div>
        </div>
      </header>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Everything you need to ship with confidence</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon="🤖" 
              title="AI-Powered Selectors" 
              desc="Our advanced generator analyzes the DOM to create resilient selectors that survive UI changes."
            />
            <FeatureCard 
              icon="📹" 
              title="Video Evidence" 
              desc="Every test run is recorded. Watch exactly what happened during failures with our time-travel player."
            />
            <FeatureCard 
              icon="🛡️" 
              title="Self-Healing" 
              desc="Tests adapt to your code. If a selector breaks, we automatically find the new element."
            />
            <FeatureCard 
              icon="🐙" 
              title="GitHub Integration" 
              desc="Import your repository directly. We analyze your code to auto-discover pages and routes."
            />
            <FeatureCard 
              icon="⚡" 
              title="Parallel Execution" 
              desc="Run hundreds of tests simultaneously with our scalable containerized infrastructure."
            />
            <FeatureCard 
              icon="📊" 
              title="Visual Reporting" 
              desc="Professional Robot Framework-style reports with screenshots and detailed logs."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-12 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <span className="text-2xl">🤖</span>
            <span className="font-bold text-gray-900">SaaS Nomation</span>
          </div>
          <div className="text-gray-500 text-sm">
            © 2025 SaaS Nomation. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string, title: string, desc: string }) {
  return (
    <div className="bg-white p-8 rounded-xl shadow-sm hover:shadow-md transition border border-gray-100">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{desc}</p>
    </div>
  );
}