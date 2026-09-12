import { useState, type FormEvent } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { moviesApi, roomsApi, showtimesApi } from '../../api/endpoints';
import { LANGUAGE_LABELS, SESSION_FORMATS } from '../../api/types';
import { Badge, Button, Card, ErrorState, Input, Select, Skeleton } from '../../components/ui';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../stores/toastStore';
import { toApiError } from '../../api/client';
import { formatMoney, formatTime, toLocalDateKey } from '../../lib/format';

/**
 * Converte "2026-09-20T19:30" (valor de datetime-local, sem fuso) em ISO
 * completo com o deslocamento do navegador.
 *
 * O backend exige ISO com fuso justamente para não haver ambiguidade: sem o
 * offset, "19:30" poderia ser interpretado como UTC e a sessão apareceria
 * três horas fora do lugar.
 */
function localInputToIso(value: string): string {
    return new Date(value).toISOString();
}

export default function AdminShowtimes() {
    const queryClient = useQueryClient();
    const [date, setDate] = useState(toLocalDateKey(new Date()));
    const [isCreating, setIsCreating] = useState(false);

    const [movieId, setMovieId] = useState('');
    const [roomId, setRoomId] = useState('');
    const [startsAt, setStartsAt] = useState('');
    const [format, setFormat] = useState('2D');
    const [language, setLanguage] = useState('SUBTITLED');
    const [basePrice, setBasePrice] = useState('32');
    const [turnoverMinutes, setTurnoverMinutes] = useState('25');

    const moviesQuery = useQuery({
        queryKey: ['movies', { limit: 50, sort: 'title' }],
        queryFn: () => moviesApi.list({ limit: 50, sort: 'title' }),
        staleTime: 60_000,
    });

    const roomsQuery = useQuery({
        queryKey: ['rooms'],
        queryFn: () => roomsApi.list(),
        staleTime: 60_000,
    });

    const showtimesQuery = useQuery({
        queryKey: ['showtimes', 'admin', date],
        queryFn: () => showtimesApi.list({ date, limit: 100, upcomingOnly: false }),
        placeholderData: keepPreviousData,
    });

    const create = useMutation({
        mutationFn: () =>
            showtimesApi.create({
                movieId,
                roomId,
                startsAt: localInputToIso(startsAt),
                format,
                language,
                basePrice: Number(basePrice),
                turnoverMinutes: Number(turnoverMinutes),
            }),
        onSuccess: () => {
            toast.success('Sessão criada.');
            void queryClient.invalidateQueries({ queryKey: ['showtimes'] });
            setIsCreating(false);
        },
        onError: (error) => {
            const apiError = toApiError(error);
            // O 409 vem da constraint EXCLUDE do Postgres: a sala já tem
            // outra sessão naquele intervalo.
            toast.error(
                apiError.code === 'SHOWTIME_OVERLAP' ? 'Conflito de horário' : 'Não foi possível criar',
                apiError.message,
            );
        },
    });

    const cancel = useMutation({
        mutationFn: (id: string) => showtimesApi.remove(id),
        onSuccess: () => {
            toast.success('Sessão cancelada.');
            void queryClient.invalidateQueries({ queryKey: ['showtimes'] });
        },
        onError: (error) => toast.error('Não foi possível cancelar', toApiError(error).message),
    });

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        create.mutate();
    };

    const sessions = showtimesQuery.data?.data ?? [];

    return (
        <div>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold">Sessões</h2>
                    <p className="text-sm text-cream-faint">
                        O sistema recusa automaticamente horários que se sobrepõem na mesma sala.
                    </p>
                </div>
                <div className="flex items-end gap-3">
                    <Input
                        type="date"
                        label="Dia"
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                    />
                    <Button onClick={() => setIsCreating(true)}>Nova sessão</Button>
                </div>
            </div>

            {showtimesQuery.isPending ? (
                <div className="space-y-2">
                    {Array.from({ length: 6 }, (_, index) => (
                        <Skeleton key={index} className="h-14" />
                    ))}
                </div>
            ) : showtimesQuery.isError ? (
                <ErrorState
                    message="Não foi possível carregar as sessões."
                    onRetry={() => void showtimesQuery.refetch()}
                />
            ) : sessions.length === 0 ? (
                <Card className="p-10 text-center text-sm text-cream-faint">
                    Nenhuma sessão programada para este dia.
                </Card>
            ) : (
                <Card className="overflow-x-auto">
                    <table className="w-full min-w-[44rem] text-sm">
                        <thead className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-cream-faint">
                            <tr>
                                <th scope="col" className="px-4 py-3 font-medium">Horário</th>
                                <th scope="col" className="px-4 py-3 font-medium">Filme</th>
                                <th scope="col" className="px-4 py-3 font-medium">Sala</th>
                                <th scope="col" className="px-4 py-3 font-medium">Formato</th>
                                <th scope="col" className="px-4 py-3 font-medium">Preço</th>
                                <th scope="col" className="px-4 py-3 font-medium">Ocupação</th>
                                <th scope="col" className="px-4 py-3" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ink-700">
                            {sessions.map((showtime) => (
                                <tr key={showtime.id}>
                                    <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums">
                                        {formatTime(showtime.startsAt)}
                                        <span className="text-cream-faint">
                                            {' – '}
                                            {formatTime(showtime.endsAt)}
                                        </span>
                                    </td>
                                    <td className="max-w-52 truncate px-4 py-3">
                                        {showtime.movie.title}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-cream-dim">
                                        {showtime.room.name}
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge tone="accent">{showtime.format}</Badge>
                                        <span className="ml-1.5 text-xs text-cream-faint">
                                            {LANGUAGE_LABELS[showtime.language]}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3">
                                        {formatMoney(showtime.basePrice)}
                                    </td>
                                    <td className="px-4 py-3 text-cream-dim">
                                        {showtime.occupancy.taken}/{showtime.occupancy.total}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <Button
                                            variant="danger"
                                            size="sm"
                                            isLoading={
                                                cancel.isPending && cancel.variables === showtime.id
                                            }
                                            onClick={() => cancel.mutate(showtime.id)}
                                        >
                                            Cancelar
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            <Modal
                open={isCreating}
                onClose={() => setIsCreating(false)}
                title="Nova sessão"
                description="O horário de término é calculado a partir da duração do filme."
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setIsCreating(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" form="showtime-form" isLoading={create.isPending}>
                            Criar sessão
                        </Button>
                    </>
                }
            >
                <form id="showtime-form" onSubmit={handleSubmit} className="space-y-4">
                    <Select
                        label="Filme *"
                        required
                        value={movieId}
                        onChange={(event) => setMovieId(event.target.value)}
                    >
                        <option value="">Selecione…</option>
                        {(moviesQuery.data?.data ?? []).map((movie) => (
                            <option key={movie.id} value={movie.id}>
                                {movie.title} ({movie.durationMin} min)
                            </option>
                        ))}
                    </Select>

                    <Select
                        label="Sala *"
                        required
                        value={roomId}
                        onChange={(event) => setRoomId(event.target.value)}
                    >
                        <option value="">Selecione…</option>
                        {(roomsQuery.data ?? []).map((room) => (
                            <option key={room.id} value={room.id}>
                                {room.name} — {room.technology} ({room.seatSummary.total} lugares)
                            </option>
                        ))}
                    </Select>

                    <Input
                        type="datetime-local"
                        label="Início *"
                        required
                        value={startsAt}
                        onChange={(event) => setStartsAt(event.target.value)}
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Select
                            label="Formato"
                            value={format}
                            onChange={(event) => setFormat(event.target.value)}
                        >
                            {SESSION_FORMATS.map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </Select>

                        <Select
                            label="Idioma"
                            value={language}
                            onChange={(event) => setLanguage(event.target.value)}
                        >
                            {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </Select>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                            type="number"
                            label="Preço base (R$) *"
                            min={1}
                            max={1000}
                            step="0.01"
                            required
                            value={basePrice}
                            onChange={(event) => setBasePrice(event.target.value)}
                            hint="Semi-VIP ×1,4 · VIP ×1,9"
                        />
                        <Input
                            type="number"
                            label="Intervalo após o filme (min)"
                            min={0}
                            max={120}
                            value={turnoverMinutes}
                            onChange={(event) => setTurnoverMinutes(event.target.value)}
                            hint="Trailers, limpeza e troca de público"
                        />
                    </div>
                </form>
            </Modal>
        </div>
    );
}
