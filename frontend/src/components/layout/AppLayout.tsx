import { Suspense } from 'react';
import { Link, Outlet, ScrollRestoration } from 'react-router-dom';
import { Header } from './Header';
import { Skeleton } from '../ui';

function Footer() {
    return (
        <footer className="mt-20 border-t border-ink-800 bg-ink-900">
            <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
                <div>
                    <p className="font-display text-lg font-semibold">
                        Cine <span className="text-accent">Aurora</span>
                    </p>
                    <p className="mt-2 max-w-xs text-sm leading-relaxed text-cream-faint">
                        Plataforma de reservas com escolha de poltrona em tempo real, três
                        categorias de assento e programação atualizada diariamente.
                    </p>
                </div>

                <div>
                    <h2 className="text-sm font-semibold text-cream">Navegação</h2>
                    <ul className="mt-3 space-y-2 text-sm text-cream-faint">
                        <li>
                            <Link to="/filmes" className="transition-colors hover:text-accent">
                                Filmes em cartaz
                            </Link>
                        </li>
                        <li>
                            <Link to="/programacao" className="transition-colors hover:text-accent">
                                Programação completa
                            </Link>
                        </li>
                        <li>
                            <Link to="/minhas-reservas" className="transition-colors hover:text-accent">
                                Minhas reservas
                            </Link>
                        </li>
                    </ul>
                </div>

                <div>
                    <h2 className="text-sm font-semibold text-cream">Tipos de poltrona</h2>
                    <ul className="mt-3 space-y-2 text-sm text-cream-faint">
                        <li className="flex items-center gap-2">
                            <span className="size-2.5 rounded-full bg-tier-normal" aria-hidden="true" />
                            Normal — poltrona tradicional
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="size-2.5 rounded-full bg-tier-semivip" aria-hidden="true" />
                            Semi-VIP — mais espaço e conforto
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="size-2.5 rounded-full bg-tier-vip" aria-hidden="true" />
                            VIP — reclinável, com apoio de pernas
                        </li>
                    </ul>
                </div>
            </div>

            <div className="border-t border-ink-800 px-4 py-5 text-center text-xs text-cream-faint">
                Projeto de estudo — dados de catálogo fictícios para demonstração.
            </div>
        </footer>
    );
}

/** Esqueleto genérico enquanto o código da rota é baixado. */
function RouteFallback() {
    return (
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <Skeleton className="h-8 w-56" />
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 8 }, (_, index) => (
                    <Skeleton key={index} className="aspect-[2/3]" />
                ))}
            </div>
        </div>
    );
}

export function AppLayout() {
    return (
        <div className="flex min-h-dvh flex-col">
            {/**
             * Link de pular navegação: primeiro item do Tab, invisível até
             * receber foco. Quem usa teclado ou leitor de tela não precisa
             * percorrer o menu inteiro em toda página.
             */}
            <a
                href="#conteudo"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink-950"
            >
                Pular para o conteúdo
            </a>

            <Header />

            <main id="conteudo" className="flex-1">
                <Suspense fallback={<RouteFallback />}>
                    <Outlet />
                </Suspense>
            </main>

            <Footer />

            {/* Restaura a posição de rolagem ao voltar — sem isso, o botão
                "voltar" do navegador joga o usuário no topo da lista. */}
            <ScrollRestoration />
        </div>
    );
}
