import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reservationsApi } from '../api/endpoints';
import { STATUS_LABELS, type Reservation, type ReservationStatus } from '../api/types';
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from '../components/ui';
import { toast } from '../stores/toastStore';
import { toApiError } from '../api/client';
import { formatFullDate, formatMoney, formatTime } from '../lib/format';
import { cn } from '../lib/cn';

const FILTERS: Array<{ value: ReservationStatus | ''; label: string }> = [
    { value: '', label: 'Todas' },
    { value: 'CONFIRMED', label: 'Confirmadas' },
    { value: 'PENDING', label: 'Pendentes' },
    { value: 'CANCELLED', label: 'Canceladas' },
    { value: 'EXPIRED', label: 'Expiradas' },
];

const STATUS_TONES: Record<ReservationStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
    CONFIRMED: 'success',
    PENDING: 'warning',
    CANCELLED: 'danger',
    EXPIRED: 'neutral',
};

function ReservationRow({ reservation }: { reservation: Reservation }) {
    const queryClient = useQueryClient();
    const startsAt = new Date(reservation.showtime.startsAt);
    const isPast = startsAt.getTime() < Date.now();
    const canCancel =
        !isPast && (reservation.status === 'CONFIRMED' || reservation.status === 'PENDING');

    const cancel = useMutation({
        mutationFn: () => reservationsApi.cancel(reservation.id),
        onSuccess: () => {
            toast.info('Reserva cancelada.', 'As poltronas voltaram para o mapa.');
            void queryClient.invalidateQueries({ queryKey: ['reservations'] });
        },
        onError: (error) => toast.error('Não foi possível cancelar', toApiError(error).message),
    });

    return (
        <Card as="article" className={cn('overflow-hidden', isPast && 'opacity-70')}>
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                {reservation.showtime.moviePosterUrl && (
                    <img
                        src={reservation.showtime.moviePosterUrl}
                        alt=""
                        width={500}
                        height={750}
                        loading="lazy"
                        className="h-24 w-16 shrink-0 rounded-lg border border-ink-700 object-cover"
                    />
                )}

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{reservation.showtime.movieTitle}</h2>
                        <Badge tone={STATUS_TONES[reservation.status]}>
                            {STATUS_LABELS[reservation.status]}
                        </Badge>
                    </div>

                    <p className="mt-1 text-sm capitalize text-cream-dim">
                        {formatFullDate(reservation.showtime.startsAt)} ·{' '}
                        <span className="normal-case">
                            {formatTime(reservation.showtime.startsAt)} ·{' '}
                            {reservation.showtime.roomName}
                        </span>
                    </p>

                    <p className="mt-1.5 text-xs text-cream-faint">
                        Código <span className="font-medium text-cream-dim">{reservation.code}</span>
                        {' · '}
                        {reservation.seats.map((seat) => seat.label).join(', ')}
                    </p>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <span className="font-display text-lg font-bold text-accent">
                        {formatMoney(reservation.totalAmount)}
                    </span>

                    <div className="flex gap-2">
                        <Link
                            to={`/reservas/${reservation.id}`}
                            className="rounded-lg border border-ink-600 px-3 py-1.5 text-xs text-cream-dim transition-colors hover:border-ink-500 hover:text-cream"
                        >
                            Detalhes
                        </Link>
                        {canCancel && (
                            <Button
                                variant="danger"
                                size="sm"
                                isLoading={cancel.isPending}
                                onClick={() => cancel.mutate()}
                            >
                                Cancelar
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
}

export default function MyReservationsPage() {
    const [status, setStatus] = useState<ReservationStatus | ''>('');

    const query = useQuery({
        queryKey: ['reservations', { status }],
        queryFn: () => reservationsApi.mine({ status: status || undefined, limit: 20 }),
        placeholderData: keepPreviousData,
    });

    return (
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
            <header className="mb-6">
                <h1 className="text-3xl font-bold">Minhas reservas</h1>
                <p className="mt-1.5 text-sm text-cream-faint">
                    Histórico completo, com código de retirada e status de cada compra.
                </p>
            </header>

            <div role="tablist" aria-label="Filtrar por status" className="mb-5 flex flex-wrap gap-2">
                {FILTERS.map((filter) => (
                    <button
                        key={filter.value}
                        type="button"
                        role="tab"
                        aria-selected={status === filter.value}
                        onClick={() => setStatus(filter.value)}
                        className={cn(
                            'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                            status === filter.value
                                ? 'border-accent bg-accent/15 text-accent'
                                : 'border-ink-600 text-cream-dim hover:border-ink-500 hover:text-cream',
                        )}
                    >
                        {filter.label}
                    </button>
                ))}
            </div>

            {query.isPending ? (
                <div className="space-y-3">
                    {Array.from({ length: 3 }, (_, index) => (
                        <Skeleton key={index} className="h-32" />
                    ))}
                </div>
            ) : query.isError ? (
                <ErrorState
                    message="Não foi possível carregar suas reservas."
                    onRetry={() => void query.refetch()}
                />
            ) : query.data.data.length === 0 ? (
                <EmptyState
                    title={status ? 'Nenhuma reserva com este status' : 'Você ainda não tem reservas'}
                    description="Escolha um filme em cartaz e reserve sua poltrona."
                    action={
                        <Link to="/filmes">
                            <Button>Ver filmes em cartaz</Button>
                        </Link>
                    }
                />
            ) : (
                <div className="space-y-3">
                    {query.data.data.map((reservation) => (
                        <ReservationRow key={reservation.id} reservation={reservation} />
                    ))}
                </div>
            )}
        </div>
    );
}
