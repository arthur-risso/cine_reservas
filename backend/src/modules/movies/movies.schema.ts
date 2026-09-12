import { z } from 'zod';

export const AGE_RATINGS = ['L', '10', '12', '14', '16', '18'] as const;
export const SESSION_FORMATS = ['2D', '3D', 'IMAX', '4DX'] as const;
export const SESSION_LANGUAGES = ['DUBBED', 'SUBTITLED', 'ORIGINAL'] as const;

export const uuidParamSchema = z.object({
    id: z.string().uuid('Identificador inválido.'),
});

/**
 * Aceita tanto `?genre=Drama&genre=Ação` quanto `?genre=Drama,Ação`.
 *
 * O front monta a URL do jeito que for mais conveniente para o estado dos
 * filtros, e a API entende os dois — sem cada tela inventar um formato.
 */
const csvArray = z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
        if (value === undefined) return undefined;
        const list = Array.isArray(value) ? value : value.split(',');
        const cleaned = list.map((item) => item.trim()).filter(Boolean);
        return cleaned.length > 0 ? cleaned : undefined;
    });

const dateString = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Data inválida.');

export const listMoviesQuerySchema = z.object({
    /** Busca textual no título, título original, diretor e sinopse. */
    q: z.string().trim().min(1).max(100).optional(),
    genre: csvArray,
    ageRating: csvArray.refine(
        (list) => !list || list.every((item) => AGE_RATINGS.includes(item as never)),
        'Classificação indicativa inválida.',
    ),
    format: csvArray.refine(
        (list) => !list || list.every((item) => SESSION_FORMATS.includes(item as never)),
        'Formato de sessão inválido.',
    ),
    /** Só filmes com sessão neste dia. */
    date: dateString.optional(),
    roomId: z.string().uuid().optional(),
    /** Por padrão mostra só o que está em cartaz (tem sessão futura). */
    onlyShowing: z
        .enum(['true', 'false'])
        .optional()
        .transform((value) => value !== 'false'),
    sort: z.enum(['relevance', 'title', 'release', 'soonest']).default('relevance'),
    // Teto de 50 por página: sem limite, `?limit=100000` derruba o servidor
    // de graça — é negação de serviço grátis para quem descobrir a rota.
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
});

const urlOrPath = z
    .string()
    .trim()
    .max(500)
    .refine(
        (value) => value.startsWith('/') || /^https?:\/\//.test(value),
        'Informe uma URL http(s) ou um caminho começando com /.',
    );

export const createMovieSchema = z.object({
    title: z.string().trim().min(1, 'Informe o título.').max(200),
    originalTitle: z.string().trim().max(200).optional().nullable(),
    synopsis: z.string().trim().min(20, 'A sinopse precisa ter ao menos 20 caracteres.').max(4000),
    durationMin: z.coerce.number().int().min(1).max(599),
    genres: z.array(z.string().trim().min(1).max(40)).min(1, 'Informe ao menos um gênero.').max(8),
    ageRating: z.enum(AGE_RATINGS),
    director: z.string().trim().max(160).optional().nullable(),
    cast: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
    posterUrl: urlOrPath.optional().nullable(),
    backdropUrl: urlOrPath.optional().nullable(),
    trailerUrl: urlOrPath.optional().nullable(),
    releaseDate: dateString.optional().nullable(),
    isActive: z.boolean().default(true),
});

// PATCH: todos os campos opcionais, mas pelo menos um precisa vir — senão
// é uma escrita que não escreve nada e devolve 200 enganando o cliente.
export const updateMovieSchema = createMovieSchema
    .partial()
    .refine((data) => Object.keys(data).length > 0, 'Envie ao menos um campo para atualizar.');

export const calendarQuerySchema = z.object({
    from: dateString.optional(),
    days: z.coerce.number().int().min(1).max(60).default(14),
});

export type ListMoviesQuery = z.infer<typeof listMoviesQuerySchema>;
export type CreateMovieInput = z.infer<typeof createMovieSchema>;
export type UpdateMovieInput = z.infer<typeof updateMovieSchema>;
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;
