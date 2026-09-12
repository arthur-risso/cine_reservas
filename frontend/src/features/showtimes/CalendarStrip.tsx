import type { CalendarDay } from '../../api/types';
import { cn } from '../../lib/cn';
import { dayLabel, formatDayMonth } from '../../lib/format';

interface CalendarStripProps {
    days: CalendarDay[];
    selected: string | null;
    onSelect: (day: string) => void;
}

/**
 * Calendário de disponibilidade.
 *
 * Mostra apenas os dias que REALMENTE têm sessão — um calendário de mês
 * inteiro com 26 dias desabilitados obriga o usuário a caçar onde clicar.
 * Aqui cada cartão já é uma opção válida, com a contagem de sessões e os
 * formatos disponíveis naquele dia.
 */
export function CalendarStrip({ days, selected, onSelect }: CalendarStripProps) {
    if (days.length === 0) {
        return (
            <p className="rounded-xl border border-dashed border-ink-600 px-4 py-6 text-center text-sm text-cream-faint">
                Nenhuma sessão programada para os próximos dias.
            </p>
        );
    }

    return (
        <div
            role="radiogroup"
            aria-label="Escolha o dia da sessão"
            // overflow-x-auto com snap: no celular vira um carrossel que
            // "encaixa" em cada dia em vez de parar no meio de um cartão.
            className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2"
        >
            {days.map((day) => {
                const isSelected = day.day === selected;

                return (
                    <button
                        key={day.day}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => onSelect(day.day)}
                        className={cn(
                            'flex min-w-[5.5rem] shrink-0 snap-start flex-col items-center gap-0.5 rounded-xl border px-3 py-3 transition-all duration-200',
                            isSelected
                                ? 'border-accent bg-accent/12 text-cream'
                                : 'border-ink-700 bg-ink-850 text-cream-dim hover:border-ink-500 hover:bg-ink-800',
                        )}
                    >
                        <span
                            className={cn(
                                'text-[11px] font-medium uppercase tracking-wide',
                                isSelected ? 'text-accent' : 'text-cream-faint',
                            )}
                        >
                            {dayLabel(day.day)}
                        </span>
                        <span className="text-base font-semibold">
                            {formatDayMonth(`${day.day}T12:00:00`)}
                        </span>
                        <span className="text-[11px] text-cream-faint">
                            {day.showtimeCount} {day.showtimeCount === 1 ? 'sessão' : 'sessões'}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
