import { useEffect, useState } from 'react';
import { formatCountdown } from '../../lib/format';
import { cn } from '../../lib/cn';

interface CountdownProps {
    /** Instante ISO em que a reserva expira. */
    expiresAt: string;
    onExpire?: () => void;
}

/**
 * Cronômetro regressivo da reserva.
 *
 * Detalhe que evita um bug clássico: o tempo restante é recalculado a partir
 * de `expiresAt` a cada tique, em vez de decrementar um contador.
 *
 * Por quê? Navegadores congelam `setInterval` em abas em segundo plano. Um
 * contador decrementado ficaria "atrasado" — mostraria 8 minutos quando a
 * reserva já expirou há tempo. Comparando com o relógio, voltar para a aba
 * mostra a verdade na hora.
 */
export function Countdown({ expiresAt, onExpire }: CountdownProps) {
    const [secondsLeft, setSecondsLeft] = useState(() =>
        Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)),
    );

    useEffect(() => {
        const target = new Date(expiresAt).getTime();

        const tick = () => {
            const remaining = Math.max(0, Math.floor((target - Date.now()) / 1000));
            setSecondsLeft(remaining);
            if (remaining === 0) onExpire?.();
        };

        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [expiresAt, onExpire]);

    const isUrgent = secondsLeft <= 60;
    const isWarning = secondsLeft <= 180;

    return (
        <div
            className={cn(
                'flex items-center gap-2 rounded-xl border px-3.5 py-2',
                isUrgent
                    ? 'border-danger/40 bg-danger/10'
                    : isWarning
                      ? 'border-warning/40 bg-warning/10'
                      : 'border-ink-600 bg-ink-800',
            )}
        >
            <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className={cn(
                    'size-4',
                    isUrgent ? 'text-danger' : isWarning ? 'text-warning' : 'text-cream-dim',
                )}
                aria-hidden="true"
            >
                <circle cx="10" cy="10" r="7.5" />
                <path d="M10 6v4l2.5 2" strokeLinecap="round" />
            </svg>

            <div className="leading-tight">
                <p className="text-[10px] uppercase tracking-wide text-cream-faint">
                    Tempo para confirmar
                </p>
                {/**
                 * `tabular-nums` trava a largura dos dígitos: sem isso o
                 * texto "pula" a cada segundo, porque 1 é mais estreito que 8.
                 * `aria-live=off` porque anunciar a cada segundo seria ruído
                 * insuportável em leitor de tela.
                 */}
                <p
                    aria-live="off"
                    className={cn(
                        'font-display text-lg font-bold tabular-nums',
                        isUrgent ? 'text-danger' : isWarning ? 'text-warning' : 'text-cream',
                    )}
                >
                    {formatCountdown(secondsLeft)}
                </p>
            </div>
        </div>
    );
}
