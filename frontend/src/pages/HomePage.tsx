import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { moviesApi, showtimesApi } from '../api/endpoints';
import { MovieCard, MovieCardSkeleton, MovieHero } from '../features/movies/MovieCard';
import { ShowtimeCard } from '../features/showtimes/ShowtimeCard';
import { ErrorState, Skeleton } from '../components/ui';
import { toLocalDateKey } from '../lib/format';

export function HomePage() {
    const moviesQuery = useQuery({
        queryKey: ['movies', { sort: 'soonest', limit: 10 }],
        queryFn: () => moviesApi.list({ sort: 'soonest', limit: 10 }),
    });

    const todayQuery = useQuery({
        queryKey: ['showtimes', 'today'],
        queryFn: () => showtimesApi.list({ date: toLocalDateKey(new Date()), limit: 8 }),
        // Sessões de hoje envelhecem rápido (lotam durante o dia).
        staleTime: 15_000,
    });

    const movies = moviesQuery.data?.data ?? [];
    const [featured, ...rest] = movies;

    return (
        <div className="mx-auto max-w-7xl space-y-14 px-4 py-8 sm:px-6 sm:py-10">
            {/* Destaque */}
            {moviesQuery.isPending ? (
                <Skeleton className="h-[26rem] rounded-3xl" />
            ) : moviesQuery.isError ? (
                <ErrorState
                    message="Não foi possível carregar a programação."
                    onRetry={() => void moviesQuery.refetch()}
                />
            ) : featured ? (
                <MovieHero movie={featured} />
            ) : null}

            {/* Em cartaz */}
            <section>
                <div className="mb-5 flex items-end justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold">Em cartaz</h2>
                        <p className="mt-1 text-sm text-cream-faint">
                            Filmes com sessões nos próximos dias
                        </p>
                    </div>
                    <Link
                        to="/filmes"
                        className="shrink-0 text-sm font-medium text-accent transition-colors hover:text-accent-bright"
                    >
                        Ver todos →
                    </Link>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                    {moviesQuery.isPending
                        ? Array.from({ length: 5 }, (_, index) => <MovieCardSkeleton key={index} />)
                        : rest
                              .slice(0, 5)
                              .map((movie, index) => (
                                  <MovieCard key={movie.id} movie={movie} priority={index < 3} />
                              ))}
                </div>
            </section>

            {/* Sessões de hoje */}
            <section>
                <div className="mb-5">
                    <h2 className="text-2xl font-bold">Hoje no Cine Aurora</h2>
                    <p className="mt-1 text-sm text-cream-faint">
                        Próximas sessões, com disponibilidade em tempo real
                    </p>
                </div>

                {todayQuery.isPending ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {Array.from({ length: 4 }, (_, index) => (
                            <Skeleton key={index} className="h-40" />
                        ))}
                    </div>
                ) : todayQuery.data && todayQuery.data.data.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {todayQuery.data.data.map((showtime) => (
                            <div key={showtime.id} className="space-y-2">
                                <p className="truncate px-1 text-xs font-medium text-cream-dim">
                                    {showtime.movie.title}
                                </p>
                                <ShowtimeCard showtime={showtime} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="rounded-2xl border border-dashed border-ink-600 px-6 py-10 text-center text-sm text-cream-faint">
                        A programação de hoje já terminou. Confira os próximos dias em{' '}
                        <Link to="/programacao" className="text-accent hover:underline">
                            Programação
                        </Link>
                        .
                    </p>
                )}
            </section>

            {/* Categorias de poltrona */}
            <section className="grid gap-4 sm:grid-cols-3">
                {[
                    {
                        tier: 'Normal',
                        color: 'bg-tier-normal',
                        text: 'Poltrona tradicional estofada, com apoio de braço compartilhado.',
                    },
                    {
                        tier: 'Semi-VIP',
                        color: 'bg-tier-semivip',
                        text: 'Assento mais largo, maior espaço entre fileiras e apoio individual.',
                    },
                    {
                        tier: 'VIP',
                        color: 'bg-tier-vip',
                        text: 'Reclinável de couro, apoio para pernas e mesa lateral.',
                    },
                ].map((item) => (
                    <div
                        key={item.tier}
                        className="rounded-2xl border border-ink-700 bg-ink-850/60 p-5"
                    >
                        <span className={`block size-3 rounded-full ${item.color}`} aria-hidden="true" />
                        <h3 className="mt-3 text-base font-semibold">{item.tier}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-cream-faint">{item.text}</p>
                    </div>
                ))}
            </section>
        </div>
    );
}
