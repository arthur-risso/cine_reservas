import { z } from 'zod';
import { SESSION_FORMATS, SESSION_LANGUAGES } from '../movies/movies.schema';

const dateString = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Data inválida.');

const csvArray = z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
        if (value === undefined) return undefined;
        const list = Array.isArray(value) ? value : value.split(',');
        const cleaned = list.map((item) => item.trim()).filter(Boolean);
        return cleaned.length > 0 ? cleaned : undefined;
    });

export const listShowtimesQuerySchema = z.object({
    movieId: z.string().uuid().optional(),
    roomId: z.string().uuid().optional(),
    date: dateString.optional(),
    format: csvArray.refine(
        (list) => !list || list.every((item) => SESSION_FORMATS.includes(item as never)),
        'Formato inválido.',
    ),
    language: csvArray.refine(
        (list) => !list || list.every((item) => SESSION_LANGUAGES.includes(item as never)),
        'Idioma inválido.',
    ),
    /** `false` inclui sessões já começadas — usado no painel admin. */
    upcomingOnly: z
        .enum(['true', 'false'])
        .optional()
        .transform((value) => value !== 'false'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const createShowtimeSchema = z.object({
    movieId: z.string().uuid('Selecione um filme.'),
    roomId: z.string().uuid('Selecione uma sala.'),
    // ISO 8601 completo, com fuso — evita ambiguidade de horário de verão.
    startsAt: z.string().datetime({ offset: true, message: 'Data/hora inválida.' }),
    format: z.enum(SESSION_FORMATS).default('2D'),
    language: z.enum(SESSION_LANGUAGES).default('SUBTITLED'),
    basePrice: z.coerce.number().positive('O preço precisa ser maior que zero.').max(1000),
    /** Minutos de intervalo após o filme (trailers, limpeza, saída do público). */
    turnoverMinutes: z.coerce.number().int().min(0).max(120).default(25),
    isActive: z.boolean().default(true),
});

export const updateShowtimeSchema = z
    .object({
        startsAt: z.string().datetime({ offset: true }).optional(),
        format: z.enum(SESSION_FORMATS).optional(),
        language: z.enum(SESSION_LANGUAGES).optional(),
        basePrice: z.coerce.number().positive().max(1000).optional(),
        turnoverMinutes: z.coerce.number().int().min(0).max(120).optional(),
        isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, 'Envie ao menos um campo para atualizar.');

export type ListShowtimesQuery = z.infer<typeof listShowtimesQuerySchema>;
export type CreateShowtimeInput = z.infer<typeof createShowtimeSchema>;
export type UpdateShowtimeInput = z.infer<typeof updateShowtimeSchema>;
