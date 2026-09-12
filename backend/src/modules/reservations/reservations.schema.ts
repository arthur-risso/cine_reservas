import { z } from 'zod';
import { env } from '../../config/env';

export const createReservationSchema = z.object({
    showtimeId: z.string().uuid('Sessão inválida.'),
    seats: z
        .array(
            z.object({
                seatId: z.string().uuid('Poltrona inválida.'),
                // Meia-entrada: estudante, idoso, etc. Em um sistema real
                // exigiria comprovação; aqui é só o tipo de ingresso.
                ticketKind: z.enum(['FULL', 'HALF']).default('FULL'),
            }),
        )
        .min(1, 'Selecione ao menos uma poltrona.')
        .max(
            env.MAX_SEATS_PER_RESERVATION,
            `Máximo de ${env.MAX_SEATS_PER_RESERVATION} poltronas por reserva.`,
        )
        // Poltrona repetida no mesmo pedido travaria no índice único contra
        // a própria reserva — melhor recusar antes, com mensagem clara.
        .refine(
            (seats) => new Set(seats.map((seat) => seat.seatId)).size === seats.length,
            'Há poltronas repetidas na seleção.',
        ),
});

export const listReservationsQuerySchema = z.object({
    status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type ListReservationsQuery = z.infer<typeof listReservationsQuerySchema>;
