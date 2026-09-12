import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { moviesApi, roomsApi, showtimesApi } from '../../api/endpoints';
import { Card, Skeleton } from '../../components/ui';
import { formatMoney, formatTime, toLocalDateKey } from '../../lib/format';

function StatCard({
    label,
    value,
    hint,
    isLoading,
}: {
    label: string;
    value: string | number;
    hint?: string;
    isLoading?: boolean;
}) {
    return (
        <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-cream-faint">{label}</p>
            {isLoading ? (
                <Skeleton className="mt-2 h-9 w-20" />
            ) : (
                <p className="mt-1 font-display text-3xl font-bold">{value}</p>
            )}
            {hint && <p className="mt-1 text-xs text-cream-faint">{hint}</p>}
        </Card>
    );
}

export default function AdminDashboard() {
    const today = toLocalDateKey(new Date());

    const moviesQuery = useQuery({
        queryKey: ['movies', { limit: 1, onlyShowing: false }],
        queryFn: () => moviesApi.list({ limit: 1 }),
    });

    const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: () => roomsApi.list() });

    const todayQuery = useQuery({
        queryKey: ['showtimes', { date: today, limit: 100 }],
        queryFn: () => showtimesApi.list({ date: today, limit: 100, upcomingOnly: false }),
    });

    const sessions = todayQuery.data?.data ?? [];
    const totalSeats = sessions.reduce((sum, item) => sum + item.occupancy.total, 0);
    const takenSeats = sessions.reduce((sum, item) => sum + item.occupancy.taken, 0);
    const occupancyRate = totalSeats > 0 ? Math.round((takenSeats / totalSeats) * 100) : 0;

    // Receita potencial confirmada hoje, usando o preço-base de cada sessão.
    const revenue = sessions.reduce(
        (sum, item) => sum + item.occupancy.taken * item.basePrice,
        0,
    );

    const busiest = [...sessions]
        .sort((a, b) => b.occupancy.percentage - a.occupancy.percentage)
        .slice(0, 5);

    return (
        <div className="space-y-7">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Filmes em cartaz"
                    value={moviesQuery.data?.meta.total ?? 0}
                    isLoading={moviesQuery.isPending}
                />
                <StatCard
                    label="Salas ativas"
                    value={roomsQuery.data?.length ?? 0}
                    hint={`${roomsQuery.data?.reduce((sum, room) => sum + room.seatSummary.total, 0) ?? 0} poltronas no total`}
                    isLoading={roomsQuery.isPending}
                />
                <StatCard
                    label="Sessões hoje"
                    value={sessions.length}
                    hint={`${takenSeats} de ${totalSeats} lugares vendidos`}
                    isLoading={todayQuery.isPending}
                />
                <StatCard
                    label="Ocupação de hoje"
                    value={`${occupancyRate}%`}
                    hint={`Receita estimada: ${formatMoney(revenue)}`}
                    isLoading={todayQuery.isPending}
                />
            </div>

            <Card className="overflow-hidden">
                <div className="border-b border-ink-700 px-5 py-4">
                    <h2 className="font-semibold">Sessões mais cheias hoje</h2>
                </div>

                {todayQuery.isPending ? (
                    <div className="space-y-2 p-5">
                        {Array.from({ length: 4 }, (_, index) => (
                            <Skeleton key={index} className="h-12" />
                        ))}
                    </div>
                ) : busiest.length === 0 ? (
                    <p className="p-8 text-center text-sm text-cream-faint">
                        Nenhuma sessão programada para hoje.
                    </p>
                ) : (
                    <ul className="divide-y divide-ink-700">
                        {busiest.map((showtime) => (
                            <li
                                key={showtime.id}
                                className="flex items-center gap-4 px-5 py-3 text-sm"
                            >
                                <span className="w-12 shrink-0 font-medium tabular-nums">
                                    {formatTime(showtime.startsAt)}
                                </span>
                                <span className="min-w-0 flex-1 truncate">
                                    {showtime.movie.title}
                                </span>
                                <span className="hidden shrink-0 text-cream-faint sm:block">
                                    {showtime.room.name}
                                </span>
                                <span className="w-28 shrink-0">
                                    <span className="mb-1 block text-right text-xs text-cream-dim">
                                        {showtime.occupancy.percentage}%
                                    </span>
                                    <span className="block h-1.5 overflow-hidden rounded-full bg-ink-700">
                                        <span
                                            className="block h-full rounded-full bg-accent"
                                            style={{ width: `${showtime.occupancy.percentage}%` }}
                                        />
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <div className="grid gap-4 sm:grid-cols-3">
                {[
                    { to: '/admin/filmes', title: 'Gerenciar filmes', text: 'Cadastrar, editar e tirar de cartaz.' },
                    { to: '/admin/salas', title: 'Gerenciar salas', text: 'Criar salas e gerar mapas de poltrona.' },
                    { to: '/admin/sessoes', title: 'Gerenciar sessões', text: 'Programar horários sem conflito.' },
                ].map((item) => (
                    <Link
                        key={item.to}
                        to={item.to}
                        className="rounded-2xl border border-ink-700 bg-ink-850 p-5 transition-all hover:-translate-y-0.5 hover:border-accent/40"
                    >
                        <h3 className="font-semibold">{item.title}</h3>
                        <p className="mt-1 text-sm text-cream-faint">{item.text}</p>
                    </Link>
                ))}
            </div>
        </div>
    );
}
