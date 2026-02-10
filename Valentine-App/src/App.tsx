import React from 'react';
import { useValentineStore } from './store';
import { WelcomeScreen } from './components/WelcomeScreen';
import { PhotoGallery } from './components/PhotoGallery';
import { QuestionsFlow } from './components/QuestionsFlow';
import { ProposalScreen } from './components/ProposalScreen';
import { FinalScreen } from './components/FinalScreen';

function App() {
  const { currentStep } = useValentineStore();

  return (
    <div className="w-full min-h-screen">
      {currentStep === 'welcome' && <WelcomeScreen />}
      {currentStep === 'photos' && <PhotoGallery />}
      {currentStep === 'questions' && <QuestionsFlow />}
      {currentStep === 'proposal' && <ProposalScreen />}
      {currentStep === 'final' && <FinalScreen />}
    </div>
  );
}

export default App;
