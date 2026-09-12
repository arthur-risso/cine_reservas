/* eslint-disable camelcase */

exports.up = (pgm) => {
    pgm.createTable('reservations', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        // Código curto e legível para o cliente apresentar na bilheteria.
        code: { type: 'varchar(12)', notNull: true, unique: true },
        user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
        showtime_id: {
            type: 'uuid',
            notNull: true,
            references: 'showtimes',
            onDelete: 'RESTRICT',
        },
        status: { type: 'reservation_status', notNull: true, default: 'PENDING' },
        total_amount: { type: 'numeric(10,2)', notNull: true, default: 0 },
        // Só faz sentido enquanto PENDING: é o prazo para confirmar.
        expires_at: { type: 'timestamptz' },
        confirmed_at: { type: 'timestamptz' },
        cancelled_at: { type: 'timestamptz' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });

    pgm.createIndex('reservations', ['user_id', 'created_at']);
    pgm.createIndex('reservations', 'showtime_id');
    // Índice parcial: o job de expiração varre só as pendentes, que são poucas.
    pgm.createIndex('reservations', 'expires_at', {
        name: 'reservations_pendentes_expirando_idx',
        where: "status = 'PENDING'",
    });

    pgm.createTrigger('reservations', 'reservations_set_updated_at', {
        when: 'BEFORE',
        operation: 'UPDATE',
        level: 'ROW',
        function: 'set_updated_at',
    });

    pgm.createTable('reservation_seats', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        reservation_id: {
            type: 'uuid',
            notNull: true,
            references: 'reservations',
            onDelete: 'CASCADE',
        },
        // Desnormalizado de propósito: é o que permite o índice único parcial
        // abaixo, sem precisar de JOIN com reservations.
        showtime_id: {
            type: 'uuid',
            notNull: true,
            references: 'showtimes',
            onDelete: 'CASCADE',
        },
        seat_id: { type: 'uuid', notNull: true, references: 'seats', onDelete: 'RESTRICT' },
        ticket_kind: { type: 'ticket_kind', notNull: true, default: 'FULL' },
        // Congelado no momento da reserva: se o admin mudar o preço depois,
        // o que o cliente já reservou não muda.
        tier: { type: 'seat_tier', notNull: true },
        unit_price: { type: 'numeric(10,2)', notNull: true },
        // Vira true quando a reserva é cancelada ou expira, devolvendo a
        // poltrona ao mapa.
        released: { type: 'boolean', notNull: true, default: false },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });

    /**
     * A linha mais importante do schema inteiro.
     *
     * Índice único PARCIAL: para uma mesma sessão, um mesmo assento só pode
     * ter uma linha não liberada. Duas requisições simultâneas tentando a
     * poltrona F7 da sessão X: o Postgres aceita uma e rejeita a outra com
     * erro 23505, que a API traduz em 409. Overbooking deixa de depender da
     * ordem em que o código roda.
     *
     * Parcial (WHERE NOT released) porque assentos cancelados/expirados
     * precisam continuar na tabela como histórico, sem bloquear nova venda.
     */
    pgm.sql(
        'CREATE UNIQUE INDEX reservation_seats_assento_ocupado_idx ' +
            'ON reservation_seats (showtime_id, seat_id) WHERE NOT released',
    );

    pgm.createIndex('reservation_seats', 'reservation_id');
    pgm.addConstraint('reservation_seats', 'reservation_seats_preco_check', {
        check: 'unit_price >= 0',
    });
};

exports.down = (pgm) => {
    pgm.dropTable('reservation_seats');
    pgm.dropTable('reservations');
};
