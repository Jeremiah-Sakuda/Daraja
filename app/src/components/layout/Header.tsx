import { Wifi, WifiOff, Cloud } from 'lucide-react';

interface HeaderProps {
  isOnline: boolean;
  pendingCount: number;
}

export function Header({ isOnline, pendingCount }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-daraja-100 safe-top">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2">
          <svg className="w-8 h-8" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M10 70 Q50 30, 90 70"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              className="text-daraja-600"
            />
            <line x1="50" y1="70" x2="50" y2="40" stroke="currentColor" strokeWidth="6" strokeLinecap="round" className="text-daraja-600" />
          </svg>
          <span className="font-display font-bold text-xl text-daraja-800">Daraja</span>
        </a>

        {/* Status indicators */}
        <div className="flex items-center gap-3">
          {/* Sync status */}
          {pendingCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-caution-100 rounded-full">
              <Cloud className="w-4 h-4 text-caution-600" />
              <span className="text-xs font-medium text-caution-600">{pendingCount}</span>
            </div>
          )}

          {/* Online status */}
          <div className={`
            flex items-center gap-1.5 px-2.5 py-1 rounded-full
            ${isOnline ? 'bg-trust-100' : 'bg-daraja-100'}
          `}>
            {isOnline ? (
              <>
                <Wifi className="w-4 h-4 text-trust-600" />
                <span className="text-xs font-medium text-trust-600">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-daraja-500" />
                <span className="text-xs font-medium text-daraja-500">Offline</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
