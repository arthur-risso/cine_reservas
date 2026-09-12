import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { roomsApi } from '../../api/endpoints';
import { TIER_LABELS, type SeatTier } from '../../api/types';
import { Badge, Button, Card, ErrorState, Input, Skeleton } from '../../components/ui';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../stores/toastStore';
import { toApiError } from '../../api/client';
import { cn } from '../../lib/cn';

const TIER_DOT: Record<SeatTier, string> = {
    NORMAL: 'bg-tier-normal',
    SEMI_VIP: 'bg-tier-semivip',
    VIP: 'bg-tier-vip',
};

/**
 * Prévia do mapa de poltronas antes de criar a sala.
 *
 * A distribuição por tipo é calculada com a MESMA regra do backend
 * (`seatLayout.ts`). Ver o resultado antes de salvar evita o retrabalho de
 * criar a sala, olhar o mapa e descobrir que ficou VIP demais — e como a
 * sala não pode ser redimensionada depois, esse retrabalho custaria caro.
 */
function LayoutPreview({
    rows,
    seatsPerRow,
    normalRatio,
    semiVipRatio,
}: {
    rows: number;
    seatsPerRow: number;
    normalRatio: number;
    semiVipRatio: number;
}) {
    const grid = useMemo(() => {
        const normalRows = Math.max(1, Math.round(rows * normalRatio));
        const semiVipRows = Math.round(rows * semiVipRatio);

        return Array.from({ length: rows }, (_, rowIndex) => {
            const tier: SeatTier =
                rowIndex < normalRows
                    ? 'NORMAL'
                    : rowIndex < normalRows + semiVipRows
                      ? 'SEMI_VIP'
                      : 'VIP';
            return { label: String.fromCharCode(65 + rowIndex), tier };
        });
    }, [rows, seatsPerRow, normalRatio, semiVipRatio]);

    const counts = grid.reduce<Record<SeatTier, number>>(
        (acc, row) => {
            acc[row.tier] += seatsPerRow;
            return acc;
        },
        { NORMAL: 0, SEMI_VIP: 0, VIP: 0 },
    );

    return (
        <div className="rounded-xl border border-ink-700 bg-ink-900/60 p-4">
            <div className="mx-auto mb-3 h-1 max-w-40 rounded-full bg-accent/50" />
            <p className="mb-3 text-center text-[10px] uppercase tracking-[0.25em] text-cream-faint">
                Tela
            </p>

            <div className="flex flex-col items-center gap-1 overflow-x-auto">
                {grid.map((row) => (
                    <div key={row.label} className="flex items-center gap-1">
                        <span className="w-3 text-[9px] text-cream-faint">{row.label}</span>
                        {Array.from({ length: Math.min(seatsPerRow, 20) }, (_, index) => (
                            <span
                                key={index}
                                className={cn('size-2 rounded-[2px] opacity-70', TIER_DOT[row.tier])}
                            />
                        ))}
                        {seatsPerRow > 20 && (
                            <span className="text-[9px] text-cream-faint">+{seatsPerRow - 20}</span>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-4 flex flex-wrap justify-center gap-3 text-[11px] text-cream-dim">
                {(Object.keys(counts) as SeatTier[]).map((tier) => (
                    <span key={tier} className="flex items-center gap-1.5">
                        <span className={cn('size-2.5 rounded-full', TIER_DOT[tier])} />
                        {TIER_LABELS[tier]}: {counts[tier]}
                    </span>
                ))}
                <span className="font-medium text-cream">Total: {rows * seatsPerRow}</span>
            </div>
        </div>
    );
}

export default function AdminRooms() {
    const queryClient = useQueryClient();
    const [isCreating, setIsCreating] = useState(false);

    const [name, setName] = useState('');
    const [technology, setTechnology] = useState('Padrão');
    const [rowsCount, setRowsCount] = useState(8);
    const [seatsPerRow, setSeatsPerRow] = useState(12);
    const [normalRatio, setNormalRatio] = useState(0.45);
    const [semiVipRatio, setSemiVipRatio] = useState(0.35);

    const roomsQuery = useQuery({
        queryKey: ['rooms', 'admin'],
        queryFn: () => roomsApi.list(true),
    });

    const create = useMutation({
        mutationFn: () =>
            roomsApi.create({
                name: name.trim(),
                technology: technology.trim(),
                rowsCount,
                seatsPerRow,
                normalRatio,
                semiVipRatio,
            }),
        onSuccess: (room) => {
            toast.success('Sala criada.', `${room.seatSummary.total} poltronas geradas.`);
            void queryClient.invalidateQueries({ queryKey: ['rooms'] });
            setIsCreating(false);
            setName('');
        },
        onError: (error) => toast.error('Não foi possível criar a sala', toApiError(error).message),
    });

    const deactivate = useMutation({
        mutationFn: (id: string) => roomsApi.remove(id),
        onSuccess: () => {
            toast.success('Sala desativada.');
            void queryClient.invalidateQueries({ queryKey: ['rooms'] });
        },
        onError: (error) => toast.error('Não foi possível desativar', toApiError(error).message),
    });

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        create.mutate();
    };

    const rooms = roomsQuery.data ?? [];

    return (
        <div>
            <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold">Salas</h2>
                    <p className="text-sm text-cream-faint">
                        As poltronas são geradas automaticamente ao criar a sala.
                    </p>
                </div>
                <Button onClick={() => setIsCreating(true)}>Nova sala</Button>
            </div>

            {roomsQuery.isPending ? (
                <div className="grid gap-4 sm:grid-cols-2">
                    {Array.from({ length: 4 }, (_, index) => (
                        <Skeleton key={index} className="h-40" />
                    ))}
                </div>
            ) : roomsQuery.isError ? (
                <ErrorState
                    message="Não foi possível carregar as salas."
                    onRetry={() => void roomsQuery.refetch()}
                />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {rooms.map((room) => (
                        <Card key={room.id} className="p-5">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold">{room.name}</h3>
                                        {!room.isActive && <Badge tone="danger">inativa</Badge>}
                                    </div>
                                    <p className="mt-0.5 text-xs text-cream-faint">
                                        {room.technology} · {room.rowsCount} fileiras ×{' '}
                                        {room.seatsPerRow}
                                    </p>
                                </div>
                                <span className="font-display text-2xl font-bold text-accent">
                                    {room.seatSummary.total}
                                </span>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-3 text-xs text-cream-dim">
                                <span className="flex items-center gap-1.5">
                                    <span className="size-2.5 rounded-full bg-tier-normal" />
                                    Normal: {room.seatSummary.normal}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="size-2.5 rounded-full bg-tier-semivip" />
                                    Semi-VIP: {room.seatSummary.semiVip}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="size-2.5 rounded-full bg-tier-vip" />
                                    VIP: {room.seatSummary.vip}
                                </span>
                            </div>

                            {room.isActive && (
                                <Button
                                    variant="danger"
                                    size="sm"
                                    className="mt-4"
                                    isLoading={deactivate.isPending && deactivate.variables === room.id}
                                    onClick={() => deactivate.mutate(room.id)}
                                >
                                    Desativar sala
                                </Button>
                            )}
                        </Card>
                    ))}
                </div>
            )}

            <Modal
                open={isCreating}
                onClose={() => setIsCreating(false)}
                title="Nova sala"
                description="As dimensões não podem ser alteradas depois — confira a prévia."
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setIsCreating(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" form="room-form" isLoading={create.isPending}>
                            Criar sala
                        </Button>
                    </>
                }
            >
                <form id="room-form" onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                            label="Nome *"
                            required
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Sala 5"
                        />
                        <Input
                            label="Tecnologia"
                            value={technology}
                            onChange={(event) => setTechnology(event.target.value)}
                            placeholder="IMAX Laser"
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                            type="number"
                            label="Fileiras *"
                            min={1}
                            max={26}
                            required
                            value={rowsCount}
                            onChange={(event) => setRowsCount(Number(event.target.value))}
                            hint="Máximo 26 (A–Z)"
                        />
                        <Input
                            type="number"
                            label="Poltronas por fileira *"
                            min={1}
                            max={40}
                            required
                            value={seatsPerRow}
                            onChange={(event) => setSeatsPerRow(Number(event.target.value))}
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label
                                htmlFor="normal-ratio"
                                className="mb-1.5 block text-sm font-medium text-cream-dim"
                            >
                                Fileiras Normais: {Math.round(normalRatio * 100)}%
                            </label>
                            <input
                                id="normal-ratio"
                                type="range"
                                min={0}
                                max={100}
                                value={normalRatio * 100}
                                onChange={(event) => setNormalRatio(Number(event.target.value) / 100)}
                                className="w-full accent-[var(--color-tier-normal)]"
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="semivip-ratio"
                                className="mb-1.5 block text-sm font-medium text-cream-dim"
                            >
                                Fileiras Semi-VIP: {Math.round(semiVipRatio * 100)}%
                            </label>
                            <input
                                id="semivip-ratio"
                                type="range"
                                min={0}
                                max={100 - Math.round(normalRatio * 100)}
                                value={semiVipRatio * 100}
                                onChange={(event) => setSemiVipRatio(Number(event.target.value) / 100)}
                                className="w-full accent-[var(--color-tier-semivip)]"
                            />
                        </div>
                    </div>

                    <LayoutPreview
                        rows={rowsCount}
                        seatsPerRow={seatsPerRow}
                        normalRatio={normalRatio}
                        semiVipRatio={semiVipRatio}
                    />
                </form>
            </Modal>
        </div>
    );
}
