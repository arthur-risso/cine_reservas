import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '../../lib/cn';

const TABS = [
    { to: '/admin', label: 'Visão geral', end: true },
    { to: '/admin/filmes', label: 'Filmes' },
    { to: '/admin/salas', label: 'Salas' },
    { to: '/admin/sessoes', label: 'Sessões' },
];

export default function AdminLayout() {
    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
            <header className="mb-6">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
                    Administração
                </p>
                <h1 className="mt-1 text-3xl font-bold">Painel do Cine Aurora</h1>
            </header>

            <nav
                aria-label="Seções do painel"
                className="mb-7 flex gap-1 overflow-x-auto rounded-xl border border-ink-700 bg-ink-850 p-1"
            >
                {TABS.map((tab) => (
                    <NavLink
                        key={tab.to}
                        to={tab.to}
                        end={tab.end}
                        className={({ isActive }) =>
                            cn(
                                'shrink-0 rounded-lg px-4 py-2 text-sm transition-colors',
                                isActive
                                    ? 'bg-accent text-ink-950 font-semibold'
                                    : 'text-cream-dim hover:bg-ink-800 hover:text-cream',
                            )
                        }
                    >
                        {tab.label}
                    </NavLink>
                ))}
            </nav>

            <Outlet />
        </div>
    );
}
