import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../src/app';
import { pool, query, queryOne } from '../src/db';
import { hashPassword } from '../src/utils/password';

export const app: Application = createApp();

/**
 * Cada arquivo de teste começa de um estado conhecido.
 *
 * Testes que dependem do que o teste anterior deixou no banco passam
 * isolados e falham em conjunto — e o pior: falham de forma diferente a
 * cada execução. O TRUNCATE torna a ordem irrelevante.
 */
export async function resetDatabase(): Promise<void> {
    await query(
        'TRUNCATE reservation_seats, reservations, showtimes, seats, rooms, movies, refresh_tokens, users RESTART IDENTITY CASCADE',
    );
}

export async function closeDatabase(): Promise<void> {
    await pool.end();
}

export interface TestUser {
    id: string;
    email: string;
    token: string;
}

export async function createUser(
    email: string,
    role: 'CLIENT' | 'ADMIN' = 'CLIENT',
): Promise<TestUser> {
    const passwordHash = await hashPassword('Senha@12345');

    const user = await queryOne<{ id: string }>(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, $4::user_role)
         RETURNING id`,
        [`Teste ${role}`, email, passwordHash, role],
    );

    // Faz login de verdade em vez de assinar o token à mão: assim o teste
    // também exercita a rota de login e o formato real do payload.
    const response = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'Senha@12345' });

    return { id: user!.id, email, token: response.body.accessToken };
}

export interface Fixture {
    movieId: string;
    roomId: string;
    showtimeId: string;
    seatIds: string[];
}

/** Um filme, uma sala 3x4 e uma sessão daqui a 2 horas. */
export async function createFixture(): Promise<Fixture> {
    const movie = await queryOne<{ id: string }>(
        `INSERT INTO movies (title, synopsis, duration_min, genres, age_rating)
         VALUES ('Filme de Teste', 'Uma sinopse suficientemente longa para o schema.', 100,
                 ARRAY['Drama'], '12')
         RETURNING id`,
    );

    const room = await queryOne<{ id: string }>(
        `INSERT INTO rooms (name, technology, rows_count, seats_per_row)
         VALUES ('Sala Teste', 'Padrão', 3, 4)
         RETURNING id`,
    );

    await query(
        `INSERT INTO seats (room_id, row_label, seat_number, tier)
         SELECT $1, row_label, seat_number, tier::seat_tier
         FROM UNNEST(
             ARRAY['A','A','A','A','B','B','B','B','C','C','C','C'],
             ARRAY[1,2,3,4,1,2,3,4,1,2,3,4],
             ARRAY['NORMAL','NORMAL','NORMAL','NORMAL',
                   'SEMI_VIP','SEMI_VIP','SEMI_VIP','SEMI_VIP',
                   'VIP','VIP','VIP','VIP']
         ) AS t(row_label, seat_number, tier)`,
        [room!.id],
    );

    const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 125 * 60 * 1000);

    const showtime = await queryOne<{ id: string }>(
        `INSERT INTO showtimes (movie_id, room_id, starts_at, ends_at, base_price)
         VALUES ($1, $2, $3, $4, 30.00)
         RETURNING id`,
        [movie!.id, room!.id, startsAt, endsAt],
    );

    const seats = await query<{ id: string }>(
        'SELECT id FROM seats WHERE room_id = $1 ORDER BY row_label, seat_number',
        [room!.id],
    );

    return {
        movieId: movie!.id,
        roomId: room!.id,
        showtimeId: showtime!.id,
        seatIds: seats.map((seat) => seat.id),
    };
}

export { request };
