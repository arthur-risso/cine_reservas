/* eslint-disable camelcase */

/**
 * Base do schema: extensoes, tipos enumerados e a funcao de trigger que
 * mantem `updated_at` sempre correto.
 *
 * Usar ENUM de verdade (em vez de varchar) faz o banco recusar qualquer
 * valor fora da lista - a regra passa a existir mesmo que alguem escreva
 * direto no SQL, sem passar pela API.
 */
exports.up = (pgm) => {
    // gen_random_uuid() para PKs; citext para e-mail case-insensitive;
    // btree_gist para a constraint que impede sessoes sobrepostas na mesma sala.
    pgm.createExtension('pgcrypto', { ifNotExists: true });
    pgm.createExtension('citext', { ifNotExists: true });
    pgm.createExtension('btree_gist', { ifNotExists: true });

    pgm.createType('user_role', ['CLIENT', 'ADMIN']);
    pgm.createType('seat_tier', ['NORMAL', 'SEMI_VIP', 'VIP']);
    pgm.createType('reservation_status', ['PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED']);
    pgm.createType('ticket_kind', ['FULL', 'HALF']);
    pgm.createType('session_format', ['2D', '3D', 'IMAX', '4DX']);
    pgm.createType('session_language', ['DUBBED', 'SUBTITLED', 'ORIGINAL']);

    pgm.createFunction(
        'set_updated_at',
        [],
        { returns: 'trigger', language: 'plpgsql', replace: true },
        `
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        `,
    );
};

exports.down = (pgm) => {
    pgm.dropFunction('set_updated_at', []);
    pgm.dropType('session_language');
    pgm.dropType('session_format');
    pgm.dropType('ticket_kind');
    pgm.dropType('reservation_status');
    pgm.dropType('seat_tier');
    pgm.dropType('user_role');
    pgm.dropExtension('btree_gist');
    pgm.dropExtension('citext');
    pgm.dropExtension('pgcrypto');
};
