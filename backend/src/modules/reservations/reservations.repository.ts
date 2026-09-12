import type { PoolClient } from 'pg';
import { query, queryOne, type Queryable } from '../../db';
import type { SeatTier } from '../rooms/seatLayout';
import type { ListReservationsQuery } from './reservations.schema';

export interface ReservationRow {
    id: string;
    code: string;
    user_id: string;
    showtime_id: string;
    status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
    total_amount: number;
    expires_at: Date | null;
    confirmed_at: Date | null;
    cancelled_at: Date | null;
    created_at: Date;
}

export interface ReservationDetailRow extends ReservationRow {
    starts_at: Date;
    ends_at: Date;
    format: string;
    language: string;
    movie_title: string;
    movie_poster: string | null;
    movie_duration: number;
    room_name: string;
    room_technology: string;
    seats: Array<{
        id: string;
        label: string;
        tier: SeatTier;
        ticket_kind: 'FULL' | 'HALF';
        unit_price: number;
    }>;
}

/**
 * Detalhe da reserva com sessão, filme, sala e poltronas.
 *
 * As poltronas vêm como JSON agregado no próprio SELECT. A alternativa
 * (uma query para a reserva e outra para os assentos) dobra as idas ao
 * banco em uma tela que o usuário abre o tempo todo.
 */
const RESERVATION_SELECT = `
    SELECT r.id, r.code, r.user_id, r.showtime_id, r.status, r.total_amount,
           r.expires_at, r.confirmed_at, r.cancelled_at, r.created_at,
           s.starts_at, s.ends_at, s.format, s.language,
           m.title AS movie_title, m.poster_url AS movie_poster, m.duration_min AS movie_duration,
           rm.name AS room_name, rm.technology AS room_technology,
           coalesce(seats.items, '[]'::json) AS seats
    FROM reservations r
    JOIN showtimes s ON s.id = r.showtime_id
    JOIN movies m ON m.id = s.movie_id
    JOIN rooms rm ON rm.id = s.room_id
    LEFT JOIN LATERAL (
        SELECT json_agg(
                   json_build_object(
                       'id', seat.id,
                       'label', seat.row_label || seat.seat_number,
                       'tier', rs.tier,
                       'ticket_kind', rs.ticket_kind,
                       'unit_price', rs.unit_price
                   )
                   ORDER BY seat.row_label, seat.seat_number
               ) AS items
        FROM reservation_seats rs
        JOIN seats seat ON seat.id = rs.seat_id
        WHERE rs.reservation_id = r.id
    ) seats ON true
`;

export function findReservationById(
    id: string,
    executor?: Queryable,
): Promise<ReservationDetailRow | null> {
    return queryOne<ReservationDetailRow>(`${RESERVATION_SELECT} WHERE r.id = $1`, [id], executor);
}

export function findReservationByCode(code: string): Promise<ReservationDetailRow | null> {
    return queryOne<ReservationDetailRow>(`${RESERVATION_SELECT} WHERE r.code = $1`, [code]);
}

export async function findUserReservations(
    userId: string,
    filters: ListReservationsQuery,
): Promise<{ reservations: ReservationDetailRow[]; total: number }> {
    const offset = (filters.page - 1) * filters.limit;

    const reservations = await query<ReservationDetailRow>(
        `${RESERVATION_SELECT}
         WHERE r.user_id = $1
           AND ($2::text IS NULL OR r.status::text = $2::text)
         ORDER BY s.starts_at DESC
         LIMIT $3 OFFSET $4`,
        [userId, filters.status ?? null, filters.limit, offset],
    );

    const totalRow = await queryOne<{ total: string }>(
        `SELECT count(*)::text AS total FROM reservations
         WHERE user_id = $1 AND ($2::text IS NULL OR status::text = $2::text)`,
        [userId, filters.status ?? null],
    );

    return { reservations, total: Number(totalRow?.total ?? 0) };
}

export interface ShowtimeForReservation {
    id: string;
    room_id: string;
    base_price: number;
    starts_at: Date;
    is_active: boolean;
}

export function findShowtimeForReservation(
    showtimeId: string,
    client: PoolClient,
): Promise<ShowtimeForReservation | null> {
    return queryOne<ShowtimeForReservation>(
        'SELECT id, room_id, base_price, starts_at, is_active FROM showtimes WHERE id = $1',
        [showtimeId],
        client,
    );
}

export async function insertReservation(
    client: PoolClient,
    params: { code: string; userId: string; showtimeId: string; expiresAt: Date },
): Promise<ReservationRow> {
    const { rows } = await client.query<ReservationRow>(
        `INSERT INTO reservations (code, user_id, showtime_id, status, expires_at)
         VALUES ($1, $2, $3, 'PENDING', $4)
         RETURNING *`,
        [params.code, params.userId, params.showtimeId, params.expiresAt],
    );

    return rows[0]!;
}

export interface InsertedSeat {
    seat_id: string;
    unit_price: number;
    label: string;
}

/**
 * Insere as poltronas da reserva — o ponto onde a corrida é decidida.
 *
 * Três coisas acontecem em uma única instrução:
 *
 * 1. O preço é calculado NO BANCO, a partir de `base_price` da sessão e do
 *    multiplicador do tipo de poltrona. O cliente manda apenas quais lugares
 *    quer; se o preço viesse no corpo da requisição, bastaria editá-lo no
 *    DevTools para comprar VIP a R$ 1.
 *
 * 2. O JOIN com `seats` restringe à sala da sessão. Uma poltrona de outra
 *    sala simplesmente não casa, e a contagem de linhas inseridas fica menor
 *    que a pedida — é assim que detectamos a tentativa.
 *
 * 3. `ORDER BY s.id` é o detalhe que evita deadlock. Duas reservas
 *    concorrentes pelos mesmos assentos adquirem os locks do índice único na
 *    MESMA ordem; uma espera a outra e recebe 23505 limpo. Sem a ordenação,
 *    uma poderia travar em A2 enquanto a outra trava em A1, e o Postgres
 *    teria que matar uma das duas por deadlock.
 */
export async function insertReservationSeats(
    client: PoolClient,
    params: {
        reservationId: string;
        showtimeId: string;
        roomId: string;
        basePrice: number;
        seatIds: string[];
        ticketKinds: string[];
    },
): Promise<InsertedSeat[]> {
    const { rows } = await client.query<InsertedSeat>(
        `INSERT INTO reservation_seats
            (reservation_id, showtime_id, seat_id, ticket_kind, tier, unit_price)
         SELECT $1, $2, s.id, pedido.kind::ticket_kind, s.tier,
                round(
                    $3::numeric * p.multiplier *
                    CASE WHEN pedido.kind = 'HALF' THEN 0.5 ELSE 1 END,
                    2
                )
         FROM UNNEST($4::uuid[], $5::text[]) AS pedido(seat_id, kind)
         JOIN seats s ON s.id = pedido.seat_id AND s.room_id = $6 AND s.is_active
         JOIN seat_tier_prices p ON p.tier = s.tier
         ORDER BY s.id
         RETURNING seat_id, unit_price,
                   (SELECT row_label || seat_number FROM seats WHERE id = seat_id) AS label`,
        [
            params.reservationId,
            params.showtimeId,
            params.basePrice,
            params.seatIds,
            params.ticketKinds,
            params.roomId,
        ],
    );

    return rows;
}

export async function updateReservationTotal(
    client: PoolClient,
    reservationId: string,
): Promise<number> {
    const { rows } = await client.query<{ total_amount: number }>(
        `UPDATE reservations
         SET total_amount = (
             SELECT coalesce(sum(unit_price), 0)
             FROM reservation_seats
             WHERE reservation_id = $1 AND NOT released
         )
         WHERE id = $1
         RETURNING total_amount`,
        [reservationId],
    );

    return Number(rows[0]?.total_amount ?? 0);
}

/**
 * Confirma a reserva.
 *
 * As condições estão no WHERE, não em um `if` no service: entre ler o status
 * e gravá-lo, outra requisição (ou o job de expiração) pode ter mudado a
 * linha. Deixando o banco decidir, ou a atualização acontece na condição
 * correta ou não acontece — e `rowCount` conta a história.
 */
export async function confirmReservation(id: string, userId: string): Promise<ReservationRow | null> {
    return queryOne<ReservationRow>(
        `UPDATE reservations
         SET status = 'CONFIRMED', confirmed_at = now(), expires_at = NULL
         WHERE id = $1
           AND user_id = $2
           AND status = 'PENDING'
           AND expires_at > now()
         RETURNING *`,
        [id, userId],
    );
}

/**
 * Cancela e devolve as poltronas ao mapa.
 *
 * `released = true` é o que libera o assento no índice único parcial: a
 * linha continua existindo como histórico, mas deixa de bloquear novas
 * vendas daquele lugar.
 */
export async function cancelReservation(
    id: string,
    userId: string,
): Promise<ReservationRow | null> {
    const { withTransaction } = await import('../../db');

    return withTransaction(async (client) => {
        const { rows } = await client.query<ReservationRow>(
            `UPDATE reservations
             SET status = 'CANCELLED', cancelled_at = now(), expires_at = NULL
             WHERE id = $1
               AND user_id = $2
               AND status IN ('PENDING', 'CONFIRMED')
               -- Depois que a sessão começa não há o que cancelar.
               AND (SELECT starts_at FROM showtimes WHERE id = showtime_id) > now()
             RETURNING *`,
            [id, userId],
        );

        const reservation = rows[0];
        if (!reservation) return null;

        await client.query(
            'UPDATE reservation_seats SET released = true WHERE reservation_id = $1 AND NOT released',
            [id],
        );

        return reservation;
    });
}

/**
 * Varre as reservas pendentes vencidas.
 *
 * Uma CTE faz as duas atualizações em uma transação implícita: marca as
 * reservas como EXPIRED e libera os assentos. Se fossem dois comandos
 * separados, uma falha entre eles deixaria assentos presos para sempre em
 * reservas que ninguém mais vai confirmar.
 */
export async function expirePendingReservations(): Promise<number> {
    const rows = await query<{ id: string }>(
        `WITH vencidas AS (
             UPDATE reservations
             SET status = 'EXPIRED', expires_at = NULL
             WHERE status = 'PENDING' AND expires_at <= now()
             RETURNING id
         ), liberadas AS (
             UPDATE reservation_seats
             SET released = true
             WHERE reservation_id IN (SELECT id FROM vencidas) AND NOT released
             RETURNING reservation_id
         )
         SELECT id FROM vencidas`,
    );

    return rows.length;
}
