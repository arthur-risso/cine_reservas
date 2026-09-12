import { useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reservationsApi } from '../api/endpoints';
import { LANGUAGE_LABELS, TIER_LABELS } from '../api/types';
import { Countdown } from '../features/reservations/Countdown';
import { Badge, Button, Card, ErrorState, Skeleton } from '../components/ui';
import { toast } from '../stores/toastStore';
import { toApiError } from '../api/client';
import { formatFullDate, formatMoney, formatTime } from '../lib/format';

export default function CheckoutPage() {
    const { id = '' } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const reservationQuery = useQuery({
        queryKey: ['reservation', id],
        queryFn: () => reservationsApi.byId(id),
        staleTime: 0,
    });

    const invalidate = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: ['reservation', id] });
        void queryClient.invalidateQueries({ queryKey: ['reservations'] });
        void queryClient.invalidateQueries({ queryKey: ['seatMap'] });
    }, [queryClient, id]);

    const confirm = useMutation({
        mutationFn: () => reservationsApi.confirm(id),
        onSuccess: (reservation) => {
            toast.success('Reserva confirmada!', `Código ${reservation.code}`);
            invalidate();
        },
        onError: (error) => {
            const apiError = toApiError(error);
            toast.error('Não foi possível confirmar', apiError.message);
            invalidate();
        },
    });

    const cancel = useMutation({
        mutationFn: () => reservationsApi.cancel(id),
        onSuccess: () => {
            toast.info('Reserva cancelada.', 'As poltronas voltaram para o mapa.');
            invalidate();
            navigate('/minhas-reservas');
        },
        onError: (error) => toast.error('Não foi possível cancelar', toApiError(error).message),
    });

    if (reservationQuery.isPending) {
        return (
            <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
                <Skeleton className="h-32" />
                <Skeleton className="h-64" />
            </div>
        );
    }

    if (reservationQuery.isError || !reservationQuery.data) {
        return (
            <div className="mx-auto max-w-3xl px-4 py-16">
                <ErrorState message="Reserva não encontrada." />
            </div>
        );
    }

    const reservation = reservationQuery.data;
    const isPending = reservation.status === 'PENDING';
    const isConfirmed = reservation.status === 'CONFIRMED';
    const isDead = reservation.status === 'EXPIRED' || reservation.status === 'CANCELLED';

    return (
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
            {/* Estado da reserva */}
            {isConfirmed && (
                <div className="mb-6 flex items-start gap-3 rounded-2xl border border-success/40 bg-success/10 p-5">
                    <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="mt-0.5 size-5 shrink-0 text-success"
                        aria-hidden="true"
                    >
                        <path d="M4.5 10.5l3.5 3.5 7.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div>
                        <h1 className="text-lg font-semibold">Reserva confirmada</h1>
                        <p className="mt-1 text-sm text-cream-dim">
                            Apresente o código <strong className="text-cream">{reservation.code}</strong> na
                            bilheteria ou no totem de retirada.
                        </p>
                    </div>
                </div>
            )}

            {isPending && reservation.expiresAt && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-ink-700 bg-ink-850 p-5">
                    <div>
                        <h1 className="text-lg font-semibold">Confirme sua reserva</h1>
                        <p className="mt-1 text-sm text-cream-dim">
                            As poltronas estão separadas para você até o fim da contagem.
                        </p>
                    </div>
                    <Countdown
                        expiresAt={reservation.expiresAt}
                        // Ao zerar, recarrega do servidor: a reserva provavelmente
                        // já virou EXPIRED e a tela precisa dizer isso.
                        onExpire={invalidate}
                    />
                </div>
            )}

            {isDead && (
                <div className="mb-6 rounded-2xl border border-danger/40 bg-danger/10 p-5">
                    <h1 className="text-lg font-semibold">
                        {reservation.status === 'EXPIRED' ? 'Reserva expirada' : 'Reserva cancelada'}
                    </h1>
                    <p className="mt-1 text-sm text-cream-dim">
                        As poltronas foram liberadas.{' '}
                        <Link
                            to={`/sessoes/${reservation.showtime.id}/poltronas`}
                            className="text-accent hover:underline"
                        >
                            Escolher novamente
                        </Link>
                    </p>
                </div>
            )}

            {/* Detalhe do pedido */}
            <Card className="overflow-hidden">
                <div className="flex gap-4 border-b border-ink-700 p-5">
                    {reservation.showtime.moviePosterUrl && (
                        <img
                            src={reservation.showtime.moviePosterUrl}
                            alt=""
                            width={500}
                            height={750}
                            className="w-20 shrink-0 rounded-xl border border-ink-700"
                        />
                    )}
                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold leading-tight">
                            {reservation.showtime.movieTitle}
                        </h2>
                        <p className="mt-1.5 text-sm capitalize text-cream-dim">
                            {formatFullDate(reservation.showtime.startsAt)}
                        </p>
                        <p className="text-sm text-cream-dim">
                            {formatTime(reservation.showtime.startsAt)} ·{' '}
                            {reservation.showtime.roomName}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            <Badge tone="accent">{reservation.showtime.format}</Badge>
                            <Badge>{LANGUAGE_LABELS[reservation.showtime.language]}</Badge>
                            <Badge>{reservation.showtime.roomTechnology}</Badge>
                        </div>
                    </div>
                </div>

                <div className="p-5">
                    <h3 className="text-sm font-medium text-cream-dim">
                        Poltronas ({reservation.seats.length})
                    </h3>

                    <ul className="mt-3 divide-y divide-ink-700">
                        {reservation.seats.map((seat) => (
                            <li key={seat.id} className="flex items-center justify-between py-2.5">
                                <div className="flex items-center gap-3">
                                    <span className="grid size-9 place-items-center rounded-lg border border-ink-600 bg-ink-800 text-xs font-semibold">
                                        {seat.label}
                                    </span>
                                    <div>
                                        <p className="text-sm">{TIER_LABELS[seat.tier]}</p>
                                        <p className="text-[11px] text-cream-faint">
                                            {seat.ticketKind === 'HALF' ? 'Meia-entrada' : 'Inteira'}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-sm font-medium">
                                    {formatMoney(seat.unitPrice)}
                                </span>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-4 flex items-baseline justify-between border-t border-ink-700 pt-4">
                        <span className="text-sm text-cream-dim">Total</span>
                        <span className="font-display text-2xl font-bold text-accent">
                            {formatMoney(reservation.totalAmount)}
                        </span>
                    </div>
                </div>

                {isPending && (
                    <div className="border-t border-ink-700 bg-ink-900/60 p-5">
                        {/**
                         * Checkout simulado: em um sistema real, aqui entraria
                         * o gateway de pagamento, e a confirmação viria do
                         * webhook dele — não de um clique do cliente.
                         */}
                        <p className="mb-3 text-xs text-cream-faint">
                            Pagamento simulado — nenhuma cobrança é realizada neste projeto.
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button
                                size="lg"
                                className="flex-1"
                                isLoading={confirm.isPending}
                                onClick={() => confirm.mutate()}
                            >
                                Confirmar reserva
                            </Button>
                            <Button
                                variant="danger"
                                size="lg"
                                isLoading={cancel.isPending}
                                onClick={() => cancel.mutate()}
                            >
                                Cancelar
                            </Button>
                        </div>
                    </div>
                )}

                {isConfirmed && (
                    <div className="border-t border-ink-700 bg-ink-900/60 p-5">
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button
                                variant="secondary"
                                className="flex-1"
                                onClick={() => navigate('/minhas-reservas')}
                            >
                                Ver minhas reservas
                            </Button>
                            <Button
                                variant="danger"
                                isLoading={cancel.isPending}
                                onClick={() => cancel.mutate()}
                            >
                                Cancelar reserva
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
