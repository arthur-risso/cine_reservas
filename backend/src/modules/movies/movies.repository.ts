import { query, queryOne } from '../../db';
import type { CalendarQuery, CreateMovieInput, ListMoviesQuery, UpdateMovieInput } from './movies.schema';

export interface MovieRow {
    id: string;
    title: string;
    original_title: string | null;
    synopsis: string;
    duration_min: number;
    genres: string[];
    age_rating: string;
    director: string | null;
    cast_names: string[];
    poster_url: string | null;
    backdrop_url: string | null;
    trailer_url: string | null;
    release_date: string | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

interface MovieListRow extends MovieRow {
    total_count: string;
    next_showtime: Date | null;
}

const MOVIE_COLUMNS = `
    m.id, m.title, m.original_title, m.synopsis, m.duration_min, m.genres,
    m.age_rating, m.director, m.cast_names, m.poster_url, m.backdrop_url,
    m.trailer_url, m.release_date, m.is_active, m.created_at, m.updated_at
`;

/**
 * Listagem com busca e filtros combináveis.
 *
 * Duas decisões que explicam o formato do SQL:
 *
 * 1. Filtro opcional vira `($n::tipo IS NULL OR condição)`. Assim existe UMA
 *    query só, com plano de execução reaproveitado pelo Postgres, em vez de
 *    concatenar pedaços de string (que abriria espaço para SQL injection e
 *    geraria um plano novo a cada combinação de filtros).
 *
 * 2. `count(*) OVER()` traz o total da paginação na mesma ida ao banco.
 *    A alternativa clássica — um SELECT count(*) separado — dobra o custo
 *    justamente na query mais pesada da aplicação.
 */
export async function findMovies(
    filters: ListMoviesQuery,
): Promise<{ movies: Array<MovieRow & { next_showtime: Date | null }>; total: number }> {
    const offset = (filters.page - 1) * filters.limit;

    const rows = await query<MovieListRow>(
        `
        WITH filtrados AS (
            SELECT ${MOVIE_COLUMNS},
                   -- Relevância só faz sentido quando há termo de busca.
                   CASE WHEN $1::text IS NULL THEN 0
                        ELSE ts_rank(m.search_vector, plainto_tsquery('public.portuguese_unaccent'::regconfig, $1))
                   END AS rank,
                   (
                       SELECT min(s.starts_at)
                       FROM showtimes s
                       WHERE s.movie_id = m.id AND s.is_active AND s.starts_at > now()
                   ) AS next_showtime
            FROM movies m
            WHERE m.is_active
              AND ($1::text IS NULL OR m.search_vector @@ plainto_tsquery('public.portuguese_unaccent'::regconfig, $1))
              AND ($2::text[] IS NULL OR m.genres && $2::text[])
              AND ($3::text[] IS NULL OR m.age_rating = ANY($3::text[]))
              AND (
                  -- Filtros que dependem de sessão: um único EXISTS resolve
                  -- data, formato e sala sem multiplicar linhas com JOIN.
                  ($4::boolean IS NOT TRUE
                   AND $5::date IS NULL AND $6::text[] IS NULL AND $7::uuid IS NULL)
                  OR EXISTS (
                      SELECT 1
                      FROM showtimes s
                      WHERE s.movie_id = m.id
                        AND s.is_active
                        AND s.starts_at > now()
                        AND ($5::date IS NULL OR s.starts_at::date = $5::date)
                        AND ($6::text[] IS NULL OR s.format::text = ANY($6::text[]))
                        AND ($7::uuid IS NULL OR s.room_id = $7::uuid)
                  )
              )
        )
        SELECT *, count(*) OVER() AS total_count
        FROM filtrados
        ORDER BY
            CASE WHEN $8 = 'relevance' THEN rank END DESC NULLS LAST,
            CASE WHEN $8 = 'soonest' THEN next_showtime END ASC NULLS LAST,
            CASE WHEN $8 = 'release' THEN release_date END DESC NULLS LAST,
            title ASC
        LIMIT $9 OFFSET $10
        `,
        [
            filters.q ?? null,
            filters.genre ?? null,
            filters.ageRating ?? null,
            filters.onlyShowing,
            filters.date ?? null,
            filters.format ?? null,
            filters.roomId ?? null,
            filters.sort,
            filters.limit,
            offset,
        ],
    );

    return {
        movies: rows,
        total: rows.length > 0 ? Number(rows[0]!.total_count) : 0,
    };
}

export function findMovieById(id: string, includeInactive = false): Promise<MovieRow | null> {
    return queryOne<MovieRow>(
        `SELECT ${MOVIE_COLUMNS} FROM movies m WHERE m.id = $1 AND ($2 OR m.is_active)`,
        [id, includeInactive],
    );
}

/** Gêneros realmente em uso — alimenta o filtro do front sem lista fixa. */
export function findGenres(): Promise<Array<{ genre: string; total: string }>> {
    return query<{ genre: string; total: string }>(
        `SELECT unnest(genres) AS genre, count(*)::text AS total
         FROM movies
         WHERE is_active
         GROUP BY genre
         ORDER BY genre`,
    );
}

export interface CalendarDayRow {
    day: string;
    showtime_count: string;
    first_start: Date;
    formats: string[];
}

/**
 * Dias com sessão de um filme, para o calendário de disponibilidade.
 *
 * Agrupa no banco em vez de trazer todas as sessões e agrupar em JS: são
 * ~14 linhas trafegadas em vez de centenas, e o índice (movie_id, starts_at)
 * atende a consulta inteira.
 */
export function findMovieCalendar(movieId: string, params: CalendarQuery): Promise<CalendarDayRow[]> {
    return query<CalendarDayRow>(
        `SELECT to_char(s.starts_at, 'YYYY-MM-DD') AS day,
                count(*)::text AS showtime_count,
                min(s.starts_at) AS first_start,
                array_agg(DISTINCT s.format::text ORDER BY s.format::text) AS formats
         FROM showtimes s
         WHERE s.movie_id = $1
           AND s.is_active
           AND s.starts_at > now()
           AND s.starts_at::date >= coalesce($2::date, current_date)
           AND s.starts_at::date < coalesce($2::date, current_date) + $3::int
         GROUP BY day
         ORDER BY day`,
        [movieId, params.from ?? null, params.days],
    );
}

export async function insertMovie(input: CreateMovieInput): Promise<MovieRow> {
    const rows = await query<MovieRow>(
        `INSERT INTO movies
            (title, original_title, synopsis, duration_min, genres, age_rating,
             director, cast_names, poster_url, backdrop_url, trailer_url, release_date, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING ${MOVIE_COLUMNS.replace(/m\./g, '')}`,
        [
            input.title,
            input.originalTitle ?? null,
            input.synopsis,
            input.durationMin,
            input.genres,
            input.ageRating,
            input.director ?? null,
            input.cast,
            input.posterUrl ?? null,
            input.backdropUrl ?? null,
            input.trailerUrl ?? null,
            input.releaseDate ?? null,
            input.isActive,
        ],
    );

    return rows[0]!;
}

/** Mapa campo da API -> coluna do banco. Só o que está aqui pode ser gravado. */
const UPDATABLE_COLUMNS: Record<keyof UpdateMovieInput, string> = {
    title: 'title',
    originalTitle: 'original_title',
    synopsis: 'synopsis',
    durationMin: 'duration_min',
    genres: 'genres',
    ageRating: 'age_rating',
    director: 'director',
    cast: 'cast_names',
    posterUrl: 'poster_url',
    backdropUrl: 'backdrop_url',
    trailerUrl: 'trailer_url',
    releaseDate: 'release_date',
    isActive: 'is_active',
};

/**
 * UPDATE parcial montado dinamicamente.
 *
 * Os nomes de coluna vêm do mapa acima (valores fixos escritos por nós),
 * nunca das chaves recebidas na requisição; os VALORES continuam indo como
 * parâmetros. É isso que torna a montagem dinâmica segura.
 */
export async function updateMovie(id: string, input: UpdateMovieInput): Promise<MovieRow | null> {
    const assignments: string[] = [];
    const values: unknown[] = [];

    for (const [field, column] of Object.entries(UPDATABLE_COLUMNS)) {
        const value = input[field as keyof UpdateMovieInput];
        if (value === undefined) continue;

        values.push(value);
        assignments.push(`${column} = $${values.length}`);
    }

    if (assignments.length === 0) {
        return findMovieById(id, true);
    }

    values.push(id);

    return queryOne<MovieRow>(
        `UPDATE movies SET ${assignments.join(', ')}
         WHERE id = $${values.length}
         RETURNING ${MOVIE_COLUMNS.replace(/m\./g, '')}`,
        values,
    );
}

/**
 * Remoção lógica.
 *
 * Apagar de verdade quebraria o histórico de quem já assistiu — e a FK
 * `showtimes.movie_id` com ON DELETE RESTRICT impediria de qualquer forma.
 * Desativar tira o filme da vitrine preservando as reservas passadas.
 */
export async function deactivateMovie(id: string): Promise<boolean> {
    const rows = await query<{ id: string }>(
        'UPDATE movies SET is_active = false WHERE id = $1 AND is_active RETURNING id',
        [id],
    );
    return rows.length > 0;
}

/** Sessões futuras impedem a desativação: há gente com ingresso. */
export async function countFutureShowtimes(movieId: string): Promise<number> {
    const row = await queryOne<{ total: string }>(
        `SELECT count(*)::text AS total FROM showtimes
         WHERE movie_id = $1 AND is_active AND starts_at > now()`,
        [movieId],
    );
    return Number(row?.total ?? 0);
}
