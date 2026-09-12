import { query, queryOne, type Queryable } from '../../db';
import type { SeatTier } from '../rooms/seatLayout';
import type { ListShowtimesQuery } from './showtimes.schema';

export interface ShowtimeRow {
    id: string;
    movie_id: string;
    room_id: string;
    starts_at: Date;
    ends_at: Date;
    format: string;
    language: string;
    base_price: number;
    is_active: boolean;
    movie_title: string;
    movie_duration: number;
    movie_poster: string | null;
    movie_age_rating: string;
    room_name: string;
    room_technology: string;
    seats_total: string;
    seats_taken: string;
}

/**
 * Sessão + filme + sala + ocupação, tudo em uma linha.
 *
 * A ocupação sai de um subselect correlacionado e não de um JOIN direto:
 * com JOIN, uma sessão com 80 lugares vendidos viraria 80 linhas que
 * precisariam ser agrupadas de volta.
 */
const SHOWTIME_SELECT = `
    SELECT s.id, s.movie_id, s.room_id, s.starts_at, s.ends_at, s.format, s.language,
           s.base_price, s.is_active,
           m.title AS movie_title, m.duration_min AS movie_duration,
           m.poster_url AS movie_poster, m.age_rating AS movie_age_rating,
           r.name AS room_name, r.technology AS room_technology,
           (SELECT count(*) FROM seats st WHERE st.room_id = s.room_id AND st.is_active)::text AS seats_total,
           (
               SELECT count(*)
               FROM reservation_seats rs
               JOIN reservations res ON res.id = rs.reservation_id
               WHERE rs.showtime_id = s.id
                 AND NOT rs.released
                 -- Reserva pendente vencida não ocupa lugar, mesmo que o
                 -- job de expiração ainda não tenha passado por ela.
                 AND (res.status = 'CONFIRMED'
                      OR (res.status = 'PENDING' AND res.expires_at > now()))
           )::text AS seats_taken
    FROM showtimes s
    JOIN movies m ON m.id = s.movie_id
    JOIN rooms r ON r.id = s.room_id
`;

export async function findShowtimes(
    filters: ListShowtimesQuery,
): Promise<{ showtimes: ShowtimeRow[]; total: number }> {
    const offset = (filters.page - 1) * filters.limit;

    const rows = await query<ShowtimeRow & { total_count: string }>(
        `${SHOWTIME_SELECT}
         WHERE s.is_active
           AND ($1::uuid IS NULL OR s.movie_id = $1::uuid)
           AND ($2::uuid IS NULL OR s.room_id = $2::uuid)
           AND ($3::date IS NULL OR s.starts_at::date = $3::date)
           AND ($4::text[] IS NULL OR s.format::text = ANY($4::text[]))
           AND ($5::text[] IS NULL OR s.language::text = ANY($5::text[]))
           AND ($6::boolean IS NOT TRUE OR s.starts_at > now())
         ORDER BY s.starts_at, r.name
         LIMIT $7 OFFSET $8`,
        [
            filters.movieId ?? null,
            filters.roomId ?? null,
            filters.date ?? null,
            filters.format ?? null,
            filters.language ?? null,
            filters.upcomingOnly,
            filters.limit,
            offset,
        ],
    );

    // O total aqui vem de uma contagem separada porque a listagem de sessões
    // costuma caber em uma página só — não vale carregar count(*) OVER()
    // em toda linha de um resultado grande.
    const totalRow = await queryOne<{ total: string }>(
        `SELECT count(*)::text AS total
         FROM showtimes s
         WHERE s.is_active
           AND ($1::uuid IS NULL OR s.movie_id = $1::uuid)
           AND ($2::uuid IS NULL OR s.room_id = $2::uuid)
           AND ($3::date IS NULL OR s.starts_at::date = $3::date)
           AND ($4::text[] IS NULL OR s.format::text = ANY($4::text[]))
           AND ($5::text[] IS NULL OR s.language::text = ANY($5::text[]))
           AND ($6::boolean IS NOT TRUE OR s.starts_at > now())`,
        [
            filters.movieId ?? null,
            filters.roomId ?? null,
            filters.date ?? null,
            filters.format ?? null,
            filters.language ?? null,
            filters.upcomingOnly,
        ],
    );

    return { showtimes: rows, total: Number(totalRow?.total ?? 0) };
}

export function findShowtimeById(id: string, executor?: Queryable): Promise<ShowtimeRow | null> {
    return queryOne<ShowtimeRow>(`${SHOWTIME_SELECT} WHERE s.id = $1`, [id], executor);
}

export interface SeatMapRow {
    id: string;
    row_label: string;
    seat_number: number;
    tier: SeatTier;
    is_accessible: boolean;
    multiplier: number;
    occupied_status: 'CONFIRMED' | 'PENDING' | null;
    occupied_by: string | null;
}

/**
 * O mapa de poltronas da sessão: TODAS as poltronas da sala + o que está
 * ocupado, em uma única consulta.
 *
 * A tentação é buscar as poltronas e depois, para cada uma, perguntar se
 * está livre — 500 idas ao banco para desenhar uma tela. O LATERAL resolve
 * em uma, e o índice único parcial de reservation_seats é exatamente o
 * índice que essa busca usa.
 */
export function findSeatMap(showtimeId: string): Promise<SeatMapRow[]> {
    return query<SeatMapRow>(
        `SELECT seat.id, seat.row_label, seat.seat_number, seat.tier, seat.is_accessible,
                tier_price.multiplier,
                occupancy.status AS occupied_status,
                occupancy.user_id AS occupied_by
         FROM showtimes st
         JOIN seats seat ON seat.room_id = st.room_id AND seat.is_active
         JOIN seat_tier_prices tier_price ON tier_price.tier = seat.tier
         LEFT JOIN LATERAL (
             SELECT res.status, res.user_id
             FROM reservation_seats rs
             JOIN reservations res ON res.id = rs.reservation_id
             WHERE rs.seat_id = seat.id
               AND rs.showtime_id = st.id
               AND NOT rs.released
               AND (res.status = 'CONFIRMED'
                    OR (res.status = 'PENDING' AND res.expires_at > now()))
             LIMIT 1
         ) occupancy ON true
         WHERE st.id = $1
         ORDER BY seat.row_label, seat.seat_number`,
        [showtimeId],
    );
}

export async function insertShowtime(params: {
    movieId: string;
    roomId: string;
    startsAt: Date;
    endsAt: Date;
    format: string;
    language: string;
    basePrice: number;
    isActive: boolean;
}): Promise<{ id: string }> {
    const rows = await query<{ id: string }>(
        `INSERT INTO showtimes (movie_id, room_id, starts_at, ends_at, format, language, base_price, is_active)
         VALUES ($1,$2,$3,$4,$5::session_format,$6::session_language,$7,$8)
         RETURNING id`,
        [
            params.movieId,
            params.roomId,
            params.startsAt,
            params.endsAt,
            params.format,
            params.language,
            params.basePrice,
            params.isActive,
        ],
    );

    return rows[0]!;
}

export async function updateShowtime(
    id: string,
    params: {
        startsAt?: Date;
        endsAt?: Date;
        format?: string;
        language?: string;
        basePrice?: number;
        isActive?: boolean;
    },
): Promise<{ id: string } | null> {
    const assignments: string[] = [];
    const values: unknown[] = [];

    const push = (column: string, value: unknown, cast = '') => {
        if (value === undefined) return;
        values.push(value);
        assignments.push(`${column} = $${values.length}${cast}`);
    };

    push('starts_at', params.startsAt);
    push('ends_at', params.endsAt);
    push('format', params.format, '::session_format');
    push('language', params.language, '::session_language');
    push('base_price', params.basePrice);
    push('is_active', params.isActive);

    if (assignments.length === 0) {
        return queryOne<{ id: string }>('SELECT id FROM showtimes WHERE id = $1', [id]);
    }

    values.push(id);

    return queryOne<{ id: string }>(
        `UPDATE showtimes SET ${assignments.join(', ')} WHERE id = $${values.length} RETURNING id`,
        values,
    );
}

/** Reservas ativas de uma sessão — bloqueiam mudança de horário e cancelamento. */
export async function countActiveReservations(showtimeId: string): Promise<number> {
    const row = await queryOne<{ total: string }>(
        `SELECT count(*)::text AS total
         FROM reservations
         WHERE showtime_id = $1
           AND (status = 'CONFIRMED' OR (status = 'PENDING' AND expires_at > now()))`,
        [showtimeId],
    );
    return Number(row?.total ?? 0);
}

export async function findMovieDuration(movieId: string): Promise<number | null> {
    const row = await queryOne<{ duration_min: number }>(
        'SELECT duration_min FROM movies WHERE id = $1 AND is_active',
        [movieId],
    );
    return row?.duration_min ?? null;
}

export async function roomExists(roomId: string): Promise<boolean> {
    const row = await queryOne<{ id: string }>(
        'SELECT id FROM rooms WHERE id = $1 AND is_active',
        [roomId],
    );
    return row !== null;
}
