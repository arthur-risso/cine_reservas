import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { roomsApi, showtimesApi } from '../api/endpoints';
import { SESSION_FORMATS, type Showtime } from '../api/types';
import { ShowtimeCard } from '../features/showtimes/ShowtimeCard';
import { Badge, EmptyState, ErrorState, Select, Skeleton } from '../components/ui';
import { dayLabel, formatDayMonth, toLocalDateKey } from '../lib/format';
import { cn } from '../lib/cn';

/** Próximos 14 dias, começando hoje. */
function nextDays(count: number): string[] {
    const today = new Date();
    return Array.from({ length: count }, (_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() + index);
        return toLocalDateKey(date);
    });
}

export default function SchedulePage() {
    const days = nextDays(14);
    const [selectedDay, setSelectedDay] = useState(days[0]!);
    const [roomId, setRoomId] = useState('');
    const [format, setFormat] = useState('');

    const roomsQuery = useQuery({
        queryKey: ['rooms'],
        queryFn: () => roomsApi.list(),
        staleTime: 10 * 60_000,
    });

    const showtimesQuery = useQuery({
        queryKey: ['showtimes', { date: selectedDay, roomId, format }],
        queryFn: () =>
            showtimesApi.list({
                date: selectedDay,
                roomId: roomId || undefined,
                format: format ? [format] : undefined,
                limit: 100,
            }),
        placeholderData: keepPreviousData,
        staleTime: 15_000,
    });

    // Agrupa por filme: a programação do dia é mais útil lida como
    // "que filmes passam hoje e a que horas".
    const byMovie = new Map<string, { title: string; poster: string | null; sessions: Showtime[] }>();
    for (const showtime of showtimesQuery.data?.data ?? []) {
        const entry = byMovie.get(showtime.movie.id) ?? {
            title: showtime.movie.title,
            poster: showtime.movie.posterUrl,
            sessions: [],
        };
        entry.sessions.push(showtime);
        byMovie.set(showtime.movie.id, entry);
    }

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
            <header className="mb-6">
                <h1 className="text-3xl font-bold">Programação</h1>
                <p className="mt-1.5 text-sm text-cream-faint">
                    Todas as sessões dos próximos 14 dias, por dia e por sala.
                </p>
            </header>

            {/* Seletor de dia */}
            <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2">
                {days.map((day) => (
                    <button
                        key={day}
                        type="button"
                        aria-pressed={day === selectedDay}
                        onClick={() => setSelectedDay(day)}
                        className={cn(
                            'flex min-w-[4.5rem] shrink-0 snap-start flex-col items-center rounded-xl border px-3 py-2.5 transition-colors',
                            day === selectedDay
                                ? 'border-accent bg-accent/12'
                                : 'border-ink-700 bg-ink-850 hover:border-ink-500',
                        )}
                    >
                        <span
                            className={cn(
                                'text-[11px] uppercase',
                                day === selectedDay ? 'text-accent' : 'text-cream-faint',
                            )}
                        >
                            {dayLabel(day)}
                        </span>
                        <span className="text-sm font-semibold">
                            {formatDayMonth(`${day}T12:00:00`)}
                        </span>
                    </button>
                ))}
            </div>

            {/* Filtros */}
            <div className="mt-5 flex flex-wrap gap-3">
                <Select
                    value={roomId}
                    onChange={(event) => setRoomId(event.target.value)}
                    className="min-w-52"
                    aria-label="Filtrar por sala"
                >
                    <option value="">Todas as salas</option>
                    {(roomsQuery.data ?? []).map((room) => (
                        <option key={room.id} value={room.id}>
                            {room.name} — {room.technology}
                        </option>
                    ))}
                </Select>

                <Select
                    value={format}
                    onChange={(event) => setFormat(event.target.value)}
                    className="min-w-40"
                    aria-label="Filtrar por formato"
                >
                    <option value="">Todos os formatos</option>
                    {SESSION_FORMATS.map((item) => (
                        <option key={item} value={item}>
                            {item}
                        </option>
                    ))}
                </Select>
            </div>

            <p className="mt-5 text-sm text-cream-faint" aria-live="polite">
                {showtimesQuery.isPending
                    ? 'Carregando…'
                    : `${showtimesQuery.data?.meta.total ?? 0} sessões neste dia`}
            </p>

            {showtimesQuery.isError ? (
                <div className="mt-4">
                    <ErrorState
                        message="Não foi possível carregar a programação."
                        onRetry={() => void showtimesQuery.refetch()}
                    />
                </div>
            ) : showtimesQuery.isPending ? (
                <div className="mt-4 space-y-6">
                    {Array.from({ length: 3 }, (_, index) => (
                        <Skeleton key={index} className="h-52" />
                    ))}
                </div>
            ) : byMovie.size === 0 ? (
                <div className="mt-4">
                    <EmptyState
                        title="Sem sessões com esses filtros"
                        description="Tente outro dia, outra sala ou outro formato."
                    />
                </div>
            ) : (
                <div className="mt-5 space-y-8">
                    {[...byMovie.entries()].map(([movieId, group]) => (
                        <section key={movieId}>
                            <div className="mb-3 flex items-center gap-3">
                                {group.poster && (
                                    <img
                                        src={group.poster}
                                        alt=""
                                        width={500}
                                        height={750}
                                        loading="lazy"
                                        className="h-14 w-10 rounded-lg border border-ink-700 object-cover"
                                    />
                                )}
                                <div>
                                    <h2 className="font-semibold">{group.title}</h2>
                                    <Badge className="mt-1">
                                        {group.sessions.length}{' '}
                                        {group.sessions.length === 1 ? 'sessão' : 'sessões'}
                                    </Badge>
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                {group.sessions.map((showtime) => (
                                    <ShowtimeCard key={showtime.id} showtime={showtime} />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}
