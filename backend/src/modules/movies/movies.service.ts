import { conflict, notFound } from '../../utils/AppError';
import { paginated, type Paginated } from '../../utils/pagination';
import * as repo from './movies.repository';
import type { CalendarQuery, CreateMovieInput, ListMoviesQuery, UpdateMovieInput } from './movies.schema';

export interface MovieDTO {
    id: string;
    title: string;
    originalTitle: string | null;
    synopsis: string;
    durationMin: number;
    genres: string[];
    ageRating: string;
    director: string | null;
    cast: string[];
    posterUrl: string | null;
    backdropUrl: string | null;
    trailerUrl: string | null;
    releaseDate: string | null;
    isActive: boolean;
    nextShowtime?: string | null;
}

/**
 * Converte a linha do banco (snake_case) no contrato da API (camelCase).
 *
 * Essa tradução isola o front do schema: renomear uma coluna não quebra o
 * cliente, e colunas internas simplesmente não aparecem na resposta.
 */
export function toMovieDTO(row: repo.MovieRow & { next_showtime?: Date | null }): MovieDTO {
    return {
        id: row.id,
        title: row.title,
        originalTitle: row.original_title,
        synopsis: row.synopsis,
        durationMin: row.duration_min,
        genres: row.genres,
        ageRating: row.age_rating,
        director: row.director,
        cast: row.cast_names,
        posterUrl: row.poster_url,
        backdropUrl: row.backdrop_url,
        trailerUrl: row.trailer_url,
        releaseDate: row.release_date,
        isActive: row.is_active,
        ...(row.next_showtime !== undefined
            ? { nextShowtime: row.next_showtime ? row.next_showtime.toISOString() : null }
            : {}),
    };
}

export async function listMovies(filters: ListMoviesQuery): Promise<Paginated<MovieDTO>> {
    const { movies, total } = await repo.findMovies(filters);
    return paginated(movies.map(toMovieDTO), total, filters.page, filters.limit);
}

export async function getMovie(id: string, includeInactive = false): Promise<MovieDTO> {
    const movie = await repo.findMovieById(id, includeInactive);

    if (!movie) {
        throw notFound('Filme não encontrado.', 'MOVIE_NOT_FOUND');
    }

    return toMovieDTO(movie);
}

export async function listGenres(): Promise<Array<{ genre: string; total: number }>> {
    const rows = await repo.findGenres();
    return rows.map((row) => ({ genre: row.genre, total: Number(row.total) }));
}

export interface CalendarDayDTO {
    day: string;
    showtimeCount: number;
    firstStart: string;
    formats: string[];
}

export async function getMovieCalendar(
    movieId: string,
    params: CalendarQuery,
): Promise<CalendarDayDTO[]> {
    // Garante 404 coerente: calendário de filme inexistente não é lista vazia.
    await getMovie(movieId);

    const rows = await repo.findMovieCalendar(movieId, params);

    return rows.map((row) => ({
        day: row.day,
        showtimeCount: Number(row.showtime_count),
        firstStart: row.first_start.toISOString(),
        formats: row.formats,
    }));
}

export async function createMovie(input: CreateMovieInput): Promise<MovieDTO> {
    const movie = await repo.insertMovie(input);
    return toMovieDTO(movie);
}

export async function updateMovie(id: string, input: UpdateMovieInput): Promise<MovieDTO> {
    const movie = await repo.updateMovie(id, input);

    if (!movie) {
        throw notFound('Filme não encontrado.', 'MOVIE_NOT_FOUND');
    }

    return toMovieDTO(movie);
}

export async function deactivateMovie(id: string): Promise<void> {
    const movie = await repo.findMovieById(id, true);

    if (!movie) {
        throw notFound('Filme não encontrado.', 'MOVIE_NOT_FOUND');
    }

    /**
     * Regra de negócio: não se tira de cartaz um filme com sessão futura.
     *
     * Sem essa checagem, o filme sumiria da vitrine enquanto clientes já
     * têm ingresso comprado para amanhã — a sessão continuaria existindo,
     * mas o filme ficaria invisível no app.
     */
    const futureShowtimes = await repo.countFutureShowtimes(id);

    if (futureShowtimes > 0) {
        throw conflict(
            `Este filme tem ${futureShowtimes} sessão(ões) futura(s). Cancele as sessões antes de tirá-lo de cartaz.`,
            'MOVIE_HAS_SHOWTIMES',
            { futureShowtimes },
        );
    }

    await repo.deactivateMovie(id);
}
