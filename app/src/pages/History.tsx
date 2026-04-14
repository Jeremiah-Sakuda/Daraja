import { useState, useEffect, useCallback } from 'react';
import { Search, Clock, ChevronRight, Trash2, Download, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useOfflineSync } from '../hooks/useOfflineSync';

interface SessionSummary {
  id: string;
  workflowType: string;
  workflowName: string;
  languagePair: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  questionsCompleted: number;
  questionsTotal: number;
  flaggedCount: number;
  duration?: number;
  startedAt: string;
  completedAt?: string;
}

// Mock data for demonstration
const MOCK_SESSIONS: SessionSummary[] = [
  {
    id: 'session_1713091200_abc123',
    workflowType: 'rsd-interview',
    workflowName: 'RSD Interview',
    languagePair: 'Somali → Swahili',
    status: 'completed',
    questionsCompleted: 15,
    questionsTotal: 15,
    flaggedCount: 2,
    duration: 32,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  },
  {
    id: 'session_1713084000_def456',
    workflowType: 'medical-intake',
    workflowName: 'Medical Intake',
    languagePair: 'Somali → Swahili',
    status: 'in_progress',
    questionsCompleted: 8,
    questionsTotal: 12,
    flaggedCount: 0,
    startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'session_1713004800_ghi789',
    workflowType: 'legal-declaration',
    workflowName: 'Legal Declaration',
    languagePair: 'Somali → Swahili',
    status: 'completed',
    questionsCompleted: 10,
    questionsTotal: 10,
    flaggedCount: 0,
    duration: 45,
    startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
  },
];

export function History() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const { pendingCount, isOnline } = useOfflineSync();

  // Load sessions (mock for demo)
  useEffect(() => {
    const loadSessions = async () => {
      setIsLoading(true);
      // Simulate loading delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      setSessions(MOCK_SESSIONS);
      setIsLoading(false);
    };

    loadSessions();
  }, []);

  // Filter sessions by search
  const filteredSessions = sessions.filter((session) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      session.workflowName.toLowerCase().includes(query) ||
      session.languagePair.toLowerCase().includes(query) ||
      session.id.toLowerCase().includes(query)
    );
  });

  // Group sessions by date
  const groupedSessions = filteredSessions.reduce(
    (groups, session) => {
      const date = new Date(session.startedAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let groupKey: string;
      if (date.toDateString() === today.toDateString()) {
        groupKey = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        groupKey = 'Yesterday';
      } else {
        groupKey = date.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(session);
      return groups;
    },
    {} as Record<string, SessionSummary[]>
  );

  const handleDeleteSession = useCallback((sessionId: string) => {
    if (confirm('Are you sure you want to delete this session?')) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    }
  }, []);

  const handleExportSession = useCallback((sessionId: string) => {
    // In production, this would generate and download the PDF
    console.log('Exporting session:', sessionId);
    alert('PDF export would be triggered here');
  }, []);

  const formatTime = (isoString: string): string => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: SessionSummary['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-trust-600" />;
      case 'in_progress':
        return (
          <div className="w-5 h-5 rounded-full border-2 border-daraja-500 border-t-transparent animate-spin" />
        );
      case 'abandoned':
        return <AlertCircle className="w-5 h-5 text-alert-500" />;
    }
  };

  const getStatusLabel = (status: SessionSummary['status']) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      case 'abandoned':
        return 'Abandoned';
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6">
      <div>
        <h1 className="section-header">Session History</h1>
        <p className="text-sm text-daraja-500">
          View and manage past interview sessions
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-daraja-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search sessions..."
          className="input-field pl-12"
        />
      </div>

      {/* Pending sync banner */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-caution-50 border border-caution-200">
          {isOnline ? (
            <Loader2 className="w-5 h-5 text-caution-600 animate-spin" />
          ) : (
            <AlertCircle className="w-5 h-5 text-caution-600" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-caution-700">
              {pendingCount} session{pendingCount > 1 ? 's' : ''} pending sync
            </p>
            <p className="text-xs text-caution-600">
              {isOnline ? 'Syncing now...' : 'Will sync when online'}
            </p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-daraja-500 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && sessions.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Clock className="w-16 h-16 text-daraja-300 mb-4" />
          <h2 className="text-xl font-semibold text-daraja-800 mb-2">
            No sessions yet
          </h2>
          <p className="text-daraja-500 mb-6">
            Start an interview to see your history here
          </p>
          <a href="/interview" className="btn-primary">
            Start Interview
          </a>
        </div>
      )}

      {/* No search results */}
      {!isLoading && sessions.length > 0 && filteredSessions.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Search className="w-12 h-12 text-daraja-300 mb-4" />
          <p className="text-daraja-600">
            No sessions match "{searchQuery}"
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="btn-ghost mt-4"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Session list */}
      {!isLoading && filteredSessions.length > 0 && (
        <div className="space-y-6">
          {Object.entries(groupedSessions).map(([date, dateSessions]) => (
            <div key={date}>
              <h2 className="text-sm font-semibold text-daraja-500 uppercase tracking-wide mb-3">
                {date}
              </h2>
              <div className="space-y-3">
                {dateSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`card-interactive ${
                      selectedSession === session.id ? 'ring-2 ring-daraja-500' : ''
                    }`}
                    onClick={() => setSelectedSession(
                      selectedSession === session.id ? null : session.id
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 mt-1">
                        {getStatusIcon(session.status)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-semibold text-daraja-900 truncate">
                            {session.workflowName}
                          </h3>
                          <span className="text-xs text-daraja-500 flex-shrink-0">
                            {formatTime(session.startedAt)}
                          </span>
                        </div>

                        <p className="text-sm text-daraja-600">
                          {session.languagePair}
                        </p>

                        <div className="flex items-center gap-4 mt-2 text-xs text-daraja-500">
                          {session.duration && (
                            <span>{session.duration} min</span>
                          )}
                          <span>
                            {session.questionsCompleted}/{session.questionsTotal} questions
                          </span>
                          {session.flaggedCount > 0 && (
                            <span className="text-caution-600">
                              {session.flaggedCount} flagged
                            </span>
                          )}
                        </div>

                        <div className="mt-2">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              session.status === 'completed'
                                ? 'bg-trust-100 text-trust-700'
                                : session.status === 'in_progress'
                                ? 'bg-daraja-100 text-daraja-700'
                                : 'bg-alert-100 text-alert-700'
                            }`}
                          >
                            {getStatusLabel(session.status)}
                          </span>
                        </div>
                      </div>

                      <ChevronRight className="w-5 h-5 text-daraja-400 flex-shrink-0" />
                    </div>

                    {/* Expanded actions */}
                    {selectedSession === session.id && (
                      <div
                        className="flex gap-2 mt-4 pt-4 border-t border-daraja-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {session.status === 'in_progress' && (
                          <a
                            href={`/interview?resume=${session.id}`}
                            className="btn-primary flex-1 text-sm"
                          >
                            Resume
                          </a>
                        )}

                        {session.status === 'completed' && (
                          <button
                            onClick={() => handleExportSession(session.id)}
                            className="btn-secondary flex-1 text-sm"
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Export PDF
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteSession(session.id)}
                          className="btn-ghost text-alert-600 hover:bg-alert-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
