import { badRequest, conflict, notFound } from '../../utils/AppError';
import { paginated, type Paginated } from '../../utils/pagination';
import type { SeatTier } from '../rooms/seatLayout';
import * as repo from './showtimes.repository';
import type { CreateShowtimeInput, ListShowtimesQuery, UpdateShowtimeInput } from './showtimes.schema';

export interface ShowtimeDTO {
    id: string;
    startsAt: string;
    endsAt: string;
    format: string;
    language: string;
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

function toShowtimeDTO(row: repo.ShowtimeRow): ShowtimeDTO {
    const total = Number(row.seats_total);
    const taken = Number(row.seats_taken);

    return {
        id: row.id,
        startsAt: row.starts_at.toISOString(),
        endsAt: row.ends_at.toISOString(),
        format: row.format,
        language: row.language,
        basePrice: Number(row.base_price),
        isActive: row.is_active,
        movie: {
            id: row.movie_id,
            title: row.movie_title,
            durationMin: row.movie_duration,
            posterUrl: row.movie_poster,
            ageRating: row.movie_age_rating,
        },
        room: { id: row.room_id, name: row.room_name, technology: row.room_technology },
        occupancy: {
            total,
            taken,
            available: total - taken,
            percentage: total > 0 ? Math.round((taken / total) * 100) : 0,
        },
    };
}

export async function listShowtimes(filters: ListShowtimesQuery): Promise<Paginated<ShowtimeDTO>> {
    const { showtimes, total } = await repo.findShowtimes(filters);
    return paginated(showtimes.map(toShowtimeDTO), total, filters.page, filters.limit);
}

export async function getShowtime(id: string): Promise<ShowtimeDTO> {
    const showtime = await repo.findShowtimeById(id);

    if (!showtime) {
        throw notFound('Sessão não encontrada.', 'SHOWTIME_NOT_FOUND');
    }

    return toShowtimeDTO(showtime);
}

export type SeatStatus = 'AVAILABLE' | 'HELD' | 'SOLD' | 'MINE';

export interface SeatMapSeatDTO {
    id: string;
    label: string;
    rowLabel: string;
    seatNumber: number;
    tier: SeatTier;
    isAccessible: boolean;
    status: SeatStatus;
    price: number;
}

export interface SeatMapDTO {
    showtime: ShowtimeDTO;
    rows: Array<{ label: string; seats: SeatMapSeatDTO[] }>;
    tiers: Array<{ tier: SeatTier; price: number }>;
    summary: { total: number; available: number };
}

/** Arredonda para centavos — evita 41.279999999999995 no JSON. */
function toCents(value: number): number {
    return Math.round(value * 100) / 100;
}

/**
 * Monta o mapa que o front desenha.
 *
 * O agrupamento por fileira acontece aqui, não no React: o componente
 * recebe a estrutura pronta e só renderiza. Isso mantém a regra de preço
 * e de status em um lugar só — o servidor — em vez de duplicada no cliente,
 * onde poderia ser adulterada.
 */
export async function getSeatMap(showtimeId: string, currentUserId?: string): Promise<SeatMapDTO> {
    const showtime = await repo.findShowtimeById(showtimeId);

    if (!showtime) {
        throw notFound('Sessão não encontrada.', 'SHOWTIME_NOT_FOUND');
    }

    const seats = await repo.findSeatMap(showtimeId);
    const basePrice = Number(showtime.base_price);

    const rowMap = new Map<string, SeatMapSeatDTO[]>();
    const tierPrices = new Map<SeatTier, number>();
    let available = 0;

    for (const seat of seats) {
        const price = toCents(basePrice * Number(seat.multiplier));
        tierPrices.set(seat.tier, price);

        let status: SeatStatus = 'AVAILABLE';
        if (seat.occupied_status === 'CONFIRMED') {
            status = 'SOLD';
        } else if (seat.occupied_status === 'PENDING') {
            status = 'HELD';
        }

        // Destaca as poltronas da reserva em andamento do próprio usuário,
        // para ele não achar que perdeu os lugares ao recarregar a página.
        if (status !== 'AVAILABLE' && currentUserId && seat.occupied_by === currentUserId) {
            status = 'MINE';
        }

        if (status === 'AVAILABLE') available += 1;

        const list = rowMap.get(seat.row_label) ?? [];
        list.push({
            id: seat.id,
            label: `${seat.row_label}${seat.seat_number}`,
            rowLabel: seat.row_label,
            seatNumber: seat.seat_number,
            tier: seat.tier,
            isAccessible: seat.is_accessible,
            status,
            price,
        });
        rowMap.set(seat.row_label, list);
    }

    return {
        showtime: toShowtimeDTO(showtime),
        rows: [...rowMap.entries()].map(([label, rowSeats]) => ({ label, seats: rowSeats })),
        tiers: [...tierPrices.entries()]
            .map(([tier, price]) => ({ tier, price }))
            .sort((a, b) => a.price - b.price),
        summary: { total: seats.length, available },
    };
}

/**
 * `ends_at` é derivado, nunca informado pelo admin.
 *
 * Se o usuário pudesse digitar o fim, ele erraria (ou mentiria) e a
 * constraint de sobreposição passaria a proteger um intervalo que não
 * corresponde à realidade da sala.
 */
function computeEndsAt(startsAt: Date, durationMin: number, turnoverMinutes: number): Date {
    return new Date(startsAt.getTime() + (durationMin + turnoverMinutes) * 60_000);
}

export async function createShowtime(input: CreateShowtimeInput): Promise<ShowtimeDTO> {
    const startsAt = new Date(input.startsAt);

    if (startsAt.getTime() < Date.now()) {
        throw badRequest('Não é possível criar uma sessão no passado.', 'SHOWTIME_IN_PAST');
    }

    const duration = await repo.findMovieDuration(input.movieId);
    if (duration === null) {
        throw notFound('Filme não encontrado ou inativo.', 'MOVIE_NOT_FOUND');
    }

    if (!(await repo.roomExists(input.roomId))) {
        throw notFound('Sala não encontrada ou inativa.', 'ROOM_NOT_FOUND');
    }

    const created = await repo.insertShowtime({
        movieId: input.movieId,
        roomId: input.roomId,
        startsAt,
        endsAt: computeEndsAt(startsAt, duration, input.turnoverMinutes),
        format: input.format,
        language: input.language,
        basePrice: input.basePrice,
        isActive: input.isActive,
    });

    // Se houver choque de horário, o INSERT acima já falhou com 23P01 e o
    // errorHandler devolveu 409 SHOWTIME_OVERLAP — sem checagem manual.
    return getShowtime(created.id);
}

export async function updateShowtime(id: string, input: UpdateShowtimeInput): Promise<ShowtimeDTO> {
    const showtime = await repo.findShowtimeById(id);

    if (!showtime) {
        throw notFound('Sessão não encontrada.', 'SHOWTIME_NOT_FOUND');
    }

    const changesSchedule = input.startsAt !== undefined || input.turnoverMinutes !== undefined;
    const isCancelling = input.isActive === false;

    if (changesSchedule || isCancelling) {
        const activeReservations = await repo.countActiveReservations(id);

        if (activeReservations > 0) {
            throw conflict(
                `Esta sessão já tem ${activeReservations} reserva(s) ativa(s) e não pode ser ${
                    isCancelling ? 'cancelada' : 'remarcada'
                }.`,
                'SHOWTIME_HAS_RESERVATIONS',
                { activeReservations },
            );
        }
    }

    let startsAt: Date | undefined;
    let endsAt: Date | undefined;

    if (changesSchedule) {
        startsAt = input.startsAt ? new Date(input.startsAt) : showtime.starts_at;

        if (startsAt.getTime() < Date.now()) {
            throw badRequest('Não é possível mover a sessão para o passado.', 'SHOWTIME_IN_PAST');
        }

        // Recalcula o fim a partir da duração real do filme.
        const currentTurnover =
            (showtime.ends_at.getTime() - showtime.starts_at.getTime()) / 60_000 -
            showtime.movie_duration;

        endsAt = computeEndsAt(
            startsAt,
            showtime.movie_duration,
            input.turnoverMinutes ?? Math.max(0, Math.round(currentTurnover)),
        );
    }

    await repo.updateShowtime(id, {
        ...(startsAt ? { startsAt } : {}),
        ...(endsAt ? { endsAt } : {}),
        ...(input.format ? { format: input.format } : {}),
        ...(input.language ? { language: input.language } : {}),
        ...(input.basePrice !== undefined ? { basePrice: input.basePrice } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    });

    return getShowtime(id);
}

export async function cancelShowtime(id: string): Promise<void> {
    await updateShowtime(id, { isActive: false });
}
