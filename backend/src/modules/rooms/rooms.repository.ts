import { query, queryOne, withTransaction } from '../../db';
import { generateSeatLayout, type SeatTier } from './seatLayout';
import type { CreateRoomInput, UpdateRoomInput } from './rooms.schema';

export interface RoomRow {
    id: string;
    name: string;
    technology: string;
    rows_count: number;
    seats_per_row: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface RoomWithStatsRow extends RoomRow {
    total_seats: string;
    normal_seats: string;
    semi_vip_seats: string;
    vip_seats: string;
}

export interface SeatRow {
    id: string;
    room_id: string;
    row_label: string;
    seat_number: number;
    tier: SeatTier;
    is_accessible: boolean;
    is_active: boolean;
}

/**
 * Salas com a contagem de poltronas por tipo.
 *
 * A contagem sai de um LATERAL agregando `seats` uma única vez por sala —
 * o padrão ingênuo (listar salas, depois um SELECT de poltronas por sala)
 * é o clássico N+1: 1 + N idas ao banco em vez de 1.
 */
export function findRooms(includeInactive: boolean): Promise<RoomWithStatsRow[]> {
    return query<RoomWithStatsRow>(
        `SELECT r.*, stats.total_seats, stats.normal_seats, stats.semi_vip_seats, stats.vip_seats
         FROM rooms r
         LEFT JOIN LATERAL (
             SELECT count(*)::text AS total_seats,
                    count(*) FILTER (WHERE tier = 'NORMAL')::text AS normal_seats,
                    count(*) FILTER (WHERE tier = 'SEMI_VIP')::text AS semi_vip_seats,
                    count(*) FILTER (WHERE tier = 'VIP')::text AS vip_seats
             FROM seats s
             WHERE s.room_id = r.id AND s.is_active
         ) stats ON true
         WHERE ($1 OR r.is_active)
         ORDER BY r.name`,
        [includeInactive],
    );
}

export function findRoomById(id: string, includeInactive = false): Promise<RoomWithStatsRow | null> {
    return queryOne<RoomWithStatsRow>(
        `SELECT r.*, stats.total_seats, stats.normal_seats, stats.semi_vip_seats, stats.vip_seats
         FROM rooms r
         LEFT JOIN LATERAL (
             SELECT count(*)::text AS total_seats,
                    count(*) FILTER (WHERE tier = 'NORMAL')::text AS normal_seats,
                    count(*) FILTER (WHERE tier = 'SEMI_VIP')::text AS semi_vip_seats,
                    count(*) FILTER (WHERE tier = 'VIP')::text AS vip_seats
             FROM seats s
             WHERE s.room_id = r.id AND s.is_active
         ) stats ON true
         WHERE r.id = $1 AND ($2 OR r.is_active)`,
        [id, includeInactive],
    );
}

export function findSeatsByRoom(roomId: string): Promise<SeatRow[]> {
    return query<SeatRow>(
        `SELECT id, room_id, row_label, seat_number, tier, is_accessible, is_active
         FROM seats
         WHERE room_id = $1
         ORDER BY row_label, seat_number`,
        [roomId],
    );
}

/**
 * Cria a sala e todas as suas poltronas atomicamente.
 *
 * Sem transação, uma falha no meio deixaria uma sala cadastrada com metade
 * das poltronas — e o admin teria uma sala quebrada que nem dá para apagar.
 */
export function insertRoomWithSeats(input: CreateRoomInput): Promise<RoomRow> {
    return withTransaction(async (client) => {
        const { rows } = await client.query<RoomRow>(
            `INSERT INTO rooms (name, technology, rows_count, seats_per_row, is_active)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [input.name, input.technology, input.rowsCount, input.seatsPerRow, input.isActive],
        );

        const room = rows[0]!;

        const seats = generateSeatLayout({
            rowsCount: input.rowsCount,
            seatsPerRow: input.seatsPerRow,
            normalRatio: input.normalRatio,
            semiVipRatio: input.semiVipRatio,
            accessibleSeats: input.accessibleSeats,
        });

        // Um INSERT só, com arrays desmontados pelo UNNEST.
        await client.query(
            `INSERT INTO seats (room_id, row_label, seat_number, tier, is_accessible)
             SELECT $1, row_label, seat_number, tier::seat_tier, is_accessible
             FROM UNNEST($2::text[], $3::int[], $4::text[], $5::boolean[])
                  AS t(row_label, seat_number, tier, is_accessible)`,
            [
                room.id,
                seats.map((seat) => seat.rowLabel),
                seats.map((seat) => seat.seatNumber),
                seats.map((seat) => seat.tier),
                seats.map((seat) => seat.isAccessible),
            ],
        );

        return room;
    });
}

const UPDATABLE_COLUMNS: Record<keyof UpdateRoomInput, string> = {
    name: 'name',
    technology: 'technology',
    isActive: 'is_active',
};

export async function updateRoom(id: string, input: UpdateRoomInput): Promise<RoomRow | null> {
    const assignments: string[] = [];
    const values: unknown[] = [];

    for (const [field, column] of Object.entries(UPDATABLE_COLUMNS)) {
        const value = input[field as keyof UpdateRoomInput];
        if (value === undefined) continue;

        values.push(value);
        assignments.push(`${column} = $${values.length}`);
    }

    if (assignments.length === 0) {
        return queryOne<RoomRow>('SELECT * FROM rooms WHERE id = $1', [id]);
    }

    values.push(id);

    return queryOne<RoomRow>(
        `UPDATE rooms SET ${assignments.join(', ')} WHERE id = $${values.length} RETURNING *`,
        values,
    );
}

export async function countFutureShowtimes(roomId: string): Promise<number> {
    const row = await queryOne<{ total: string }>(
        `SELECT count(*)::text AS total FROM showtimes
         WHERE room_id = $1 AND is_active AND starts_at > now()`,
        [roomId],
    );
    return Number(row?.total ?? 0);
}
