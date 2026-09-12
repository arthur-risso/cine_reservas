import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { cn } from '../../lib/cn';
import { Button } from '../ui/Button';

const NAV_LINKS = [
    { to: '/', label: 'Início', end: true },
    { to: '/filmes', label: 'Em cartaz' },
    { to: '/programacao', label: 'Programação' },
];

function Logo() {
    return (
        <Link to="/" className="flex items-center gap-2.5" aria-label="Cine Aurora, página inicial">
            <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
                <circle cx="16" cy="16" r="14" fill="none" stroke="var(--color-accent)" strokeWidth="1.5" />
                <circle cx="16" cy="16" r="4" fill="var(--color-accent)" />
                {/* Quatro "bobinas" evocando um rolo de filme. */}
                {[0, 90, 180, 270].map((angle) => (
                    <circle
                        key={angle}
                        cx={16 + 8 * Math.cos((angle * Math.PI) / 180)}
                        cy={16 + 8 * Math.sin((angle * Math.PI) / 180)}
                        r="2.6"
                        fill="var(--color-accent)"
                        opacity="0.55"
                    />
                ))}
            </svg>
            <span className="font-display text-lg font-semibold tracking-tight">
                Cine <span className="text-accent">Aurora</span>
            </span>
        </Link>
    );
}

export function Header() {
    const { isAuthenticated, isAdmin, user, logout } = useAuthStore();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
        toast.info('Você saiu da sua conta.');
        navigate('/');
    };

    const linkClass = ({ isActive }: { isActive: boolean }) =>
        cn(
            'relative py-1 text-sm transition-colors duration-150',
            isActive ? 'text-cream' : 'text-cream-dim hover:text-cream',
            // Sublinhado só no item ativo, desenhado com ::after para não
            // mexer na altura da linha ao alternar.
            isActive &&
                'after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-accent',
        );

    return (
        <header className="sticky top-0 z-50 border-b border-ink-800 bg-ink-950/85 backdrop-blur-xl">
            <div className="mx-auto flex h-[var(--header-height)] max-w-7xl items-center gap-6 px-4 sm:px-6">
                <Logo />

                <nav aria-label="Principal" className="hidden items-center gap-6 md:flex">
                    {NAV_LINKS.map((link) => (
                        <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
                            {link.label}
                        </NavLink>
                    ))}
                    {isAdmin && (
                        <NavLink to="/admin" className={linkClass}>
                            Painel
                        </NavLink>
                    )}
                </nav>

                <div className="ml-auto flex items-center gap-2">
                    {isAuthenticated ? (
                        <>
                            <Link
                                to="/minhas-reservas"
                                className="hidden rounded-xl px-3 py-2 text-sm text-cream-dim transition-colors hover:bg-ink-800 hover:text-cream sm:block"
                            >
                                Minhas reservas
                            </Link>

                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setMenuOpen((open) => !open)}
                                    aria-expanded={menuOpen}
                                    aria-haspopup="menu"
                                    className="flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-850 px-2.5 py-1.5 transition-colors hover:border-ink-600"
                                >
                                    <span className="grid size-7 place-items-center rounded-lg bg-accent text-xs font-bold text-ink-950">
                                        {user?.name.charAt(0).toUpperCase()}
                                    </span>
                                    <span className="hidden max-w-24 truncate text-sm text-cream-dim lg:block">
                                        {user?.name.split(' ')[0]}
                                    </span>
                                </button>

                                {menuOpen && (
                                    <>
                                        {/* Camada invisível: clicar fora fecha o menu. */}
                                        <div
                                            className="fixed inset-0 z-10"
                                            onClick={() => setMenuOpen(false)}
                                            aria-hidden="true"
                                        />
                                        <div
                                            role="menu"
                                            className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-ink-700 bg-ink-850 shadow-lift"
                                        >
                                            <div className="border-b border-ink-700 px-3 py-2.5">
                                                <p className="truncate text-sm font-medium text-cream">
                                                    {user?.name}
                                                </p>
                                                <p className="truncate text-xs text-cream-faint">
                                                    {user?.email}
                                                </p>
                                            </div>
                                            <Link
                                                to="/minhas-reservas"
                                                role="menuitem"
                                                onClick={() => setMenuOpen(false)}
                                                className="block px-3 py-2.5 text-sm text-cream-dim transition-colors hover:bg-ink-800 hover:text-cream"
                                            >
                                                Minhas reservas
                                            </Link>
                                            {isAdmin && (
                                                <Link
                                                    to="/admin"
                                                    role="menuitem"
                                                    onClick={() => setMenuOpen(false)}
                                                    className="block px-3 py-2.5 text-sm text-cream-dim transition-colors hover:bg-ink-800 hover:text-cream"
                                                >
                                                    Painel administrativo
                                                </Link>
                                            )}
                                            <button
                                                type="button"
                                                role="menuitem"
                                                onClick={handleLogout}
                                                className="w-full border-t border-ink-700 px-3 py-2.5 text-left text-sm text-danger transition-colors hover:bg-danger/10"
                                            >
                                                Sair
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <Link
                                to="/entrar"
                                className="rounded-xl px-3 py-2 text-sm text-cream-dim transition-colors hover:bg-ink-800 hover:text-cream"
                            >
                                Entrar
                            </Link>
                            <Button size="sm" onClick={() => navigate('/cadastro')}>
                                Criar conta
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Navegação em telas pequenas, abaixo do cabeçalho. */}
            <nav
                aria-label="Principal (móvel)"
                className="flex items-center gap-5 overflow-x-auto border-t border-ink-800/60 px-4 py-2 md:hidden"
            >
                {NAV_LINKS.map((link) => (
                    <NavLink key={link.to} to={link.to} end={link.end} className={linkClass}>
                        {link.label}
                    </NavLink>
                ))}
                {isAdmin && (
                    <NavLink to="/admin" className={linkClass}>
                        Painel
                    </NavLink>
                )}
            </nav>
        </header>
    );
}
