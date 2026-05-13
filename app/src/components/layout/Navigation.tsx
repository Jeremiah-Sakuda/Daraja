import { useLocation, Link } from 'react-router-dom';
import { Home, MessageSquare, Languages, Pill, Clock, Settings } from 'lucide-react';

export function Navigation() {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/interview', icon: MessageSquare, label: 'Interview' },
    { path: '/quick-translate', icon: Languages, label: 'Translate' },
    { path: '/medication', icon: Pill, label: 'Meds' },
    { path: '/history', icon: Clock, label: 'History' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <nav className="sticky bottom-0 z-50 bg-white border-t border-daraja-100 safe-bottom no-print">
      <div className="flex items-center justify-around px-4 py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex flex-col items-center gap-1 px-4 py-2 rounded-xl
                transition-colors duration-200
                ${isActive
                  ? 'text-daraja-600'
                  : 'text-daraja-400 hover:text-daraja-600'
                }
              `}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className={`text-xs font-medium ${isActive ? 'font-semibold' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
