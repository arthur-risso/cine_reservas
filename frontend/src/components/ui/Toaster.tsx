import { useToastStore, type ToastTone } from '../../stores/toastStore';
import { cn } from '../../lib/cn';

const TONE_STYLES: Record<ToastTone, string> = {
    success: 'border-success/40 bg-success/10',
    error: 'border-danger/40 bg-danger/10',
    info: 'border-accent/40 bg-accent/10',
};

const TONE_ICONS: Record<ToastTone, string> = {
    success: 'M4.5 10.5l3.5 3.5 7.5-7.5',
    error: 'M10 6v5m0 3h.01M10 18a8 8 0 100-16 8 8 0 000 16z',
    info: 'M10 13V9m0-3h.01M10 18a8 8 0 100-16 8 8 0 000 16z',
};

const TONE_COLORS: Record<ToastTone, string> = {
    success: 'text-success',
    error: 'text-danger',
    info: 'text-accent',
};

export function Toaster() {
    const toasts = useToastStore((state) => state.toasts);
    const dismiss = useToastStore((state) => state.dismiss);

    return (
        /**
         * `aria-live="polite"` faz o leitor de tela anunciar o aviso quando
         * ele aparece, sem interromper o que o usuário está fazendo.
         * `pointer-events-none` no contêiner impede que a área invisível
         * bloqueie cliques na página; cada card reativa o próprio evento.
         */
        <div
            aria-live="polite"
            aria-atomic="false"
            className="pointer-events-none fixed bottom-4 right-4 z-100 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
        >
            {toasts.map((item) => (
                <div
                    key={item.id}
                    className={cn(
                        'pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 backdrop-blur-md shadow-lift',
                        TONE_STYLES[item.tone],
                    )}
                    style={{ animation: 'fade-rise 260ms var(--ease-out-soft)' }}
                >
                    <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={cn('mt-0.5 size-5 shrink-0', TONE_COLORS[item.tone])}
                        aria-hidden="true"
                    >
                        <path d={TONE_ICONS[item.tone]} />
                    </svg>

                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-cream">{item.title}</p>
                        {item.description && (
                            <p className="mt-0.5 text-xs leading-relaxed text-cream-dim">
                                {item.description}
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => dismiss(item.id)}
                        aria-label="Fechar aviso"
                        className="-mr-1 -mt-1 rounded-lg p-1 text-cream-faint transition-colors hover:text-cream"
                    >
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
                            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>
            ))}
        </div>
    );
}
