/**
 * Formatação localizada, centralizada.
 *
 * Os objetos Intl são criados UMA vez no módulo, não a cada chamada:
 * instanciar `Intl.NumberFormat` é caro (carrega dados de localidade), e uma
 * grade com 500 poltronas chamaria isso 500 vezes por render.
 */

const currency = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
});

const timeFormat = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
});

const dayMonthFormat = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
});

const weekdayFormat = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });

const fullDateFormat = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
});

export const formatMoney = (value: number): string => currency.format(value);

export const formatTime = (iso: string): string => timeFormat.format(new Date(iso));

export const formatDayMonth = (iso: string): string =>
    dayMonthFormat.format(new Date(iso)).replace('.', '');

export const formatWeekday = (iso: string): string =>
    weekdayFormat.format(new Date(iso)).replace('.', '');

export const formatFullDate = (iso: string): string => fullDateFormat.format(new Date(iso));

/** 166 -> "2h46" */
export function formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    if (hours === 0) return `${rest}min`;
    return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`;
}

/** 599 -> "09:59" */
export function formatCountdown(totalSeconds: number): string {
    const safe = Math.max(0, totalSeconds);
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * "AAAA-MM-DD" no fuso LOCAL.
 *
 * `toISOString().slice(0,10)` parece resolver, mas converte para UTC: às
 * 21h de Brasília ele já devolve o dia seguinte, e o calendário mostraria
 * a programação errada por três horas todo dia.
 */
export function toLocalDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function isToday(dayKey: string): boolean {
    return dayKey === toLocalDateKey(new Date());
}

export function isTomorrow(dayKey: string): boolean {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return dayKey === toLocalDateKey(tomorrow);
}

/** Rótulo amigável para o calendário: "Hoje", "Amanhã" ou "sex". */
export function dayLabel(dayKey: string): string {
    if (isToday(dayKey)) return 'Hoje';
    if (isTomorrow(dayKey)) return 'Amanhã';
    // `T12:00` evita que o parse caia no dia anterior por causa do fuso.
    return formatWeekday(`${dayKey}T12:00:00`);
}
