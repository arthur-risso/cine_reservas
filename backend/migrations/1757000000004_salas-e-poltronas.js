/* eslint-disable camelcase */

exports.up = (pgm) => {
    pgm.createTable('rooms', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        name: { type: 'varchar(60)', notNull: true, unique: true },
        technology: { type: 'varchar(40)', notNull: true, default: 'Padrão' },
        rows_count: { type: 'integer', notNull: true },
        seats_per_row: { type: 'integer', notNull: true },
        is_active: { type: 'boolean', notNull: true, default: true },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });

    // 26 fileiras = limite do alfabeto usado no row_label (A..Z).
    pgm.addConstraint('rooms', 'rooms_dimensoes_check', {
        check: 'rows_count BETWEEN 1 AND 26 AND seats_per_row BETWEEN 1 AND 40',
    });

    pgm.createTrigger('rooms', 'rooms_set_updated_at', {
        when: 'BEFORE',
        operation: 'UPDATE',
        level: 'ROW',
        function: 'set_updated_at',
    });

    pgm.createTable('seats', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        room_id: { type: 'uuid', notNull: true, references: 'rooms', onDelete: 'CASCADE' },
        row_label: { type: 'varchar(2)', notNull: true },
        seat_number: { type: 'integer', notNull: true },
        tier: { type: 'seat_tier', notNull: true, default: 'NORMAL' },
        is_accessible: { type: 'boolean', notNull: true, default: false },
        is_active: { type: 'boolean', notNull: true, default: true },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });

    // Não existe "fileira A, poltrona 5" duas vezes na mesma sala.
    pgm.addConstraint('seats', 'seats_posicao_unica', {
        unique: ['room_id', 'row_label', 'seat_number'],
    });
    pgm.addConstraint('seats', 'seats_numero_check', { check: 'seat_number > 0' });

    // O mapa de poltronas é sempre lido por sala e desenhado nesta ordem.
    pgm.createIndex('seats', ['room_id', 'row_label', 'seat_number']);
};

exports.down = (pgm) => {
    pgm.dropTable('seats');
    pgm.dropTable('rooms');
};
