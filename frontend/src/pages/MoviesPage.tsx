import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { moviesApi, roomsApi } from '../api/endpoints';
import { AGE_RATINGS, SESSION_FORMATS } from '../api/types';
import { MovieCard, MovieCardSkeleton } from '../features/movies/MovieCard';
import { Badge, Button, EmptyState, ErrorState, Input, Select } from '../components/ui';
import { useDebounce } from '../hooks/useDebounce';
import { cn } from '../lib/cn';

/**
 * Catálogo com busca e filtros.
 *
 * O estado dos filtros mora na URL, não em useState.
 *
 * Isso resolve de uma vez: o usuário pode compartilhar o link de
 * "/filmes?genre=Drama&format=IMAX", o botão voltar do navegador desfaz um
 * filtro por vez, e um F5 não perde a seleção. Guardar em estado local
 * quebraria as três coisas.
 */
export default function MoviesPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '');
    const debouncedSearch = useDebounce(searchInput, 300);

    const genres = searchParams.getAll('genre');
    const ageRatings = searchParams.getAll('ageRating');
    const formats = searchParams.getAll('format');
    const roomId = searchParams.get('roomId') ?? '';
    const sort = (searchParams.get('sort') ?? 'soonest') as 'relevance' | 'title' | 'release' | 'soonest';
    const page = Number(searchParams.get('page') ?? 1);

    // Sincroniza o campo de busca (já com debounce) de volta para a URL.
    useEffect(() => {
        setSearchParams(
            (params) => {
                const current = params.get('q') ?? '';
                if (current === debouncedSearch) return params;

                if (debouncedSearch) {
                    params.set('q', debouncedSearch);
                } else {
                    params.delete('q');
                }
                // Termo novo reinicia a paginação: continuar na página 3 de
                // outra busca mostraria "nenhum resultado" sem motivo.
                params.delete('page');
                return params;
            },
            { replace: true },
        );
    }, [debouncedSearch, setSearchParams]);

    const toggleParam = (key: string, value: string) => {
        setSearchParams((params) => {
            const current = params.getAll(key);
            params.delete(key);

            const next = current.includes(value)
                ? current.filter((item) => item !== value)
                : [...current, value];

            for (const item of next) params.append(key, item);
            params.delete('page');
            return params;
        });
    };

    const setParam = (key: string, value: string) => {
        setSearchParams((params) => {
            if (value) {
                params.set(key, value);
            } else {
                params.delete(key);
            }
            params.delete('page');
            return params;
        });
    };

    const clearFilters = () => {
        setSearchInput('');
        setSearchParams({}, { replace: true });
    };

    const activeFilterCount =
        genres.length + ageRatings.length + formats.length + (roomId ? 1 : 0);

    const filters = {
        q: debouncedSearch || undefined,
        genre: genres.length > 0 ? genres : undefined,
        ageRating: ageRatings.length > 0 ? ageRatings : undefined,
        format: formats.length > 0 ? formats : undefined,
        roomId: roomId || undefined,
        sort: debouncedSearch ? ('relevance' as const) : sort,
        page,
        limit: 15,
    };

    const moviesQuery = useQuery({
        queryKey: ['movies', filters],
        queryFn: () => moviesApi.list(filters),
        // Mantém a lista anterior visível durante a troca de página/filtro,
        // em vez de piscar um esqueleto a cada tecla.
        placeholderData: keepPreviousData,
    });

    const genresQuery = useQuery({
        queryKey: ['genres'],
        queryFn: moviesApi.genres,
        staleTime: 10 * 60_000,
    });

    const roomsQuery = useQuery({
        queryKey: ['rooms'],
        queryFn: () => roomsApi.list(),
        staleTime: 10 * 60_000,
    });

    const movies = moviesQuery.data?.data ?? [];
    const meta = moviesQuery.data?.meta;

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
            <header className="mb-7">
                <h1 className="text-3xl font-bold">Filmes em cartaz</h1>
                <p className="mt-1.5 text-sm text-cream-faint">
                    Busque por título, diretor, gênero ou trecho da sinopse.
                </p>
            </header>

            <div className="grid gap-7 lg:grid-cols-[16rem_1fr]">
                {/* Filtros */}
                <aside className="space-y-6 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:self-start">
                    <Input
                        type="search"
                        label="Buscar"
                        placeholder="Ex.: Duna, Nolan, suspense…"
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                    />

                    <fieldset>
                        <legend className="mb-2 text-sm font-medium text-cream-dim">Gênero</legend>
                        <div className="flex flex-wrap gap-1.5">
                            {(genresQuery.data ?? []).map((item) => {
                                const active = genres.includes(item.genre);
                                return (
                                    <button
                                        key={item.genre}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => toggleParam('genre', item.genre)}
                                        className={cn(
                                            'rounded-lg border px-2.5 py-1 text-xs transition-colors',
                                            active
                                                ? 'border-accent bg-accent/15 text-accent'
                                                : 'border-ink-600 text-cream-dim hover:border-ink-500 hover:text-cream',
                                        )}
                                    >
                                        {item.genre}
                                    </button>
                                );
                            })}
                        </div>
                    </fieldset>

                    <fieldset>
                        <legend className="mb-2 text-sm font-medium text-cream-dim">
                            Classificação
                        </legend>
                        <div className="flex flex-wrap gap-1.5">
                            {AGE_RATINGS.map((rating) => {
                                const active = ageRatings.includes(rating);
                                return (
                                    <button
                                        key={rating}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => toggleParam('ageRating', rating)}
                                        className={cn(
                                            'min-w-9 rounded-lg border px-2 py-1 text-xs font-semibold transition-colors',
                                            active
                                                ? 'border-accent bg-accent/15 text-accent'
                                                : 'border-ink-600 text-cream-dim hover:border-ink-500 hover:text-cream',
                                        )}
                                    >
                                        {rating}
                                    </button>
                                );
                            })}
                        </div>
                    </fieldset>

                    <fieldset>
                        <legend className="mb-2 text-sm font-medium text-cream-dim">Formato</legend>
                        <div className="flex flex-wrap gap-1.5">
                            {SESSION_FORMATS.map((format) => {
                                const active = formats.includes(format);
                                return (
                                    <button
                                        key={format}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => toggleParam('format', format)}
                                        className={cn(
                                            'rounded-lg border px-2.5 py-1 text-xs transition-colors',
                                            active
                                                ? 'border-accent bg-accent/15 text-accent'
                                                : 'border-ink-600 text-cream-dim hover:border-ink-500 hover:text-cream',
                                        )}
                                    >
                                        {format}
                                    </button>
                                );
                            })}
                        </div>
                    </fieldset>

                    <Select
                        label="Sala"
                        value={roomId}
                        onChange={(event) => setParam('roomId', event.target.value)}
                    >
                        <option value="">Todas as salas</option>
                        {(roomsQuery.data ?? []).map((room) => (
                            <option key={room.id} value={room.id}>
                                {room.name} — {room.technology}
                            </option>
                        ))}
                    </Select>

                    <Select
                        label="Ordenar por"
                        value={sort}
                        onChange={(event) => setParam('sort', event.target.value)}
                        disabled={Boolean(debouncedSearch)}
                        // Com busca ativa, a ordem por relevância é a única
                        // que faz sentido — por isso o campo fica travado.
                    >
                        <option value="soonest">Próxima sessão</option>
                        <option value="title">Título (A–Z)</option>
                        <option value="release">Lançamento</option>
                    </Select>

                    {activeFilterCount > 0 && (
                        <Button variant="ghost" size="sm" fullWidth onClick={clearFilters}>
                            Limpar {activeFilterCount} filtro{activeFilterCount > 1 ? 's' : ''}
                        </Button>
                    )}
                </aside>

                {/* Resultados */}
                <section>
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <p
                            className="text-sm text-cream-faint"
                            // aria-live: quem usa leitor de tela ouve o novo
                            // número de resultados ao mudar um filtro.
                            aria-live="polite"
                        >
                            {moviesQuery.isPending
                                ? 'Buscando…'
                                : `${meta?.total ?? 0} filme${meta?.total === 1 ? '' : 's'} encontrado${meta?.total === 1 ? '' : 's'}`}
                        </p>

                        {moviesQuery.isFetching && !moviesQuery.isPending && (
                            <Badge tone="neutral">atualizando…</Badge>
                        )}
                    </div>

                    {moviesQuery.isError ? (
                        <ErrorState
                            message="Não foi possível carregar os filmes."
                            onRetry={() => void moviesQuery.refetch()}
                        />
                    ) : moviesQuery.isPending ? (
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
                            {Array.from({ length: 10 }, (_, index) => (
                                <MovieCardSkeleton key={index} />
                            ))}
                        </div>
                    ) : movies.length === 0 ? (
                        <EmptyState
                            title="Nenhum filme com esses filtros"
                            description="Tente remover algum filtro ou buscar por outro termo."
                            action={
                                <Button variant="secondary" size="sm" onClick={clearFilters}>
                                    Limpar filtros
                                </Button>
                            }
                        />
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
                                {movies.map((movie, index) => (
                                    <MovieCard key={movie.id} movie={movie} priority={index < 5} />
                                ))}
                            </div>

                            {meta && meta.totalPages > 1 && (
                                <nav
                                    aria-label="Paginação"
                                    className="mt-8 flex items-center justify-center gap-3"
                                >
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        disabled={!meta.hasPrevious}
                                        onClick={() => setParam('page', String(page - 1))}
                                    >
                                        Anterior
                                    </Button>
                                    <span className="text-sm text-cream-faint">
                                        Página {meta.page} de {meta.totalPages}
                                    </span>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        disabled={!meta.hasNext}
                                        onClick={() => setParam('page', String(page + 1))}
                                    >
                                        Próxima
                                    </Button>
                                </nav>
                            )}
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
