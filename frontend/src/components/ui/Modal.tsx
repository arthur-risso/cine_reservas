import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
}

/**
 * Diálogo modal acessível.
 *
 * Usa `<dialog>` nativo com `showModal()`, o que entrega de graça o que
 * costuma ser reimplementado errado: foco preso dentro do diálogo, fechar
 * no Esc, inertização do resto da página para leitores de tela e a camada
 * de fundo (::backdrop) na ordem de empilhamento correta.
 *
 * O portal garante que o diálogo não herde `overflow: hidden` nem contexto
 * de empilhamento de algum contêiner pai.
 */
export function Modal({ open, onClose, title, description, children, footer }: ModalProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (open && !dialog.open) {
            dialog.showModal();
            // Trava a rolagem do fundo: sem isso a página atrás rola junto
            // com o scroll do modal no celular.
            document.body.style.overflow = 'hidden';
        } else if (!open && dialog.open) {
            dialog.close();
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [open]);

    if (!open) return null;

    return createPortal(
        <dialog
            ref={dialogRef}
            // O Esc dispara 'cancel'; sem tratar, o React e o DOM ficariam
            // com estados diferentes (fechado na tela, aberto no estado).
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
            onClick={(event) => {
                // Clique no ::backdrop chega no próprio <dialog>.
                if (event.target === dialogRef.current) onClose();
            }}
            aria-labelledby="modal-title"
            className="m-auto w-[min(42rem,calc(100vw-2rem))] rounded-2xl border border-ink-700 bg-ink-850 p-0 text-cream backdrop:bg-ink-950/75 backdrop:backdrop-blur-sm"
        >
            <div className="flex items-start justify-between gap-4 border-b border-ink-700 px-5 py-4">
                <div>
                    <h2 id="modal-title" className="text-lg font-semibold">
                        {title}
                    </h2>
                    {description && (
                        <p className="mt-0.5 text-sm text-cream-faint">{description}</p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Fechar"
                    className="rounded-lg p-1.5 text-cream-faint transition-colors hover:bg-ink-800 hover:text-cream"
                >
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
                        <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                    </svg>
                </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto px-5 py-5">{children}</div>

            {footer && (
                <div className="flex justify-end gap-2 border-t border-ink-700 bg-ink-900/60 px-5 py-4">
                    {footer}
                </div>
            )}
        </dialog>,
        document.body,
    );
}
