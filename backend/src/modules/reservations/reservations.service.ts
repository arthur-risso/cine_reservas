import { env } from '../../config/env';
import { withTransaction } from '../../db';
import { badRequest, conflict, forbidden, notFound } from '../../utils/AppError';
import { paginated, type Paginated } from '../../utils/pagination';
import { generateReservationCode } from '../../utils/tokens';
import type { SeatTier } from '../rooms/seatLayout';
import * as repo from './reservations.repository';
import type { CreateReservationInput, ListReservationsQuery } from './reservations.schema';

export interface ReservationDTO {
    id: string;
    code: string;
    status: string;
    totalAmount: number;
    expiresAt: string | null;
    createdAt: string;
    /** Segundos restantes para confirmar — o front usa direto no cronômetro. */
    secondsToExpire: number | null;
    showtime: {
        id: string;
        startsAt: string;
        endsAt: string;
        format: string;
        language: string;
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
        ticketKind: 'FULL' | 'HALF';
        unitPrice: number;
    }>;
}

function toReservationDTO(row: repo.ReservationDetailRow): ReservationDTO {
    const secondsToExpire =
        row.status === 'PENDING' && row.expires_at
            ? Math.max(0, Math.floor((row.expires_at.getTime() - Date.now()) / 1000))
            : null;

    return {
        id: row.id,
        code: row.code,
        // Uma pendente vencida que o job ainda não varreu já é mostrada como
        // expirada: a verdade para o usuário é o relógio, não o job.
        status: secondsToExpire === 0 ? 'EXPIRED' : row.status,
        totalAmount: Number(row.total_amount),
        expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
        createdAt: row.created_at.toISOString(),
        secondsToExpire,
        showtime: {
            id: row.showtime_id,
            startsAt: row.starts_at.toISOString(),
            endsAt: row.ends_at.toISOString(),
            format: row.format,
            language: row.language,
            movieTitle: row.movie_title,
            moviePosterUrl: row.movie_poster,
            movieDurationMin: row.movie_duration,
            roomName: row.room_name,
            roomTechnology: row.room_technology,
        },
        seats: row.seats.map((seat) => ({
            id: seat.id,
            label: seat.label,
            tier: seat.tier,
            ticketKind: seat.ticket_kind,
            unitPrice: Number(seat.unit_price),
        })),
    };
}

/**
 * Cria a reserva segurando as poltronas.
 *
 * Toda a operação roda em UMA transação. O que garante que a mesma poltrona
 * não seja vendida duas vezes não é a checagem daqui — é o índice único
 * parcial `reservation_seats_assento_ocupado_idx`. A checagem existe apenas
 * para dar uma mensagem boa no caso comum; sob concorrência real, quem
 * arbitra é o banco, e o 23505 resultante vira 409 SEAT_TAKEN no
 * errorHandler.
 *
 * Essa distinção é o ponto central: validação em JavaScript é conveniência,
 * constraint no banco é garantia.
 */
export async function createReservation(
    userId: string,
    input: CreateReservationInput,
): Promise<ReservationDTO> {
    const reservationId = await withTransaction(async (client) => {
        const showtime = await repo.findShowtimeForReservation(input.showtimeId, client);

        if (!showtime || !showtime.is_active) {
            throw notFound('Sessão não encontrada.', 'SHOWTIME_NOT_FOUND');
        }

        if (showtime.starts_at.getTime() <= Date.now()) {
            throw conflict('Esta sessão já começou.', 'SHOWTIME_ALREADY_STARTED');
        }

        const expiresAt = new Date(Date.now() + env.RESERVATION_HOLD_MINUTES * 60_000);

        const reservation = await repo.insertReservation(client, {
            code: generateReservationCode(),
            userId,
            showtimeId: showtime.id,
            expiresAt,
        });

        const inserted = await repo.insertReservationSeats(client, {
            reservationId: reservation.id,
            showtimeId: showtime.id,
            roomId: showtime.room_id,
            basePrice: Number(showtime.base_price),
            seatIds: input.seats.map((seat) => seat.seatId),
            ticketKinds: input.seats.map((seat) => seat.ticketKind),
        });

        // Menos linhas inseridas do que pedidas = alguma poltrona não existe
        // ou é de outra sala. O ROLLBACK desfaz a reserva inteira.
        if (inserted.length !== input.seats.length) {
            throw badRequest(
                'Uma ou mais poltronas não pertencem a esta sessão.',
                'INVALID_SEATS',
                { requested: input.seats.length, valid: inserted.length },
            );
        }

        await repo.updateReservationTotal(client, reservation.id);

        return reservation.id;
    });

    const detail = await repo.findReservationById(reservationId);
    return toReservationDTO(detail!);
}

async function getOwnedReservation(
    reservationId: string,
    userId: string,
    isAdmin: boolean,
): Promise<repo.ReservationDetailRow> {
    const reservation = await repo.findReservationById(reservationId);

    if (!reservation) {
        throw notFound('Reserva não encontrada.', 'RESERVATION_NOT_FOUND');
    }

    /**
     * Checagem de propriedade — a falha mais comum em APIs REST.
     *
     * Sem ela, trocar o UUID na URL mostra (ou cancela) a reserva de outra
     * pessoa. Estar autenticado responde "quem é você", não "isto é seu".
     */
    if (reservation.user_id !== userId && !isAdmin) {
        throw forbidden('Esta reserva não é sua.');
    }

    return reservation;
}

export async function getReservation(
    reservationId: string,
    userId: string,
    isAdmin = false,
): Promise<ReservationDTO> {
    return toReservationDTO(await getOwnedReservation(reservationId, userId, isAdmin));
}

export async function listMyReservations(
    userId: string,
    filters: ListReservationsQuery,
): Promise<Paginated<ReservationDTO>> {
    const { reservations, total } = await repo.findUserReservations(userId, filters);
    return paginated(reservations.map(toReservationDTO), total, filters.page, filters.limit);
}

export async function confirmReservation(
    reservationId: string,
    userId: string,
): Promise<ReservationDTO> {
    const updated = await repo.confirmReservation(reservationId, userId);

    if (!updated) {
        // O UPDATE não achou linha na condição esperada. Descobrimos o porquê
        // para dar a mensagem certa em vez de um 404 genérico.
        const current = await getOwnedReservation(reservationId, userId, false);

        if (current.status === 'CONFIRMED') {
            throw conflict('Esta reserva já foi confirmada.', 'ALREADY_CONFIRMED');
        }
        if (current.status === 'CANCELLED') {
            throw conflict('Esta reserva foi cancelada.', 'RESERVATION_CANCELLED');
        }

        throw conflict(
            'O tempo para confirmar esta reserva acabou e as poltronas foram liberadas.',
            'RESERVATION_EXPIRED',
        );
    }

    const detail = await repo.findReservationById(reservationId);
    return toReservationDTO(detail!);
}

export async function cancelReservation(
    reservationId: string,
    userId: string,
): Promise<ReservationDTO> {
    const cancelled = await repo.cancelReservation(reservationId, userId);

    if (!cancelled) {
        const current = await getOwnedReservation(reservationId, userId, false);

        if (current.status === 'CANCELLED') {
            throw conflict('Esta reserva já foi cancelada.', 'ALREADY_CANCELLED');
        }
        if (current.status === 'EXPIRED') {
            throw conflict('Esta reserva já havia expirado.', 'RESERVATION_EXPIRED');
        }

        throw conflict(
            'Não é possível cancelar: a sessão já começou.',
            'SHOWTIME_ALREADY_STARTED',
        );
    }

    const detail = await repo.findReservationById(reservationId);
    return toReservationDTO(detail!);
}
