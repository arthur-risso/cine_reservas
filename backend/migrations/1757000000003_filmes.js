/* eslint-disable camelcase */

exports.up = (pgm) => {
    pgm.createTable('movies', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        title: { type: 'varchar(200)', notNull: true },
        original_title: { type: 'varchar(200)' },
        synopsis: { type: 'text', notNull: true },
        duration_min: { type: 'integer', notNull: true },
        // Array nativo do Postgres + índice GIN: filtrar por gênero fica
        // barato sem precisar de tabela de junção.
        genres: { type: 'text[]', notNull: true, default: pgm.func("'{}'::text[]") },
        // Classificação indicativa brasileira: L, 10, 12, 14, 16, 18
        age_rating: { type: 'varchar(2)', notNull: true, default: 'L' },
        director: { type: 'varchar(160)' },
        cast_names: { type: 'text[]', notNull: true, default: pgm.func("'{}'::text[]") },
        poster_url: { type: 'text' },
        backdrop_url: { type: 'text' },
        trailer_url: { type: 'text' },
        release_date: { type: 'date' },
        is_active: { type: 'boolean', notNull: true, default: true },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });

    pgm.addConstraint('movies', 'movies_duracao_check', {
        check: 'duration_min > 0 AND duration_min < 600',
    });
    pgm.addConstraint('movies', 'movies_classificacao_check', {
        check: "age_rating IN ('L', '10', '12', '14', '16', '18')",
    });

    /**
     * Coluna gerada + índice GIN = busca textual em português com stemming e
     * ranking por relevância, sem `ILIKE '%termo%'` (que ignora índice e
     * degrada linearmente conforme o catálogo cresce).
     *
     * setweight dá peso: acerto no título vale mais que acerto na sinopse.
     */
    pgm.sql(
        "ALTER TABLE movies ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (" +
            "setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') || " +
            "setweight(to_tsvector('portuguese', coalesce(original_title, '')), 'B') || " +
            "setweight(to_tsvector('portuguese', coalesce(director, '')), 'C') || " +
            "setweight(to_tsvector('portuguese', coalesce(synopsis, '')), 'D')" +
            ') STORED',
    );

    pgm.createIndex('movies', 'search_vector', { method: 'gin' });
    pgm.createIndex('movies', 'genres', { method: 'gin' });
    pgm.createIndex('movies', 'is_active');
    pgm.createIndex('movies', 'release_date');

    pgm.createTrigger('movies', 'movies_set_updated_at', {
        when: 'BEFORE',
        operation: 'UPDATE',
        level: 'ROW',
        function: 'set_updated_at',
    });
};

exports.down = (pgm) => {
    pgm.dropTable('movies');
};
