/**
 * AgentSmith Onboarding Wizard
 * Guides new users through setting up their first workflow
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  content: React.ReactNode;
}

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const navigate = useNavigate();

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to AgentSmith',
      description: 'Your powerful workflow automation platform',
      icon: '👋',
      content: <WelcomeStep />,
    },
    {
      id: 'concepts',
      title: 'Key Concepts',
      description: 'Learn the basics of workflow automation',
      icon: '💡',
      content: <ConceptsStep />,
    },
    {
      id: 'first-workflow',
      title: 'Create Your First Workflow',
      description: 'Build a simple automation in minutes',
      icon: '🚀',
      content: <FirstWorkflowStep />,
    },
    {
      id: 'templates',
      title: 'Explore Templates',
      description: 'Start with pre-built workflows',
      icon: '📋',
      content: <TemplatesStep />,
    },
    {
      id: 'complete',
      title: "You're Ready!",
      description: 'Start automating your work',
      icon: '🎉',
      content: <CompleteStep />,
    },
  ];

  const handleNext = () => {
    setCompletedSteps(prev => new Set([...prev, currentStep]));
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4 overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-gray-200">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 py-4 border-b">
          {steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => completedSteps.has(index) && setCurrentStep(index)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${
                index === currentStep
                  ? 'bg-blue-600 text-white'
                  : completedSteps.has(index)
                  ? 'bg-green-500 text-white cursor-pointer'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {completedSteps.has(index) ? '✓' : index + 1}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="text-center mb-6">
            <span className="text-5xl mb-4 block">{steps[currentStep].icon}</span>
            <h2 className="text-2xl font-bold text-gray-900">
              {steps[currentStep].title}
            </h2>
            <p className="text-gray-600 mt-2">{steps[currentStep].description}</p>
          </div>

          <div className="min-h-[300px]">{steps[currentStep].content}</div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center px-8 py-4 bg-gray-50 border-t">
          <button
            onClick={handleSkip}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            Skip tutorial
          </button>

          <div className="flex gap-3">
            {currentStep > 0 && (
              <button
                onClick={handlePrevious}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Previous
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Step Components
function WelcomeStep() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <FeatureCard
          icon="⚡"
          title="Automate Anything"
          description="Connect apps and automate repetitive tasks"
        />
        <FeatureCard
          icon="🔗"
          title="126+ Integrations"
          description="Connect to your favorite tools and services"
        />
        <FeatureCard
          icon="🤖"
          title="AI-Powered"
          description="Use AI agents to handle complex tasks"
        />
      </div>
      <p className="text-center text-gray-600">
        AgentSmith helps you automate your work without writing code.
        <br />
        Let's get you started in just a few minutes!
      </p>
    </div>
  );
}

function ConceptsStep() {
  return (
    <div className="space-y-4">
      <ConceptCard
        icon="📦"
        title="Nodes"
        description="Nodes are the building blocks of your workflow. Each node performs a specific action like sending an email, making an API call, or processing data."
      />
      <ConceptCard
        icon="➡️"
        title="Connections"
        description="Connect nodes together to pass data from one to another. Data flows from left to right through your workflow."
      />
      <ConceptCard
        icon="⏰"
        title="Triggers"
        description="Triggers start your workflow automatically. You can trigger on a schedule, when receiving a webhook, or manually."
      />
      <ConceptCard
        icon="🔑"
        title="Credentials"
        description="Credentials store your API keys and authentication details securely. Set them up once and reuse across workflows."
      />
    </div>
  );
}

function FirstWorkflowStep() {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Quick Tutorial</h3>
        <ol className="list-decimal list-inside space-y-2 text-blue-800">
          <li>Click "New Workflow" on the dashboard</li>
          <li>Drag a trigger node (like "Manual Trigger") to the canvas</li>
          <li>Add action nodes by clicking the + button</li>
          <li>Connect nodes by dragging from one handle to another</li>
          <li>Click "Execute" to run your workflow</li>
        </ol>
      </div>

      <div className="flex justify-center">
        <img
          src="/workflow-demo.gif"
          alt="Workflow creation demo"
          className="rounded-lg shadow-lg max-w-full h-auto"
          onError={(e) => {
            // Hide if image doesn't exist
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>

      <div className="text-center">
        <p className="text-gray-600 mb-4">
          Don't worry - you can always access help by pressing{' '}
          <kbd className="px-2 py-1 bg-gray-200 rounded text-sm">?</kbd> anywhere in the app.
        </p>
      </div>
    </div>
  );
}

function TemplatesStep() {
  const templates = [
    {
      name: 'Slack Notification on Form Submit',
      description: 'Send a Slack message when a form is submitted',
      icon: '💬',
      category: 'Communication',
    },
    {
      name: 'Daily Data Backup',
      description: 'Automatically backup data to cloud storage',
      icon: '💾',
      category: 'Data',
    },
    {
      name: 'Social Media Monitor',
      description: 'Track brand mentions across platforms',
      icon: '📱',
      category: 'Social',
    },
    {
      name: 'Lead Enrichment',
      description: 'Automatically enrich new leads with company data',
      icon: '👤',
      category: 'Sales',
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-center text-gray-600 mb-4">
        Start with a template and customize it to your needs:
      </p>
      <div className="grid grid-cols-2 gap-3">
        {templates.map((template) => (
          <div
            key={template.name}
            className="p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{template.icon}</span>
              <div>
                <h4 className="font-medium text-gray-900">{template.name}</h4>
                <p className="text-sm text-gray-500">{template.description}</p>
                <span className="inline-block mt-2 text-xs px-2 py-1 bg-gray-100 rounded">
                  {template.category}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompleteStep() {
  return (
    <div className="text-center space-y-6">
      <div className="text-6xl">🎉</div>
      <h3 className="text-xl font-semibold text-gray-900">
        You're all set to start automating!
      </h3>
      <div className="space-y-3 text-gray-600">
        <p>Here are some quick tips:</p>
        <ul className="text-left max-w-md mx-auto space-y-2">
          <li className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            Press <kbd className="px-2 py-1 bg-gray-200 rounded text-xs">Ctrl+K</kbd> for quick search
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            Double-click canvas to add a new node
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            Right-click nodes for more options
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-500">✓</span>
            Use the help button <span className="text-blue-500">(?)</span> for documentation
          </li>
        </ul>
      </div>
    </div>
  );
}

// Helper Components
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center p-4 bg-gray-50 rounded-lg">
      <span className="text-3xl mb-2 block">{icon}</span>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600 mt-1">{description}</p>
    </div>
  );
}

function ConceptCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
      <span className="text-2xl">{icon}</span>
      <div>
        <h4 className="font-semibold text-gray-900">{title}</h4>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </div>
  );
}

export default OnboardingWizard;
