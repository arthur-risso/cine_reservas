import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    isLoading?: boolean;
    leftIcon?: ReactNode;
    fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
    primary:
        'bg-accent text-ink-950 hover:bg-accent-bright shadow-[0_8px_24px_-12px_var(--color-accent)] font-semibold',
    secondary: 'bg-ink-700 text-cream hover:bg-ink-600 border border-ink-600',
    ghost: 'bg-transparent text-cream-dim hover:text-cream hover:bg-ink-800',
    danger: 'bg-danger/15 text-danger hover:bg-danger/25 border border-danger/30',
};

const SIZES: Record<Size, string> = {
    sm: 'h-9 px-3.5 text-sm gap-1.5',
    md: 'h-11 px-5 text-sm gap-2',
    lg: 'h-13 px-7 text-base gap-2.5',
};

export function Button({
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    fullWidth = false,
    className,
    children,
    disabled,
    ...props
}: ButtonProps) {
    return (
        <button
            // `type` explícito: dentro de <form> o padrão do HTML é "submit",
            // então um botão de "Filtrar" enviaria o formulário sem querer.
            type={props.type ?? 'button'}
            // Desabilita durante o carregamento para impedir clique duplo —
            // em "Confirmar reserva" isso seria uma segunda requisição real.
            disabled={disabled || isLoading}
            className={cn(
                'inline-flex items-center justify-center rounded-xl transition-all duration-200 select-none',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
                'active:scale-[0.98]',
                VARIANTS[variant],
                SIZES[size],
                fullWidth && 'w-full',
                className,
            )}
            {...props}
        >
            {isLoading ? (
                <span
                    className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin"
                    aria-hidden="true"
                />
            ) : (
                leftIcon
            )}
            {children}
        </button>
    );
}
