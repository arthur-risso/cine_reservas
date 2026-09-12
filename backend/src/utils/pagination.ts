export interface PageMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
}

/**
 * Envelope padrão de listagem: `{ data, meta }`.
 *
 * Usar o mesmo formato em todos os endpoints significa que o front escreve
 * UM componente de paginação e ele serve para filmes, sessões e reservas.
 */
export function buildPageMeta(total: number, page: number, limit: number): PageMeta {
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
    };
}

export interface Paginated<T> {
    data: T[];
    meta: PageMeta;
}

export function paginated<T>(data: T[], total: number, page: number, limit: number): Paginated<T> {
    return { data, meta: buildPageMeta(total, page, limit) };
}
