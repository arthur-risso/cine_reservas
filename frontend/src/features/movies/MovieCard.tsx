import { Link } from 'react-router-dom';
import type { Movie } from '../../api/types';
import { AgeRating, Badge } from '../../components/ui';
import { formatDuration, formatTime, isToday } from '../../lib/format';
import { cn } from '../../lib/cn';

interface MovieCardProps {
    movie: Movie;
    /** As primeiras imagens da vitrine carregam com prioridade. */
    priority?: boolean;
}

function nextSessionLabel(iso: string | null | undefined): string | null {
    if (!iso) return null;

    const date = new Date(iso);
    const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate(),
    ).padStart(2, '0')}`;

    return isToday(dayKey) ? `Hoje às ${formatTime(iso)}` : `A partir de ${formatTime(iso)}`;
}

export function MovieCard({ movie, priority = false }: MovieCardProps) {
    const nextSession = nextSessionLabel(movie.nextShowtime);

    return (
        <article className="group relative">
            <Link
                to={`/filmes/${movie.id}`}
                className="block overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 transition-all duration-300 group-hover:-translate-y-1 group-hover:border-accent/40 group-hover:shadow-glow"
            >
                <div className="relative aspect-[2/3] overflow-hidden bg-ink-800">
                    {movie.posterUrl ? (
                        <img
                            src={movie.posterUrl}
                            alt=""
                            /**
                             * width/height reservam o espaço antes da imagem
                             * chegar: sem eles a grade "pula" conforme cada
                             * pôster carrega (layout shift).
                             *
                             * loading="lazy" fora da primeira dobra evita
                             * baixar 12 imagens que o usuário talvez nem role
                             * até ver.
                             */
                            width={500}
                            height={750}
                            loading={priority ? 'eager' : 'lazy'}
                            fetchPriority={priority ? 'high' : 'auto'}
                            decoding="async"
                            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    ) : (
                        <div className="grid size-full place-items-center text-cream-faint">
                            <span className="text-xs">sem imagem</span>
                        </div>
                    )}

                    {/* Véu inferior para o texto sobreposto ter contraste. */}
                    <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-ink-950 via-ink-950/70 to-transparent" />

                    <div className="absolute left-3 top-3">
                        <AgeRating rating={movie.ageRating} />
                    </div>

                    {nextSession && (
                        <div className="absolute inset-x-3 bottom-3">
                            <span
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded-lg bg-ink-950/80 px-2 py-1 text-[11px] font-medium backdrop-blur-sm',
                                    'text-accent',
                                )}
                            >
                                <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
                                {nextSession}
                            </span>
                        </div>
                    )}
                </div>

                <div className="p-3.5">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-cream">
                        {movie.title}
                    </h3>
                    <p className="mt-1 text-xs text-cream-faint">
                        {formatDuration(movie.durationMin)}
                        {movie.genres[0] && ` · ${movie.genres[0]}`}
                    </p>
                </div>
            </Link>
        </article>
    );
}

export function MovieCardSkeleton() {
    return (
        <div className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850">
            <div className="aspect-[2/3] animate-pulse bg-ink-800" />
            <div className="space-y-2 p-3.5">
                <div className="h-4 w-4/5 animate-pulse rounded bg-ink-800" />
                <div className="h-3 w-2/5 animate-pulse rounded bg-ink-800" />
            </div>
        </div>
    );
}

/** Cartaz largo usado no destaque da home. */
export function MovieHero({ movie }: { movie: Movie }) {
    return (
        <section className="film-grain projector-glow relative overflow-hidden rounded-3xl border border-ink-700">
            {movie.backdropUrl && (
                <img
                    src={movie.backdropUrl}
                    alt=""
                    width={1280}
                    height={720}
                    fetchPriority="high"
                    className="absolute inset-0 size-full object-cover opacity-45"
                />
            )}

            <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/85 to-ink-950/35" />

            <div className="relative flex flex-col gap-6 p-7 sm:p-10 md:max-w-2xl md:p-14">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="accent">Em destaque</Badge>
                    <AgeRating rating={movie.ageRating} />
                    <span className="text-xs text-cream-dim">
                        {formatDuration(movie.durationMin)} · {movie.genres.slice(0, 2).join(' · ')}
                    </span>
                </div>

                <h1 className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
                    {movie.title}
                </h1>

                <p className="line-clamp-3 max-w-xl text-sm leading-relaxed text-cream-dim sm:text-base">
                    {movie.synopsis}
                </p>

                <div className="flex flex-wrap gap-3">
                    <Link
                        to={`/filmes/${movie.id}`}
                        className="inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 text-sm font-semibold text-ink-950 transition-colors hover:bg-accent-bright"
                    >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
                            <path d="M6 4.5l9 5.5-9 5.5z" />
                        </svg>
                        Ver sessões
                    </Link>
                    <Link
                        to="/programacao"
                        className="inline-flex h-12 items-center rounded-xl border border-ink-600 px-6 text-sm font-medium text-cream transition-colors hover:border-ink-500 hover:bg-ink-800"
                    >
                        Programação completa
                    </Link>
                </div>
            </div>
        </section>
    );
}
