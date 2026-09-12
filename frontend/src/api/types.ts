/**
 * Contrato da API, espelhando os DTOs do backend.
 *
 * Ficam em um arquivo só, e não espalhados nos componentes, porque é a
 * fronteira entre os dois projetos: quando o backend muda um campo, o
 * TypeScript aponta exatamente quais telas quebram.
 */

export type SeatTier = 'NORMAL' | 'SEMI_VIP' | 'VIP';
export type SeatStatus = 'AVAILABLE' | 'HELD' | 'SOLD' | 'MINE';
export type TicketKind = 'FULL' | 'HALF';
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
export type SessionFormat = '2D' | '3D' | 'IMAX' | '4DX';
export type SessionLanguage = 'DUBBED' | 'SUBTITLED' | 'ORIGINAL';
export type UserRole = 'CLIENT' | 'ADMIN';

export interface PageMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
}

export interface Paginated<T> {
    data: T[];
    meta: PageMeta;
}

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    created_at: string;
}

export interface Movie {
    id: string;
    title: string;
    originalTitle: string | null;
    synopsis: string;
    durationMin: number;
    genres: string[];
    ageRating: string;
    director: string | null;
    cast: string[];
    posterUrl: string | null;
    backdropUrl: string | null;
    trailerUrl: string | null;
    releaseDate: string | null;
    isActive: boolean;
    nextShowtime?: string | null;
}

export interface CalendarDay {
    day: string;
    showtimeCount: number;
    firstStart: string;
    formats: SessionFormat[];
}

export interface Showtime {
    id: string;
    startsAt: string;
    endsAt: string;
    format: SessionFormat;
    language: SessionLanguage;
    basePrice: number;
    isActive: boolean;
    movie: {
        id: string;
        title: string;
        durationMin: number;
        posterUrl: string | null;
        ageRating: string;
    };
    room: { id: string; name: string; technology: string };
    occupancy: { total: number; taken: number; available: number; percentage: number };
}

export interface SeatMapSeat {
    id: string;
    label: string;
    rowLabel: string;
    seatNumber: number;
    tier: SeatTier;
    isAccessible: boolean;
    status: SeatStatus;
    price: number;
}

export interface SeatMap {
    showtime: Showtime;
    rows: Array<{ label: string; seats: SeatMapSeat[] }>;
    tiers: Array<{ tier: SeatTier; price: number }>;
    summary: { total: number; available: number };
}

export interface Reservation {
    id: string;
    code: string;
    status: ReservationStatus;
    totalAmount: number;
    expiresAt: string | null;
    createdAt: string;
    secondsToExpire: number | null;
    showtime: {
        id: string;
        startsAt: string;
        endsAt: string;
        format: SessionFormat;
        language: SessionLanguage;
        movieTitle: string;
        moviePosterUrl: string | null;
        movieDurationMin: number;
        roomName: string;
        roomTechnology: string;
    };
    seats: Array<{
        id: string;
        label: string;
        tier: SeatTier;
        ticketKind: TicketKind;
        unitPrice: number;
    }>;
}

export interface Room {
    id: string;
    name: string;
    technology: string;
    rowsCount: number;
    seatsPerRow: number;
    isActive: boolean;
    seatSummary: { total: number; normal: number; semiVip: number; vip: number };
}

export interface RoomDetail extends Room {
    seats: Array<{
        id: string;
        rowLabel: string;
        seatNumber: number;
        tier: SeatTier;
        isAccessible: boolean;
        label: string;
    }>;
}

/** Rótulos em português, definidos uma vez e usados em toda a interface. */
export const TIER_LABELS: Record<SeatTier, string> = {
    NORMAL: 'Normal',
    SEMI_VIP: 'Semi-VIP',
    VIP: 'VIP',
};

export const LANGUAGE_LABELS: Record<SessionLanguage, string> = {
    DUBBED: 'Dublado',
    SUBTITLED: 'Legendado',
    ORIGINAL: 'Original',
};

export const STATUS_LABELS: Record<ReservationStatus, string> = {
    PENDING: 'Aguardando confirmação',
    CONFIRMED: 'Confirmada',
    CANCELLED: 'Cancelada',
    EXPIRED: 'Expirada',
};

export const AGE_RATINGS = ['L', '10', '12', '14', '16', '18'] as const;
export const SESSION_FORMATS: SessionFormat[] = ['2D', '3D', 'IMAX', '4DX'];
