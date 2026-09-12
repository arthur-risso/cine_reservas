import { Link } from 'react-router-dom';
import { LANGUAGE_LABELS, type Showtime } from '../../api/types';
import { Badge } from '../../components/ui';
import { formatMoney, formatTime } from '../../lib/format';
import { cn } from '../../lib/cn';

/** Barra de ocupação: dá a sensação de urgência sem precisar de texto. */
function OccupancyBar({ percentage }: { percentage: number }) {
    const tone =
        percentage >= 90 ? 'bg-danger' : percentage >= 60 ? 'bg-warning' : 'bg-success';

    return (
        <div
            className="h-1 w-full overflow-hidden rounded-full bg-ink-700"
            role="img"
            aria-label={`${percentage}% das poltronas ocupadas`}
        >
            <div
                className={cn('h-full rounded-full transition-all duration-500', tone)}
                style={{ width: `${Math.max(percentage, 2)}%` }}
            />
        </div>
    );
}

export function ShowtimeCard({ showtime }: { showtime: Showtime }) {
    const soldOut = showtime.occupancy.available === 0;

    const content = (
        <>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="font-display text-xl font-semibold text-cream">
                        {formatTime(showtime.startsAt)}
                    </p>
                    <p className="mt-0.5 text-xs text-cream-faint">
                        até {formatTime(showtime.endsAt)}
                    </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                    <Badge tone="accent">{showtime.format}</Badge>
                    <span className="text-[11px] text-cream-faint">
                        {LANGUAGE_LABELS[showtime.language]}
                    </span>
                </div>
            </div>

            <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="text-cream-dim">
                        {showtime.room.name}
                        <span className="text-cream-faint"> · {showtime.room.technology}</span>
                    </span>
                    <span className="font-medium text-cream">
                        {formatMoney(showtime.basePrice)}
                    </span>
                </div>

                <OccupancyBar percentage={showtime.occupancy.percentage} />

                <p className="text-[11px] text-cream-faint">
                    {soldOut
                        ? 'Sessão esgotada'
                        : `${showtime.occupancy.available} de ${showtime.occupancy.total} poltronas livres`}
                </p>
            </div>
        </>
    );

    if (soldOut) {
        return (
            <div
                aria-disabled="true"
                className="cursor-not-allowed rounded-2xl border border-ink-700 bg-ink-850/50 p-4 opacity-55"
            >
                {content}
            </div>
        );
    }

    return (
        <Link
            to={`/sessoes/${showtime.id}/poltronas`}
            className="block rounded-2xl border border-ink-700 bg-ink-850 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:bg-ink-800"
        >
            {content}
        </Link>
    );
}
