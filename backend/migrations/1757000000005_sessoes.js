/* eslint-disable camelcase */

exports.up = (pgm) => {
    pgm.createTable('showtimes', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        // RESTRICT: não se apaga um filme que já tem sessão vendida.
        movie_id: { type: 'uuid', notNull: true, references: 'movies', onDelete: 'RESTRICT' },
        room_id: { type: 'uuid', notNull: true, references: 'rooms', onDelete: 'RESTRICT' },
        starts_at: { type: 'timestamptz', notNull: true },
        // Guardado (e não calculado na leitura) porque inclui trailers e limpeza
        // da sala, e é o que a constraint de sobreposição compara.
        ends_at: { type: 'timestamptz', notNull: true },
        format: { type: 'session_format', notNull: true, default: '2D' },
        language: { type: 'session_language', notNull: true, default: 'SUBTITLED' },
        base_price: { type: 'numeric(10,2)', notNull: true },
        is_active: { type: 'boolean', notNull: true, default: true },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });

    pgm.addConstraint('showtimes', 'showtimes_intervalo_check', {
        check: 'ends_at > starts_at',
    });
    pgm.addConstraint('showtimes', 'showtimes_preco_check', {
        check: 'base_price > 0 AND base_price <= 1000',
    });

    /**
     * Duas sessões não podem ocupar a mesma sala ao mesmo tempo.
     *
     * Dá para validar isso na aplicação com um SELECT antes do INSERT — e
     * falhar, porque entre o SELECT e o INSERT outra requisição cabe. Esta
     * constraint EXCLUDE resolve no banco: o Postgres compara os intervalos
     * com um índice GiST e recusa qualquer sobreposição, sob qualquer
     * concorrência. `[)` = início incluído, fim excluído, então uma sessão
     * pode começar exatamente quando a anterior termina.
     */
    pgm.sql(
        'ALTER TABLE showtimes ADD CONSTRAINT showtimes_sem_sobreposicao ' +
            'EXCLUDE USING gist (' +
            'room_id WITH =, ' +
            "tstzrange(starts_at, ends_at, '[)') WITH &&" +
            ') WHERE (is_active)',
    );

    // Vitrine ("em cartaz hoje") e calendário do filme.
    pgm.createIndex('showtimes', 'starts_at');
    pgm.createIndex('showtimes', ['movie_id', 'starts_at']);
    pgm.createIndex('showtimes', ['room_id', 'starts_at']);

    pgm.createTrigger('showtimes', 'showtimes_set_updated_at', {
        when: 'BEFORE',
        operation: 'UPDATE',
        level: 'ROW',
        function: 'set_updated_at',
    });

    /**
     * Tabela de preço por tipo de poltrona. Fica em tabela (e não em
     * constante no código) para o admin ajustar sem deploy.
     * Preço final = base_price * multiplier * (0.5 se meia-entrada).
     */
    pgm.createTable('seat_tier_prices', {
        tier: { type: 'seat_tier', primaryKey: true },
        label: { type: 'varchar(40)', notNull: true },
        description: { type: 'text' },
        multiplier: { type: 'numeric(4,2)', notNull: true },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });

    pgm.addConstraint('seat_tier_prices', 'seat_tier_prices_multiplicador_check', {
        check: 'multiplier > 0 AND multiplier <= 10',
    });

    pgm.sql(
        'INSERT INTO seat_tier_prices (tier, label, description, multiplier) VALUES ' +
            "('NORMAL', 'Normal', 'Poltrona tradicional estofada.', 1.00), " +
            "('SEMI_VIP', 'Semi-VIP', 'Assento mais largo, maior espaço entre fileiras e apoio de braço individual.', 1.40), " +
            "('VIP', 'VIP', 'Poltrona reclinável de couro, apoio para pernas e mesa lateral.', 1.90)",
    );
};

exports.down = (pgm) => {
    pgm.dropTable('seat_tier_prices');
    pgm.dropTable('showtimes');
};
