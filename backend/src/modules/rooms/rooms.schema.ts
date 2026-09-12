import { z } from 'zod';

export const createRoomSchema = z.object({
    name: z.string().trim().min(1, 'Informe o nome da sala.').max(60),
    technology: z.string().trim().min(1).max(40).default('Padrão'),
    rowsCount: z.coerce.number().int().min(1).max(26),
    seatsPerRow: z.coerce.number().int().min(1).max(40),
    /** Proporção de fileiras Normal / Semi-VIP (o resto vira VIP). */
    normalRatio: z.coerce.number().min(0).max(1).default(0.45),
    semiVipRatio: z.coerce.number().min(0).max(1).default(0.35),
    accessibleSeats: z.coerce.number().int().min(0).max(6).default(2),
    isActive: z.boolean().default(true),
}).refine(
    (data) => data.normalRatio + data.semiVipRatio <= 1,
    { message: 'A soma das proporções Normal + Semi-VIP não pode passar de 1.', path: ['semiVipRatio'] },
);

/**
 * Dimensões ficam de fora do update.
 *
 * Mudar linhas/colunas de uma sala significa regerar as poltronas — e
 * poltronas já vendidas apontam para IDs que deixariam de existir. Para
 * remodelar uma sala, o caminho correto é criar outra e desativar a antiga.
 */
export const updateRoomSchema = z
    .object({
        name: z.string().trim().min(1).max(60).optional(),
        technology: z.string().trim().min(1).max(40).optional(),
        isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, 'Envie ao menos um campo para atualizar.');

export const listRoomsQuerySchema = z.object({
    includeInactive: z
        .enum(['true', 'false'])
        .optional()
        .transform((value) => value === 'true'),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type ListRoomsQuery = z.infer<typeof listRoomsQuerySchema>;
