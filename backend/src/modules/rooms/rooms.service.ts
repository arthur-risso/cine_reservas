import { conflict, notFound } from '../../utils/AppError';
import * as repo from './rooms.repository';
import type { CreateRoomInput, UpdateRoomInput } from './rooms.schema';
import type { SeatTier } from './seatLayout';

export interface RoomDTO {
    id: string;
    name: string;
    technology: string;
    rowsCount: number;
    seatsPerRow: number;
    isActive: boolean;
    seatSummary: {
        total: number;
        normal: number;
        semiVip: number;
        vip: number;
    };
}

export interface SeatDTO {
    id: string;
    rowLabel: string;
    seatNumber: number;
    tier: SeatTier;
    isAccessible: boolean;
    label: string;
}

function toRoomDTO(row: repo.RoomWithStatsRow): RoomDTO {
    return {
        id: row.id,
        name: row.name,
        technology: row.technology,
        rowsCount: row.rows_count,
        seatsPerRow: row.seats_per_row,
        isActive: row.is_active,
        seatSummary: {
            total: Number(row.total_seats ?? 0),
            normal: Number(row.normal_seats ?? 0),
            semiVip: Number(row.semi_vip_seats ?? 0),
            vip: Number(row.vip_seats ?? 0),
        },
    };
}

export function toSeatDTO(row: repo.SeatRow): SeatDTO {
    return {
        id: row.id,
        rowLabel: row.row_label,
        seatNumber: row.seat_number,
        tier: row.tier,
        isAccessible: row.is_accessible,
        // Rótulo pronto ("F7"): calculado uma vez aqui em vez de repetido
        // em cada componente do front.
        label: `${row.row_label}${row.seat_number}`,
    };
}

export async function listRooms(includeInactive: boolean): Promise<RoomDTO[]> {
    const rows = await repo.findRooms(includeInactive);
    return rows.map(toRoomDTO);
}

export async function getRoom(
    id: string,
    includeInactive = false,
): Promise<RoomDTO & { seats: SeatDTO[] }> {
    const room = await repo.findRoomById(id, includeInactive);

    if (!room) {
        throw notFound('Sala não encontrada.', 'ROOM_NOT_FOUND');
    }

    const seats = await repo.findSeatsByRoom(id);

    return { ...toRoomDTO(room), seats: seats.map(toSeatDTO) };
}

export async function createRoom(input: CreateRoomInput): Promise<RoomDTO> {
    const room = await repo.insertRoomWithSeats(input);
    // Relê para trazer as estatísticas já calculadas pelo banco.
    return getRoomSummary(room.id);
}

async function getRoomSummary(id: string): Promise<RoomDTO> {
    const room = await repo.findRoomById(id, true);

    if (!room) {
        throw notFound('Sala não encontrada.', 'ROOM_NOT_FOUND');
    }

    return toRoomDTO(room);
}

export async function updateRoom(id: string, input: UpdateRoomInput): Promise<RoomDTO> {
    // Desativar sala com sessão futura deixaria clientes com ingresso para
    // um lugar que o sistema considera fechado.
    if (input.isActive === false) {
        const futureShowtimes = await repo.countFutureShowtimes(id);

        if (futureShowtimes > 0) {
            throw conflict(
                `Esta sala tem ${futureShowtimes} sessão(ões) futura(s). Cancele as sessões antes de desativá-la.`,
                'ROOM_HAS_SHOWTIMES',
                { futureShowtimes },
            );
        }
    }

    const room = await repo.updateRoom(id, input);

    if (!room) {
        throw notFound('Sala não encontrada.', 'ROOM_NOT_FOUND');
    }

    return getRoomSummary(room.id);
}

export async function deactivateRoom(id: string): Promise<void> {
    await updateRoom(id, { isActive: false });
}
