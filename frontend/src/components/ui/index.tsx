import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { useId } from 'react';
import { cn } from '../../lib/cn';

export { Button } from './Button';

/* ------------------------------------------------------------------ */
/* Campos de formulário                                                */
/* ------------------------------------------------------------------ */

interface FieldProps {
    label?: string;
    error?: string;
    hint?: string;
    className?: string;
}

/**
 * `useId` gera o vínculo entre <label> e o campo.
 *
 * Sem `htmlFor`/`id`, clicar no rótulo não foca o campo e leitores de tela
 * anunciam "caixa de edição" sem dizer do quê. O React gera o id para não
 * haver colisão quando o mesmo componente aparece duas vezes na página.
 */
export function Input({
    label,
    error,
    hint,
    className,
    ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
    const id = useId();
    const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

    return (
        <div className={cn('flex flex-col gap-1.5', className)}>
            {label && (
                <label htmlFor={id} className="text-sm font-medium text-cream-dim">
                    {label}
                </label>
            )}
            <input
                id={id}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy}
                className={cn(
                    'h-11 rounded-xl bg-ink-850 border px-4 text-cream placeholder:text-cream-faint',
                    'transition-colors duration-150 outline-none',
                    'focus:border-accent focus:bg-ink-800',
                    error ? 'border-danger' : 'border-ink-600 hover:border-ink-500',
                )}
                {...props}
            />
            {error && (
                // role="alert" faz o leitor de tela anunciar o erro assim que
                // ele aparece, sem o usuário precisar navegar até o campo.
                <span id={`${id}-error`} role="alert" className="text-xs text-danger">
                    {error}
                </span>
            )}
            {hint && !error && (
                <span id={`${id}-hint`} className="text-xs text-cream-faint">
                    {hint}
                </span>
            )}
        </div>
    );
}

export function Select({
    label,
    error,
    className,
    children,
    ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
    const id = useId();

    return (
        <div className={cn('flex flex-col gap-1.5', className)}>
            {label && (
                <label htmlFor={id} className="text-sm font-medium text-cream-dim">
                    {label}
                </label>
            )}
            <select
                id={id}
                className={cn(
                    'h-11 rounded-xl bg-ink-850 border border-ink-600 px-3.5 text-cream',
                    'transition-colors duration-150 outline-none focus:border-accent hover:border-ink-500',
                    error && 'border-danger',
                )}
                {...props}
            >
                {children}
            </select>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Superfícies e rótulos                                               */
/* ------------------------------------------------------------------ */

export function Card({
    children,
    className,
    as: Tag = 'div',
}: {
    children: ReactNode;
    className?: string;
    as?: 'div' | 'article' | 'section';
}) {
    return (
        <Tag
            className={cn(
                'rounded-2xl border border-ink-700 bg-ink-850/70 backdrop-blur-sm',
                className,
            )}
        >
            {children}
        </Tag>
    );
}

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

const BADGE_TONES: Record<BadgeTone, string> = {
    neutral: 'bg-ink-700 text-cream-dim border-ink-600',
    accent: 'bg-accent/12 text-accent border-accent/30',
    success: 'bg-success/12 text-success border-success/30',
    warning: 'bg-warning/12 text-warning border-warning/30',
    danger: 'bg-danger/12 text-danger border-danger/30',
    info: 'bg-seat-mine/12 text-seat-mine border-seat-mine/30',
};

export function Badge({
    children,
    tone = 'neutral',
    className,
}: {
    children: ReactNode;
    tone?: BadgeTone;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium',
                BADGE_TONES[tone],
                className,
            )}
        >
            {children}
        </span>
    );
}

/**
 * Classificação indicativa no padrão brasileiro: cor fixa por faixa,
 * exatamente como aparece na bilheteria.
 */
const AGE_COLORS: Record<string, string> = {
    L: 'bg-[#1E9E5A] text-white',
    '10': 'bg-[#2D6FD1] text-white',
    '12': 'bg-[#E0A458] text-ink-950',
    '14': 'bg-[#E07B39] text-white',
    '16': 'bg-[#D1483C] text-white',
    '18': 'bg-[#1A1A1A] text-white border border-white/25',
};

export function AgeRating({ rating, className }: { rating: string; className?: string }) {
    return (
        <span
            className={cn(
                'inline-flex size-6 shrink-0 items-center justify-center rounded-[5px] text-[11px] font-bold',
                AGE_COLORS[rating] ?? 'bg-ink-600 text-cream',
                className,
            )}
            title={`Classificação indicativa: ${rating === 'L' ? 'Livre' : `${rating} anos`}`}
        >
            {rating}
        </span>
    );
}

/* ------------------------------------------------------------------ */
/* Estados de carregamento e vazio                                     */
/* ------------------------------------------------------------------ */

/**
 * Skeleton no lugar de spinner.
 *
 * O spinner diz "espere"; o skeleton já mostra o formato do que vem,
 * então a página não "pula" quando os dados chegam (menos layout shift)
 * e a espera parece mais curta.
 */
export function Skeleton({ className }: { className?: string }) {
    return (
        <div
            className={cn('relative overflow-hidden rounded-xl bg-ink-800', className)}
            aria-hidden="true"
        >
            <div
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
                style={{ animation: 'shimmer 1.8s infinite' }}
            />
        </div>
    );
}

export function EmptyState({
    title,
    description,
    action,
    icon,
}: {
    title: string;
    description?: string;
    action?: ReactNode;
    icon?: ReactNode;
}) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink-600 px-6 py-16 text-center">
            {icon && <div className="text-cream-faint">{icon}</div>}
            <h3 className="text-lg font-semibold text-cream">{title}</h3>
            {description && <p className="max-w-md text-sm text-cream-faint">{description}</p>}
            {action && <div className="mt-2">{action}</div>}
        </div>
    );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
    return (
        <div
            role="alert"
            className="flex flex-col items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-6 py-12 text-center"
        >
            <p className="text-sm text-cream">{message}</p>
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="text-sm font-medium text-accent hover:text-accent-bright"
                >
                    Tentar novamente
                </button>
            )}
        </div>
    );
}
