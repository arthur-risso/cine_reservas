import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { query, queryOne } from '../src/db';
import {
    app,
    closeDatabase,
    createFixture,
    createUser,
    request,
    resetDatabase,
    type Fixture,
    type TestUser,
} from './helpers';

describe('Reservas', () => {
    let client: TestUser;
    let other: TestUser;
    let fixture: Fixture;

    beforeAll(resetDatabase);
    afterAll(closeDatabase);

    beforeEach(async () => {
        await resetDatabase();
        client = await createUser('cliente@teste.dev');
        other = await createUser('outro@teste.dev');
        fixture = await createFixture();
    });

    const reserve = (token: string, seatIds: string[], ticketKind = 'FULL') =>
        request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${token}`)
            .send({
                showtimeId: fixture.showtimeId,
                seats: seatIds.map((seatId) => ({ seatId, ticketKind })),
            });

    it('cria a reserva com preço calculado pelo tipo de poltrona', async () => {
        // A1 é NORMAL (x1.0) e C1 é VIP (x1.9). Base 30 => 30 + 57 = 87.
        const response = await reserve(client.token, [fixture.seatIds[0]!, fixture.seatIds[8]!]);

        expect(response.status).toBe(201);
        expect(response.body.data.status).toBe('PENDING');
        expect(Number(response.body.data.totalAmount)).toBe(87);
        expect(response.body.data.code).toMatch(/^CINE-[A-Z2-9]{6}$/);
        expect(response.body.data.secondsToExpire).toBeGreaterThan(0);
    });

    it('cobra metade do valor na meia-entrada', async () => {
        const response = await reserve(client.token, [fixture.seatIds[0]!], 'HALF');

        expect(response.status).toBe(201);
        expect(Number(response.body.data.totalAmount)).toBe(15);
    });

    it('ignora o preço enviado pelo cliente e usa o do banco', async () => {
        // Tentativa de adulteração: mandar um preço junto no corpo.
        const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${client.token}`)
            .send({
                showtimeId: fixture.showtimeId,
                seats: [{ seatId: fixture.seatIds[8], ticketKind: 'FULL', unitPrice: 1 }],
            });

        expect(response.status).toBe(201);
        // VIP continua custando 30 * 1.9, não 1.
        expect(Number(response.body.data.totalAmount)).toBe(57);
    });

    it('recusa a segunda reserva da mesma poltrona', async () => {
        const first = await reserve(client.token, [fixture.seatIds[0]!]);
        expect(first.status).toBe(201);

        const second = await reserve(other.token, [fixture.seatIds[0]!]);
        expect(second.status).toBe(409);
        expect(second.body.code).toBe('SEAT_TAKEN');
    });

    /**
     * O teste mais importante do projeto.
     *
     * Sequencialmente qualquer implementação passa. O que separa código
     * correto de código com bug é o que acontece quando as duas requisições
     * entram ao mesmo tempo — exatamente o que Promise.all força aqui.
     */
    it('sob concorrência, apenas uma reserva vence a mesma poltrona', async () => {
        const attempts = 10;

        const responses = await Promise.all(
            Array.from({ length: attempts }, () => reserve(client.token, [fixture.seatIds[5]!])),
        );

        const created = responses.filter((response) => response.status === 201);
        const conflicts = responses.filter((response) => response.status === 409);

        expect(created).toHaveLength(1);
        expect(conflicts).toHaveLength(attempts - 1);

        // E o banco confirma: uma única linha ativa para aquele assento.
        const active = await queryOne<{ total: string }>(
            'SELECT count(*)::text AS total FROM reservation_seats WHERE seat_id = $1 AND NOT released',
            [fixture.seatIds[5]],
        );
        expect(Number(active!.total)).toBe(1);
    });

    it('rejeita poltrona de outra sala', async () => {
        const otherRoom = await queryOne<{ id: string }>(
            `INSERT INTO rooms (name, technology, rows_count, seats_per_row)
             VALUES ('Outra Sala', 'Padrão', 1, 1) RETURNING id`,
        );
        const foreignSeat = await queryOne<{ id: string }>(
            `INSERT INTO seats (room_id, row_label, seat_number, tier)
             VALUES ($1, 'A', 1, 'NORMAL') RETURNING id`,
            [otherRoom!.id],
        );

        const response = await reserve(client.token, [foreignSeat!.id]);

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('INVALID_SEATS');

        // A transação inteira reverteu: nenhuma reserva órfã ficou no banco.
        const reservations = await query('SELECT id FROM reservations');
        expect(reservations).toHaveLength(0);
    });

    it('rejeita poltronas repetidas na mesma requisição', async () => {
        const response = await reserve(client.token, [fixture.seatIds[0]!, fixture.seatIds[0]!]);

        expect(response.status).toBe(422);
        expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('respeita o limite de poltronas por reserva', async () => {
        const response = await reserve(client.token, fixture.seatIds.slice(0, 8));

        expect(response.status).toBe(422);
        expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('libera as poltronas ao cancelar', async () => {
        const created = await reserve(client.token, [fixture.seatIds[1]!]);
        const reservationId = created.body.data.id;

        const cancelled = await request(app)
            .post(`/api/reservations/${reservationId}/cancel`)
            .set('Authorization', `Bearer ${client.token}`);

        expect(cancelled.status).toBe(200);
        expect(cancelled.body.data.status).toBe('CANCELLED');

        // A mesma poltrona pode ser reservada de novo por outra pessoa.
        const retry = await reserve(other.token, [fixture.seatIds[1]!]);
        expect(retry.status).toBe(201);
    });

    it('não permite confirmar reserva expirada', async () => {
        const created = await reserve(client.token, [fixture.seatIds[2]!]);
        const reservationId = created.body.data.id;

        // Empurra a expiração para o passado, simulando os 10 minutos.
        await query('UPDATE reservations SET expires_at = now() - interval \'1 minute\' WHERE id = $1', [
            reservationId,
        ]);

        const response = await request(app)
            .post(`/api/reservations/${reservationId}/confirm`)
            .set('Authorization', `Bearer ${client.token}`);

        expect(response.status).toBe(409);
        expect(response.body.code).toBe('RESERVATION_EXPIRED');
    });

    it('ignora reserva pendente vencida no mapa de poltronas', async () => {
        const created = await reserve(client.token, [fixture.seatIds[3]!]);

        await query('UPDATE reservations SET expires_at = now() - interval \'1 minute\' WHERE id = $1', [
            created.body.data.id,
        ]);

        // Sem depender do job de expiração ter rodado: a leitura já compara
        // com o relógio.
        const seatMap = await request(app).get(`/api/showtimes/${fixture.showtimeId}/seats`);
        const seat = seatMap.body.data.rows
            .flatMap((row: { seats: Array<{ id: string; status: string }> }) => row.seats)
            .find((item: { id: string }) => item.id === fixture.seatIds[3]);

        expect(seat.status).toBe('AVAILABLE');
    });

    it('impede que um usuário veja a reserva de outro', async () => {
        const created = await reserve(client.token, [fixture.seatIds[4]!]);

        const response = await request(app)
            .get(`/api/reservations/${created.body.data.id}`)
            .set('Authorization', `Bearer ${other.token}`);

        expect(response.status).toBe(403);
        expect(response.body.code).toBe('FORBIDDEN');
    });

    it('exige autenticação para reservar', async () => {
        const response = await request(app)
            .post('/api/reservations')
            .send({
                showtimeId: fixture.showtimeId,
                seats: [{ seatId: fixture.seatIds[0], ticketKind: 'FULL' }],
            });

        expect(response.status).toBe(401);
    });
});
