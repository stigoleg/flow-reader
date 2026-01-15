import { useState, useEffect } from 'react';
import { isOnboardingCompleted, completeOnboarding } from '@/lib/storage';

interface OnboardingStep {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const STEPS: OnboardingStep[] = [
  {
    title: 'Welcome to FlowReader',
    description: 'A speed reading tool that helps you read faster and retain more. Let\'s get you started with a quick tour.',
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    title: 'Three Reading Modes',
    description: 'Pacing highlights text as you read. RSVP shows one word at a time. Bionic bolds word beginnings for faster scanning. Press M to cycle between modes.',
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
      </svg>
    ),
  },
  {
    title: 'Control Your Speed',
    description: 'Use the arrow keys to adjust your reading speed. Enable speed ramp-up in settings to gradually increase your pace as you get comfortable.',
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: 'Import Content',
    description: 'Click the Import button to load articles from URLs, paste text, or upload PDF/DOCX files. Your reading position is saved automatically.',
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    title: 'Keyboard Shortcuts',
    description: 'Space to play/pause, arrows to navigate, G to change granularity, B for bionic mode. Press ? anytime to see all shortcuts.',
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
  },
];

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    await completeOnboarding();
    onComplete();
  };

  const handleSkip = async () => {
    await completeOnboarding();
    onComplete();
  };

  const step = STEPS[currentStep];
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
        style={{ maxHeight: '90vh' }}
      >
        {/* Progress bar */}
        <div className="h-1 bg-gray-200">
          <div 
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-8 text-center">
          {/* Icon */}
          <div className="mb-6 flex justify-center text-blue-500">
            {step.icon}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {step.title}
          </h2>

          {/* Description */}
          <p className="text-gray-600 leading-relaxed mb-8">
            {step.description}
          </p>

          {/* Step indicators */}
          <div className="flex justify-center gap-2 mb-8">
            {STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  index === currentStep 
                    ? 'bg-blue-500' 
                    : index < currentStep 
                      ? 'bg-blue-300'
                      : 'bg-gray-300'
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-3 justify-center">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            )}
            
            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium"
            >
              {isLastStep ? 'Get Started' : 'Next'}
            </button>
          </div>

          {/* Skip link */}
          {!isLastStep && (
            <button
              onClick={handleSkip}
              className="mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip tutorial
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook to manage onboarding state
export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    isOnboardingCompleted().then((completed) => {
      setShowOnboarding(!completed);
      setChecked(true);
    });
  }, []);

  const close = () => setShowOnboarding(false);

  return { showOnboarding, close, checked };
}
