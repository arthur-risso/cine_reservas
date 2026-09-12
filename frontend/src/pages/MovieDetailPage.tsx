import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { moviesApi, showtimesApi } from '../api/endpoints';
import type { Showtime } from '../api/types';
import { CalendarStrip } from '../features/showtimes/CalendarStrip';
import { ShowtimeCard } from '../features/showtimes/ShowtimeCard';
import { AgeRating, Badge, EmptyState, ErrorState, Skeleton } from '../components/ui';
import { formatDuration, formatFullDate } from '../lib/format';

export default function MovieDetailPage() {
    const { id = '' } = useParams();
    const [selectedDay, setSelectedDay] = useState<string | null>(null);

    const movieQuery = useQuery({
        queryKey: ['movie', id],
        queryFn: () => moviesApi.byId(id),
    });

    const calendarQuery = useQuery({
        queryKey: ['movie', id, 'calendar'],
        queryFn: () => moviesApi.calendar(id, 14),
    });

    // Seleciona o primeiro dia disponível assim que o calendário chega, para
    // a página não abrir com a lista de horários vazia.
    useEffect(() => {
        if (!selectedDay && calendarQuery.data && calendarQuery.data.length > 0) {
            setSelectedDay(calendarQuery.data[0]!.day);
        }
    }, [calendarQuery.data, selectedDay]);

    const showtimesQuery = useQuery({
        queryKey: ['showtimes', { movieId: id, date: selectedDay }],
        queryFn: () => showtimesApi.list({ movieId: id, date: selectedDay!, limit: 60 }),
        // Só busca quando já existe um dia escolhido.
        enabled: Boolean(selectedDay),
        staleTime: 15_000,
    });

    if (movieQuery.isPending) {
        return (
            <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
                <Skeleton className="h-72 rounded-3xl" />
                <Skeleton className="h-24" />
            </div>
        );
    }

    if (movieQuery.isError || !movieQuery.data) {
        return (
            <div className="mx-auto max-w-3xl px-4 py-16">
                <ErrorState message="Filme não encontrado." />
                <div className="mt-4 text-center">
                    <Link to="/filmes" className="text-sm text-accent hover:underline">
                        ← Voltar para o catálogo
                    </Link>
                </div>
            </div>
        );
    }

    const movie = movieQuery.data;

    // Agrupa as sessões por sala: o usuário decide primeiro onde quer sentar
    // (IMAX? 4DX?) e só depois o horário.
    const showtimesByRoom = new Map<string, Showtime[]>();
    for (const showtime of showtimesQuery.data?.data ?? []) {
        const list = showtimesByRoom.get(showtime.room.name) ?? [];
        list.push(showtime);
        showtimesByRoom.set(showtime.room.name, list);
    }

    return (
        <div>
            {/* Cabeçalho com backdrop */}
            <section className="film-grain relative overflow-hidden border-b border-ink-800">
                {movie.backdropUrl && (
                    <img
                        src={movie.backdropUrl}
                        alt=""
                        width={1280}
                        height={720}
                        fetchPriority="high"
                        className="absolute inset-0 size-full object-cover opacity-30"
                    />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/90 to-ink-950/50" />

                <div className="relative mx-auto flex max-w-7xl flex-col gap-7 px-4 py-10 sm:px-6 md:flex-row md:py-14">
                    {movie.posterUrl && (
                        <img
                            src={movie.posterUrl}
                            alt={`Pôster de ${movie.title}`}
                            width={500}
                            height={750}
                            className="w-40 shrink-0 self-start rounded-2xl border border-ink-700 shadow-lift sm:w-52"
                        />
                    )}

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <AgeRating rating={movie.ageRating} />
                            {movie.genres.map((genre) => (
                                <Badge key={genre}>{genre}</Badge>
                            ))}
                        </div>

                        <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
                            {movie.title}
                        </h1>

                        {movie.originalTitle && movie.originalTitle !== movie.title && (
                            <p className="mt-1 text-sm italic text-cream-faint">
                                {movie.originalTitle}
                            </p>
                        )}

                        <p className="mt-3 text-sm text-cream-dim">
                            {formatDuration(movie.durationMin)}
                            {movie.director && ` · Direção: ${movie.director}`}
                            {movie.releaseDate &&
                                ` · ${new Date(`${movie.releaseDate}T12:00:00`).getFullYear()}`}
                        </p>

                        <p className="mt-5 max-w-3xl text-sm leading-relaxed text-cream-dim sm:text-base">
                            {movie.synopsis}
                        </p>

                        {movie.cast.length > 0 && (
                            <p className="mt-4 text-sm text-cream-faint">
                                <span className="text-cream-dim">Elenco: </span>
                                {movie.cast.join(', ')}
                            </p>
                        )}
                    </div>
                </div>
            </section>

            {/* Calendário + sessões */}
            <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
                <h2 className="text-2xl font-bold">Escolha a sessão</h2>

                <div className="mt-4">
                    {calendarQuery.isPending ? (
                        <div className="flex gap-2.5">
                            {Array.from({ length: 6 }, (_, index) => (
                                <Skeleton key={index} className="h-[5.5rem] w-[5.5rem]" />
                            ))}
                        </div>
                    ) : (
                        <CalendarStrip
                            days={calendarQuery.data ?? []}
                            selected={selectedDay}
                            onSelect={setSelectedDay}
                        />
                    )}
                </div>

                {selectedDay && (
                    <div className="mt-8">
                        <h3 className="text-sm font-medium capitalize text-cream-dim">
                            {formatFullDate(`${selectedDay}T12:00:00`)}
                        </h3>

                        {showtimesQuery.isPending ? (
                            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                {Array.from({ length: 4 }, (_, index) => (
                                    <Skeleton key={index} className="h-40" />
                                ))}
                            </div>
                        ) : showtimesByRoom.size === 0 ? (
                            <div className="mt-4">
                                <EmptyState
                                    title="Sem sessões neste dia"
                                    description="Escolha outra data no calendário acima."
                                />
                            </div>
                        ) : (
                            <div className="mt-4 space-y-7">
                                {[...showtimesByRoom.entries()].map(([roomName, sessions]) => (
                                    <div key={roomName}>
                                        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-cream">
                                            {roomName}
                                            <span className="font-normal text-cream-faint">
                                                {sessions[0]?.room.technology}
                                            </span>
                                        </p>
                                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                            {sessions.map((showtime) => (
                                                <ShowtimeCard key={showtime.id} showtime={showtime} />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}
