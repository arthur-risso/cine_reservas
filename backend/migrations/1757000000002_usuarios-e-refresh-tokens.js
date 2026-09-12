/* eslint-disable camelcase */

exports.up = (pgm) => {
    pgm.createTable('users', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        name: { type: 'varchar(120)', notNull: true },
        // citext = comparação case-insensitive no próprio banco.
        // "Ana@x.com" e "ana@x.com" colidem no UNIQUE, como deve ser.
        email: { type: 'citext', notNull: true, unique: true },
        password_hash: { type: 'text', notNull: true },
        role: { type: 'user_role', notNull: true, default: 'CLIENT' },
        is_active: { type: 'boolean', notNull: true, default: true },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });

    pgm.addConstraint('users', 'users_email_formato_check', {
        check: "email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'",
    });

    pgm.createTrigger('users', 'users_set_updated_at', {
        when: 'BEFORE',
        operation: 'UPDATE',
        level: 'ROW',
        function: 'set_updated_at',
    });

    /**
     * Refresh tokens ficam no banco (apenas o hash) para permitir rotação com
     * detecção de reuso: cada token usado é revogado e substituído por outro.
     * Se um token já revogado reaparecer, é sinal de roubo — derrubamos a
     * família inteira. Guardar só o hash significa que um vazamento do banco
     * não entrega sessões ativas a ninguém.
     */
    pgm.createTable('refresh_tokens', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
        token_hash: { type: 'text', notNull: true, unique: true },
        // Todos os tokens descendentes de um mesmo login compartilham a família.
        family_id: { type: 'uuid', notNull: true },
        user_agent: { type: 'varchar(255)' },
        expires_at: { type: 'timestamptz', notNull: true },
        revoked_at: { type: 'timestamptz' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });

    pgm.createIndex('refresh_tokens', 'user_id');
    pgm.createIndex('refresh_tokens', 'family_id');
    pgm.createIndex('refresh_tokens', 'expires_at');
};

exports.down = (pgm) => {
    pgm.dropTable('refresh_tokens');
    pgm.dropTable('users');
};
