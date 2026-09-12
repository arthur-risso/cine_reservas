import { api } from './client';
import type {
    CalendarDay,
    Movie,
    Paginated,
    Reservation,
    Room,
    RoomDetail,
    SeatMap,
    Showtime,
    TicketKind,
    User,
} from './types';

/** Resposta de recurso único: `{ data: ... }`. */
interface Envelope<T> {
    data: T;
}

export interface MovieFilters {
    q?: string;
    genre?: string[];
    ageRating?: string[];
    format?: string[];
    date?: string;
    roomId?: string;
    sort?: 'relevance' | 'title' | 'release' | 'soonest';
    page?: number;
    limit?: number;
}

/**
 * Monta a query string ignorando filtros vazios.
 *
 * Sem essa limpeza a URL vira `?q=&genre=&page=1` — feia para o usuário e
 * ruim para o cache: cada variação de string vazia seria uma chave diferente
 * no React Query e no cache HTTP.
 */
function toParams(filters: object): URLSearchParams {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === '') continue;

        if (Array.isArray(value)) {
            if (value.length > 0) params.set(key, value.join(','));
        } else {
            params.set(key, String(value));
        }
    }

    return params;
}

export const authApi = {
    login: (email: string, password: string) =>
        api
            .post<{ user: User; accessToken: string }>('/api/auth/login', { email, password })
            .then((response) => response.data),

    register: (name: string, email: string, password: string) =>
        api
            .post<{ user: User; accessToken: string }>('/api/auth/register', {
                name,
                email,
                password,
            })
            .then((response) => response.data),

    refresh: () =>
        api
            .post<{ user: User; accessToken: string }>('/api/auth/refresh')
            .then((response) => response.data),

    logout: () => api.post('/api/auth/logout').then(() => undefined),

    me: () => api.get<Envelope<User>>('/api/auth/me').then((response) => response.data.data),
};

export const moviesApi = {
    list: (filters: MovieFilters = {}) =>
        api
            .get<Paginated<Movie>>(`/api/movies?${toParams(filters)}`)
            .then((response) => response.data),

    byId: (id: string) =>
        api.get<Envelope<Movie>>(`/api/movies/${id}`).then((response) => response.data.data),

    genres: () =>
        api
            .get<Envelope<Array<{ genre: string; total: number }>>>('/api/movies/genres')
            .then((response) => response.data.data),

    calendar: (id: string, days = 14) =>
        api
            .get<Envelope<CalendarDay[]>>(`/api/movies/${id}/calendar?days=${days}`)
            .then((response) => response.data.data),

    create: (payload: Record<string, unknown>) =>
        api.post<Envelope<Movie>>('/api/movies', payload).then((response) => response.data.data),

    update: (id: string, payload: Record<string, unknown>) =>
        api
            .patch<Envelope<Movie>>(`/api/movies/${id}`, payload)
            .then((response) => response.data.data),

    remove: (id: string) => api.delete(`/api/movies/${id}`).then(() => undefined),
};

export interface ShowtimeFilters {
    movieId?: string;
    roomId?: string;
    date?: string;
    format?: string[];
    language?: string[];
    upcomingOnly?: boolean;
    page?: number;
    limit?: number;
}

export const showtimesApi = {
    list: (filters: ShowtimeFilters = {}) =>
        api
            .get<Paginated<Showtime>>(`/api/showtimes?${toParams(filters)}`)
            .then((response) => response.data),

    byId: (id: string) =>
        api.get<Envelope<Showtime>>(`/api/showtimes/${id}`).then((response) => response.data.data),

    seatMap: (id: string) =>
        api
            .get<Envelope<SeatMap>>(`/api/showtimes/${id}/seats`)
            .then((response) => response.data.data),

    create: (payload: Record<string, unknown>) =>
        api
            .post<Envelope<Showtime>>('/api/showtimes', payload)
            .then((response) => response.data.data),

    update: (id: string, payload: Record<string, unknown>) =>
        api
            .patch<Envelope<Showtime>>(`/api/showtimes/${id}`, payload)
            .then((response) => response.data.data),

    remove: (id: string) => api.delete(`/api/showtimes/${id}`).then(() => undefined),
};

export const roomsApi = {
    list: (includeInactive = false) =>
        api
            .get<Envelope<Room[]>>(`/api/rooms?${toParams({ includeInactive })}`)
            .then((response) => response.data.data),

    byId: (id: string) =>
        api.get<Envelope<RoomDetail>>(`/api/rooms/${id}`).then((response) => response.data.data),

    create: (payload: Record<string, unknown>) =>
        api.post<Envelope<Room>>('/api/rooms', payload).then((response) => response.data.data),

    update: (id: string, payload: Record<string, unknown>) =>
        api.patch<Envelope<Room>>(`/api/rooms/${id}`, payload).then((response) => response.data.data),

    remove: (id: string) => api.delete(`/api/rooms/${id}`).then(() => undefined),
};

export const reservationsApi = {
    create: (showtimeId: string, seats: Array<{ seatId: string; ticketKind: TicketKind }>) =>
        api
            .post<Envelope<Reservation>>('/api/reservations', { showtimeId, seats })
            .then((response) => response.data.data),

    mine: (filters: { status?: string; page?: number; limit?: number } = {}) =>
        api
            .get<Paginated<Reservation>>(`/api/reservations/me?${toParams(filters)}`)
            .then((response) => response.data),

    byId: (id: string) =>
        api
            .get<Envelope<Reservation>>(`/api/reservations/${id}`)
            .then((response) => response.data.data),

    confirm: (id: string) =>
        api
            .post<Envelope<Reservation>>(`/api/reservations/${id}/confirm`)
            .then((response) => response.data.data),

    cancel: (id: string) =>
        api
            .post<Envelope<Reservation>>(`/api/reservations/${id}/cancel`)
            .then((response) => response.data.data),
};
