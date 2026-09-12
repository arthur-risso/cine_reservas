import { memo } from 'react';
import type { SeatMap as SeatMapData, SeatMapSeat, SeatTier } from '../../api/types';
import { TIER_LABELS } from '../../api/types';
import { formatMoney } from '../../lib/format';
import { cn } from '../../lib/cn';

interface SeatMapProps {
    data: SeatMapData;
    selectedIds: Set<string>;
    maxSeats: number;
    onToggle: (seat: SeatMapSeat) => void;
}

const TIER_CLASSES: Record<SeatTier, string> = {
    NORMAL: 'border-tier-normal/50 bg-tier-normal/12 text-tier-normal hover:bg-tier-normal/25',
    SEMI_VIP: 'border-tier-semivip/50 bg-tier-semivip/12 text-tier-semivip hover:bg-tier-semivip/25',
    VIP: 'border-tier-vip/50 bg-tier-vip/12 text-tier-vip hover:bg-tier-vip/25',
};

/**
 * Uma poltrona.
 *
 * `memo` importa aqui: são até 500 botões na tela e cada clique atualiza o
 * estado de seleção. Sem memoização, um clique redesenharia as 500; com ela,
 * apenas a poltrona que mudou.
 */
const Seat = memo(function Seat({
    seat,
    isSelected,
    isBlocked,
    onToggle,
}: {
    seat: SeatMapSeat;
    isSelected: boolean;
    isBlocked: boolean;
    onToggle: (seat: SeatMapSeat) => void;
}) {
    const unavailable = seat.status === 'SOLD' || seat.status === 'HELD';
    const isMine = seat.status === 'MINE';
    const disabled = unavailable || isMine || (isBlocked && !isSelected);

    /**
     * O rótulo acessível conta a história inteira: leitor de tela anuncia
     * "F7, VIP, R$ 94,05, disponível" em vez de apenas "F7". Sem isso o
     * mapa é inutilizável sem enxergar.
     */
    const statusText = isSelected
        ? 'selecionada'
        : seat.status === 'SOLD'
          ? 'vendida'
          : seat.status === 'HELD'
            ? 'reservada por outra pessoa'
            : isMine
              ? 'já está na sua reserva'
              : 'disponível';

    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={isSelected}
            aria-label={`Poltrona ${seat.label}, ${TIER_LABELS[seat.tier]}, ${formatMoney(seat.price)}, ${statusText}${seat.isAccessible ? ', acessível para cadeirante' : ''}`}
            disabled={disabled}
            onClick={() => onToggle(seat)}
            className={cn(
                'relative grid size-7 place-items-center rounded-md border text-[9px] font-semibold transition-all duration-150 sm:size-8 sm:text-[10px]',
                'disabled:cursor-not-allowed',
                isSelected &&
                    'scale-110 border-seat-selected bg-seat-selected text-ink-950 shadow-[0_0_14px_-2px_var(--color-seat-selected)]',
                !isSelected && isMine && 'border-seat-mine/60 bg-seat-mine/20 text-seat-mine',
                !isSelected &&
                    unavailable &&
                    'border-transparent bg-seat-taken text-ink-500 opacity-60',
                !isSelected &&
                    !unavailable &&
                    !isMine &&
                    TIER_CLASSES[seat.tier],
                // Poltrona bloqueada pelo limite: some o hover, mas continua
                // visível como "existe e está livre".
                isBlocked && !isSelected && !unavailable && !isMine && 'opacity-45',
            )}
            title={`${seat.label} · ${TIER_LABELS[seat.tier]} · ${formatMoney(seat.price)}`}
        >
            {seat.isAccessible ? (
                <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5" aria-hidden="true">
                    <circle cx="8" cy="2.6" r="1.6" />
                    <path d="M6.2 5h3.1v3.2h2.6a.8.8 0 010 1.6H9.3v3.6a.8.8 0 01-1.6 0V9.8a2 2 0 01-1.5-1.9V5z" />
                </svg>
            ) : (
                seat.seatNumber
            )}
        </button>
    );
});

export function SeatMap({ data, selectedIds, maxSeats, onToggle }: SeatMapProps) {
    const isBlocked = selectedIds.size >= maxSeats;

    return (
        <div className="space-y-6">
            {/**
             * A tela.
             *
             * Um trapézio com brilho na base orienta o usuário: as fileiras
             * de cima são as da frente. Sem essa referência visual, ninguém
             * sabe se a fileira A é perto ou longe da tela.
             */}
            <div className="px-4">
                <div
                    className="mx-auto h-2 max-w-2xl rounded-t-full bg-gradient-to-b from-accent/70 to-accent/10"
                    style={{ clipPath: 'polygon(6% 100%, 94% 100%, 100% 0, 0 0)' }}
                />
                <div
                    className="mx-auto h-16 max-w-3xl"
                    style={{
                        background:
                            'radial-gradient(ellipse 60% 100% at 50% 0%, var(--color-accent-glow), transparent 70%)',
                    }}
                />
                <p className="-mt-12 text-center text-[11px] uppercase tracking-[0.3em] text-cream-faint">
                    Tela
                </p>
            </div>

            {/* overflow-x-auto: uma sala IMAX com 18 poltronas por fileira
                não cabe em tela de celular; rola na horizontal em vez de
                espremer os botões a ponto de não dar para acertar o toque. */}
            <div className="overflow-x-auto pb-2">
                <div className="mx-auto flex w-fit flex-col gap-1.5 px-2">
                    {data.rows.map((row) => (
                        <div key={row.label} className="flex items-center gap-2">
                            <span className="w-4 shrink-0 text-center text-[10px] font-medium text-cream-faint">
                                {row.label}
                            </span>

                            <div className="flex gap-1.5">
                                {row.seats.map((seat, index) => (
                                    <div
                                        key={seat.id}
                                        // Corredor central: separa a fileira ao
                                        // meio, como em uma sala de verdade.
                                        className={cn(
                                            index === Math.floor(row.seats.length / 2) && 'ml-5',
                                        )}
                                    >
                                        <Seat
                                            seat={seat}
                                            isSelected={selectedIds.has(seat.id)}
                                            isBlocked={isBlocked}
                                            onToggle={onToggle}
                                        />
                                    </div>
                                ))}
                            </div>

                            <span className="w-4 shrink-0 text-center text-[10px] font-medium text-cream-faint">
                                {row.label}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <SeatLegend tiers={data.tiers} />
        </div>
    );
}

export function SeatLegend({ tiers }: { tiers: SeatMapData['tiers'] }) {
    return (
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 rounded-xl border border-ink-700 bg-ink-850/60 px-4 py-3 text-xs">
            {tiers.map((tier) => (
                <span key={tier.tier} className="flex items-center gap-1.5 text-cream-dim">
                    <span
                        className={cn('size-3 rounded border', TIER_CLASSES[tier.tier])}
                        aria-hidden="true"
                    />
                    {TIER_LABELS[tier.tier]}
                    <span className="text-cream-faint">{formatMoney(tier.price)}</span>
                </span>
            ))}

            <span className="h-4 w-px bg-ink-600" aria-hidden="true" />

            <span className="flex items-center gap-1.5 text-cream-dim">
                <span className="size-3 rounded bg-seat-selected" aria-hidden="true" />
                Selecionada
            </span>
            <span className="flex items-center gap-1.5 text-cream-dim">
                <span className="size-3 rounded bg-seat-taken" aria-hidden="true" />
                Ocupada
            </span>
        </div>
    );
}
