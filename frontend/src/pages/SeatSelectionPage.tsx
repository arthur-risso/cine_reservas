import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reservationsApi, showtimesApi } from '../api/endpoints';
import { LANGUAGE_LABELS, TIER_LABELS, type SeatMapSeat, type TicketKind } from '../api/types';
import { SeatMap } from '../features/showtimes/SeatMap';
import { AgeRating, Badge, Button, Card, ErrorState, Skeleton } from '../components/ui';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import { toApiError } from '../api/client';
import { formatFullDate, formatMoney, formatTime } from '../lib/format';
import { cn } from '../lib/cn';

const MAX_SEATS = 6;

interface Selection {
    seat: SeatMapSeat;
    ticketKind: TicketKind;
}

export default function SeatSelectionPage() {
    const { id = '' } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    const [selection, setSelection] = useState<Map<string, Selection>>(new Map());

    const seatMapQuery = useQuery({
        queryKey: ['seatMap', id],
        queryFn: () => showtimesApi.seatMap(id),
        /**
         * Disponibilidade é o dado mais volátil do sistema: alguém pode
         * reservar a poltrona que você está olhando neste segundo.
         *
         * `staleTime: 0` + refetch periódico mantêm o mapa próximo da
         * realidade. Ainda assim isso é só conforto visual — quem garante
         * de verdade é o 409 do servidor no momento da reserva.
         */
        staleTime: 0,
        refetchInterval: 20_000,
        refetchOnWindowFocus: true,
    });

    const toggleSeat = useCallback((seat: SeatMapSeat) => {
        setSelection((current) => {
            const next = new Map(current);

            if (next.has(seat.id)) {
                next.delete(seat.id);
            } else {
                if (next.size >= MAX_SEATS) return current;
                next.set(seat.id, { seat, ticketKind: 'FULL' });
            }

            return next;
        });
    }, []);

    const setTicketKind = (seatId: string, ticketKind: TicketKind) => {
        setSelection((current) => {
            const next = new Map(current);
            const entry = next.get(seatId);
            if (entry) next.set(seatId, { ...entry, ticketKind });
            return next;
        });
    };

    const selectedIds = useMemo(() => new Set(selection.keys()), [selection]);

    const total = useMemo(
        () =>
            [...selection.values()].reduce(
                (sum, item) => sum + item.seat.price * (item.ticketKind === 'HALF' ? 0.5 : 1),
                0,
            ),
        [selection],
    );

    const createReservation = useMutation({
        mutationFn: () =>
            reservationsApi.create(
                id,
                [...selection.values()].map((item) => ({
                    seatId: item.seat.id,
                    ticketKind: item.ticketKind,
                })),
            ),
        onSuccess: (reservation) => {
            toast.success(
                'Poltronas reservadas!',
                `Você tem ${Math.floor((reservation.secondsToExpire ?? 0) / 60)} minutos para confirmar.`,
            );
            navigate(`/reservas/${reservation.id}`);
        },
        onError: (error) => {
            const apiError = toApiError(error);
            toast.error('Não foi possível reservar', apiError.message);

            // Se alguém pegou a poltrona antes, o mapa precisa refletir isso
            // imediatamente — e a seleção perdida precisa sair da tela.
            if (apiError.code === 'SEAT_TAKEN') {
                setSelection(new Map());
                void queryClient.invalidateQueries({ queryKey: ['seatMap', id] });
            }
        },
    });

    if (seatMapQuery.isPending) {
        return (
            <div className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6">
                <Skeleton className="h-20" />
                <Skeleton className="h-[28rem]" />
            </div>
        );
    }

    if (seatMapQuery.isError || !seatMapQuery.data) {
        return (
            <div className="mx-auto max-w-3xl px-4 py-16">
                <ErrorState
                    message="Não foi possível carregar o mapa de poltronas."
                    onRetry={() => void seatMapQuery.refetch()}
                />
            </div>
        );
    }

    const { showtime } = seatMapQuery.data;

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
            <Link
                to={`/filmes/${showtime.movie.id}`}
                className="inline-flex items-center gap-1.5 text-sm text-cream-faint transition-colors hover:text-accent"
            >
                ← Outras sessões de {showtime.movie.title}
            </Link>

            <header className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                <h1 className="text-2xl font-bold sm:text-3xl">{showtime.movie.title}</h1>
                <AgeRating rating={showtime.movie.ageRating} />
                <Badge tone="accent">{showtime.format}</Badge>
                <Badge>{LANGUAGE_LABELS[showtime.language]}</Badge>
            </header>

            <p className="mt-1.5 text-sm capitalize text-cream-dim">
                {formatFullDate(showtime.startsAt)} · {formatTime(showtime.startsAt)} ·{' '}
                <span className="normal-case">
                    {showtime.room.name} ({showtime.room.technology})
                </span>
            </p>

            <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_20rem]">
                <Card className="p-5 sm:p-7">
                    <SeatMap
                        data={seatMapQuery.data}
                        selectedIds={selectedIds}
                        maxSeats={MAX_SEATS}
                        onToggle={toggleSeat}
                    />
                </Card>

                {/* Resumo — acompanha a rolagem no desktop, fixa no rodapé no
                    celular, para o botão de reservar estar sempre à mão. */}
                <aside className="lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:self-start">
                    <Card className="p-5">
                        <h2 className="text-base font-semibold">Sua seleção</h2>
                        <p className="mt-0.5 text-xs text-cream-faint">
                            {selection.size} de {MAX_SEATS} poltronas
                        </p>

                        {selection.size === 0 ? (
                            <p className="mt-5 rounded-xl border border-dashed border-ink-600 px-4 py-7 text-center text-sm text-cream-faint">
                                Toque nas poltronas do mapa para escolher onde sentar.
                            </p>
                        ) : (
                            <ul className="mt-4 space-y-2.5">
                                {[...selection.values()].map(({ seat, ticketKind }) => (
                                    <li
                                        key={seat.id}
                                        className="rounded-xl border border-ink-700 bg-ink-800/60 p-3"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-semibold">{seat.label}</p>
                                                <p className="text-[11px] text-cream-faint">
                                                    {TIER_LABELS[seat.tier]}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-medium">
                                                    {formatMoney(
                                                        seat.price * (ticketKind === 'HALF' ? 0.5 : 1),
                                                    )}
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleSeat(seat)}
                                                    className="text-[11px] text-danger hover:underline"
                                                >
                                                    remover
                                                </button>
                                            </div>
                                        </div>

                                        {/* Inteira / meia por poltrona: um grupo
                                            pode ter um estudante e dois adultos. */}
                                        <div
                                            role="radiogroup"
                                            aria-label={`Tipo de ingresso da poltrona ${seat.label}`}
                                            className="mt-2.5 grid grid-cols-2 gap-1 rounded-lg bg-ink-900 p-0.5"
                                        >
                                            {(['FULL', 'HALF'] as const).map((kind) => (
                                                <button
                                                    key={kind}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={ticketKind === kind}
                                                    onClick={() => setTicketKind(seat.id, kind)}
                                                    className={cn(
                                                        'rounded-md py-1 text-[11px] font-medium transition-colors',
                                                        ticketKind === kind
                                                            ? 'bg-accent text-ink-950'
                                                            : 'text-cream-faint hover:text-cream',
                                                    )}
                                                >
                                                    {kind === 'FULL' ? 'Inteira' : 'Meia'}
                                                </button>
                                            ))}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <div className="mt-5 flex items-baseline justify-between border-t border-ink-700 pt-4">
                            <span className="text-sm text-cream-dim">Total</span>
                            <span className="font-display text-2xl font-bold text-accent">
                                {formatMoney(total)}
                            </span>
                        </div>

                        {isAuthenticated ? (
                            <Button
                                fullWidth
                                className="mt-4"
                                size="lg"
                                disabled={selection.size === 0}
                                isLoading={createReservation.isPending}
                                onClick={() => createReservation.mutate()}
                            >
                                Reservar poltronas
                            </Button>
                        ) : (
                            <div className="mt-4 space-y-2">
                                <Button
                                    fullWidth
                                    size="lg"
                                    onClick={() =>
                                        navigate('/entrar', {
                                            state: { from: `/sessoes/${id}/poltronas` },
                                        })
                                    }
                                >
                                    Entrar para reservar
                                </Button>
                                <p className="text-center text-[11px] text-cream-faint">
                                    Sua seleção é mantida no mapa até você voltar.
                                </p>
                            </div>
                        )}

                        <p className="mt-3 text-center text-[11px] leading-relaxed text-cream-faint">
                            Após reservar, você tem 10 minutos para confirmar. Depois disso as
                            poltronas voltam para o mapa.
                        </p>
                    </Card>
                </aside>
            </div>
        </div>
    );
}
