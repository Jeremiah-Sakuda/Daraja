import { Routes, Route } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { Navigation } from './components/layout/Navigation';
import { InterviewSession } from './components/interview/InterviewSession';
import { WorkflowSelection } from './pages/WorkflowSelection';
import { QuickTranslate } from './pages/QuickTranslate';
import { MedicationSafety } from './pages/MedicationSafety';
import { History } from './pages/History';
import { Settings } from './pages/Settings';
import { useOfflineSync } from './hooks/useOfflineSync';

// Home page component
function HomePage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-hero">
      <div className="max-w-md text-center">
        {/* Logo */}
        <div className="w-24 h-24 mx-auto mb-6">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M10 70 Q50 30, 90 70"
              stroke="currentColor"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              className="text-daraja-600"
            />
            <line x1="25" y1="70" x2="25" y2="55" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="text-daraja-600" />
            <line x1="50" y1="70" x2="50" y2="40" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="text-daraja-600" />
            <line x1="75" y1="70" x2="75" y2="55" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="text-daraja-600" />
            <line x1="5" y1="70" x2="95" y2="70" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="text-daraja-600" />
          </svg>
        </div>

        <h1 className="text-4xl font-display font-bold text-daraja-800 mb-3">
          Daraja
        </h1>
        <p className="text-lg text-daraja-600 mb-8">
          Building bridges through translation
        </p>

        {/* Language pairs */}
        <div className="card mb-8">
          <h2 className="text-sm font-semibold text-daraja-500 uppercase tracking-wide mb-4">
            Supported Language Pairs
          </h2>
          <div className="space-y-3">
            <LanguagePairCard
              source="Somali"
              target="Swahili"
              status="active"
            />
            <LanguagePairCard
              source="Tigrinya"
              target="Arabic"
              status="coming"
            />
            <LanguagePairCard
              source="Dari"
              target="Turkish"
              status="coming"
            />
          </div>
        </div>

        {/* Start button */}
        <a href="/interview" className="btn-primary w-full text-lg">
          Start Interview Session
        </a>

        {/* Offline status */}
        <p className="text-sm text-daraja-500 mt-6">
          Works offline after initial setup
        </p>
      </div>
    </div>
  );
}

interface LanguagePairCardProps {
  source: string;
  target: string;
  status: 'active' | 'coming';
}

function LanguagePairCard({ source, target, status }: LanguagePairCardProps) {
  return (
    <div className={`
      flex items-center justify-between p-3 rounded-xl
      ${status === 'active' ? 'bg-trust-50 border border-trust-200' : 'bg-daraja-50 border border-daraja-100'}
    `}>
      <div className="flex items-center gap-2">
        <span className="font-medium text-daraja-800">{source}</span>
        <svg className="w-4 h-4 text-daraja-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
        <span className="font-medium text-daraja-800">{target}</span>
      </div>
      {status === 'active' ? (
        <span className="badge-confidence high">Ready</span>
      ) : (
        <span className="text-xs text-daraja-500">Coming soon</span>
      )}
    </div>
  );
}


function App() {
  const { isOnline, pendingCount } = useOfflineSync();

  return (
    <div className="min-h-screen flex flex-col bg-daraja-50">
      <Header isOnline={isOnline} pendingCount={pendingCount} />

      <main className="flex-1 flex flex-col">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/interview" element={<WorkflowSelection />} />
          <Route path="/interview/:workflowType" element={<InterviewSession />} />
          <Route path="/quick-translate" element={<QuickTranslate />} />
          <Route path="/medication" element={<MedicationSafety />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      <Navigation />
    </div>
  );
}

export default App;
