import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { moviesApi } from '../../api/endpoints';
import { AGE_RATINGS, type Movie } from '../../api/types';
import { AgeRating, Badge, Button, Card, ErrorState, Input, Select, Skeleton } from '../../components/ui';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../stores/toastStore';
import { toApiError } from '../../api/client';
import { formatDuration } from '../../lib/format';

interface FormState {
    title: string;
    originalTitle: string;
    synopsis: string;
    durationMin: string;
    genres: string;
    ageRating: string;
    director: string;
    cast: string;
    posterUrl: string;
    backdropUrl: string;
    releaseDate: string;
}

const EMPTY_FORM: FormState = {
    title: '',
    originalTitle: '',
    synopsis: '',
    durationMin: '120',
    genres: '',
    ageRating: '12',
    director: '',
    cast: '',
    posterUrl: '',
    backdropUrl: '',
    releaseDate: '',
};

function movieToForm(movie: Movie): FormState {
    return {
        title: movie.title,
        originalTitle: movie.originalTitle ?? '',
        synopsis: movie.synopsis,
        durationMin: String(movie.durationMin),
        genres: movie.genres.join(', '),
        ageRating: movie.ageRating,
        director: movie.director ?? '',
        cast: movie.cast.join(', '),
        posterUrl: movie.posterUrl ?? '',
        backdropUrl: movie.backdropUrl ?? '',
        releaseDate: movie.releaseDate ?? '',
    };
}

/** Campos vazios viram `undefined` para não gravar string vazia no banco. */
function formToPayload(form: FormState): Record<string, unknown> {
    const optional = (value: string) => (value.trim() ? value.trim() : undefined);

    return {
        title: form.title.trim(),
        originalTitle: optional(form.originalTitle),
        synopsis: form.synopsis.trim(),
        durationMin: Number(form.durationMin),
        genres: form.genres
            .split(',')
            .map((genre) => genre.trim())
            .filter(Boolean),
        ageRating: form.ageRating,
        director: optional(form.director),
        cast: form.cast
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean),
        posterUrl: optional(form.posterUrl),
        backdropUrl: optional(form.backdropUrl),
        releaseDate: optional(form.releaseDate),
    };
}

export default function AdminMovies() {
    const queryClient = useQueryClient();
    const [editing, setEditing] = useState<Movie | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const moviesQuery = useQuery({
        queryKey: ['movies', { admin: true }],
        queryFn: () => moviesApi.list({ limit: 50, sort: 'title' }),
    });

    const closeModal = () => {
        setEditing(null);
        setIsCreating(false);
        setFieldErrors({});
    };

    const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: ['movies'] });
        void queryClient.invalidateQueries({ queryKey: ['genres'] });
    };

    const save = useMutation({
        mutationFn: (payload: Record<string, unknown>) =>
            editing ? moviesApi.update(editing.id, payload) : moviesApi.create(payload),
        onSuccess: () => {
            toast.success(editing ? 'Filme atualizado.' : 'Filme cadastrado.');
            invalidate();
            closeModal();
        },
        onError: (error) => {
            const apiError = toApiError(error);
            // O backend devolve `details` com o erro de cada campo — usar isso
            // marca o campo certo no formulário em vez de um aviso genérico.
            if (apiError.details) setFieldErrors(apiError.details);
            toast.error('Não foi possível salvar', apiError.message);
        },
    });

    const remove = useMutation({
        mutationFn: (id: string) => moviesApi.remove(id),
        onSuccess: () => {
            toast.success('Filme retirado de cartaz.');
            invalidate();
        },
        onError: (error) => toast.error('Não foi possível remover', toApiError(error).message),
    });

    const openCreate = () => {
        setForm(EMPTY_FORM);
        setEditing(null);
        setIsCreating(true);
        setFieldErrors({});
    };

    const openEdit = (movie: Movie) => {
        setForm(movieToForm(movie));
        setEditing(movie);
        setIsCreating(false);
        setFieldErrors({});
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        setFieldErrors({});
        save.mutate(formToPayload(form));
    };

    const field = (key: keyof FormState) => ({
        value: form[key],
        onChange: (event: { target: { value: string } }) =>
            setForm((current) => ({ ...current, [key]: event.target.value })),
    });

    const movies = moviesQuery.data?.data ?? [];

    return (
        <div>
            <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold">Filmes</h2>
                    <p className="text-sm text-cream-faint">
                        {movies.length} filme{movies.length === 1 ? '' : 's'} em cartaz
                    </p>
                </div>
                <Button onClick={openCreate}>Novo filme</Button>
            </div>

            {moviesQuery.isPending ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }, (_, index) => (
                        <Skeleton key={index} className="h-20" />
                    ))}
                </div>
            ) : moviesQuery.isError ? (
                <ErrorState
                    message="Não foi possível carregar os filmes."
                    onRetry={() => void moviesQuery.refetch()}
                />
            ) : (
                <Card className="overflow-hidden">
                    <ul className="divide-y divide-ink-700">
                        {movies.map((movie) => (
                            <li key={movie.id} className="flex items-center gap-4 p-4">
                                {movie.posterUrl && (
                                    <img
                                        src={movie.posterUrl}
                                        alt=""
                                        width={500}
                                        height={750}
                                        loading="lazy"
                                        className="h-16 w-11 shrink-0 rounded-md border border-ink-700 object-cover"
                                    />
                                )}

                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-medium">{movie.title}</p>
                                        <AgeRating rating={movie.ageRating} />
                                    </div>
                                    <p className="mt-0.5 text-xs text-cream-faint">
                                        {formatDuration(movie.durationMin)}
                                        {movie.director && ` · ${movie.director}`}
                                    </p>
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                        {movie.genres.slice(0, 3).map((genre) => (
                                            <Badge key={genre}>{genre}</Badge>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex shrink-0 gap-2">
                                    <Button variant="secondary" size="sm" onClick={() => openEdit(movie)}>
                                        Editar
                                    </Button>
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        isLoading={remove.isPending && remove.variables === movie.id}
                                        onClick={() => remove.mutate(movie.id)}
                                    >
                                        Retirar
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}

            <Modal
                open={isCreating || editing !== null}
                onClose={closeModal}
                title={editing ? 'Editar filme' : 'Novo filme'}
                description="Campos marcados com * são obrigatórios."
                footer={
                    <>
                        <Button variant="ghost" onClick={closeModal}>
                            Cancelar
                        </Button>
                        <Button type="submit" form="movie-form" isLoading={save.isPending}>
                            {editing ? 'Salvar alterações' : 'Cadastrar filme'}
                        </Button>
                    </>
                }
            >
                <form id="movie-form" onSubmit={handleSubmit} className="space-y-4">
                    <Input label="Título *" required {...field('title')} error={fieldErrors.title} />
                    <Input label="Título original" {...field('originalTitle')} />

                    <div>
                        <label
                            htmlFor="synopsis"
                            className="mb-1.5 block text-sm font-medium text-cream-dim"
                        >
                            Sinopse *
                        </label>
                        <textarea
                            id="synopsis"
                            required
                            rows={4}
                            {...field('synopsis')}
                            className="w-full rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 text-sm text-cream outline-none transition-colors focus:border-accent"
                        />
                        {fieldErrors.synopsis && (
                            <p role="alert" className="mt-1 text-xs text-danger">
                                {fieldErrors.synopsis}
                            </p>
                        )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                        <Input
                            type="number"
                            label="Duração (min) *"
                            min={1}
                            max={599}
                            required
                            {...field('durationMin')}
                            error={fieldErrors.durationMin}
                        />
                        <Select label="Classificação *" {...field('ageRating')}>
                            {AGE_RATINGS.map((rating) => (
                                <option key={rating} value={rating}>
                                    {rating === 'L' ? 'Livre' : `${rating} anos`}
                                </option>
                            ))}
                        </Select>
                        <Input type="date" label="Estreia" {...field('releaseDate')} />
                    </div>

                    <Input
                        label="Gêneros *"
                        hint="Separados por vírgula: Drama, Suspense"
                        required
                        {...field('genres')}
                        error={fieldErrors.genres}
                    />
                    <Input label="Direção" {...field('director')} />
                    <Input
                        label="Elenco"
                        hint="Separado por vírgula"
                        {...field('cast')}
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                            label="Pôster (URL)"
                            hint="/posters/arquivo.svg ou https://…"
                            {...field('posterUrl')}
                            error={fieldErrors.posterUrl}
                        />
                        <Input label="Backdrop (URL)" {...field('backdropUrl')} />
                    </div>
                </form>
            </Modal>
        </div>
    );
}
