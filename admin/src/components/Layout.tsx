import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const nav = [
  { to: '/', label: 'Обзор' },
  { to: '/kppdf', label: 'KPPDF' },
  { to: '/google-sheets', label: 'Google Таблица' },
  { to: '/jobs', label: 'Задачи' },
  { to: '/news-settings', label: 'Новости: поиск' },
  { to: '/news', label: 'Новости' },
  { to: '/knowledge', label: 'Знания' },
  { to: '/providers', label: 'Провайдеры AI' },
  { to: '/models', label: 'Модели' },
  { to: '/runs', label: 'Запуски' },
];

export function Layout() {
  const { username, logout } = useAuth();

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-slate-900 text-slate-100 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-sm font-semibold tracking-wide">KPPDF AI</h1>
          <p className="text-xs text-slate-400 mt-1">Админка аналитика</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700 text-xs text-slate-400">
          <div className="mb-2">{username}</div>
          <button
            type="button"
            onClick={logout}
            className="text-slate-300 hover:text-white underline"
          >
            Выйти
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
