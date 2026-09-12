/* eslint-disable camelcase */

/**
 * Busca que ignora acento.
 *
 * O problema: com a configuração `portuguese` padrão, quem digita
 * "alienigenas" não encontra "alienígenas", e "ficcao" não encontra
 * "ficção". Na prática quase ninguém usa acento em campo de busca, então
 * metade das buscas legítimas voltaria vazia.
 *
 * A solução: uma configuração de busca própria que passa cada palavra pelo
 * dicionário `unaccent` ANTES do stemmer português. "alienígenas" e
 * "alienigenas" viram o mesmo token, tanto ao indexar quanto ao consultar.
 *
 * Detalhe importante: `unaccent()` como função é STABLE (depende do
 * dicionário instalado) e não poderia ser usada em coluna gerada. Usada
 * como DICIONÁRIO dentro de uma text search configuration, a chamada fica
 * encapsulada e `to_tsvector('config'::regconfig, texto)` continua IMMUTABLE
 * — que é o requisito da coluna gerada.
 */
exports.up = (pgm) => {
    pgm.createExtension('unaccent', { ifNotExists: true });

    pgm.sql(
        'CREATE TEXT SEARCH CONFIGURATION public.portuguese_unaccent ( COPY = pg_catalog.portuguese )',
    );

    pgm.sql(
        'ALTER TEXT SEARCH CONFIGURATION public.portuguese_unaccent ' +
            'ALTER MAPPING FOR hword, hword_part, word ' +
            'WITH unaccent, portuguese_stem',
    );

    // A coluna gerada precisa ser recriada com a configuração nova
    // (não dá para alterar a expressão de uma generated column no lugar).
    /**
     * `array_to_string` é STABLE no Postgres (o resultado depende das funções
     * de saída do tipo do elemento), e coluna gerada só aceita expressão
     * IMMUTABLE. Para `text[]` não existe essa ambiguidade — texto sempre sai
     * como texto — então um wrapper marcado IMMUTABLE é seguro aqui.
     */
    pgm.sql(
        "CREATE OR REPLACE FUNCTION public.text_array_to_string(arr text[]) " +
            "RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS " +
            "$$ SELECT array_to_string(arr, ' ') $$",
    );

    pgm.sql('ALTER TABLE movies DROP COLUMN search_vector');

    pgm.sql(
        "ALTER TABLE movies ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (" +
            "setweight(to_tsvector('public.portuguese_unaccent'::regconfig, coalesce(title, '')), 'A') || " +
            "setweight(to_tsvector('public.portuguese_unaccent'::regconfig, coalesce(original_title, '')), 'B') || " +
            "setweight(to_tsvector('public.portuguese_unaccent'::regconfig, coalesce(director, '')), 'C') || " +
            // Gêneros entram no índice: quem busca "ficcao" quer os filmes de
            // ficção científica, mesmo que a palavra não apareça na sinopse.
            "setweight(to_tsvector('public.portuguese_unaccent'::regconfig, public.text_array_to_string(genres)), 'B') || " +
            "setweight(to_tsvector('public.portuguese_unaccent'::regconfig, coalesce(synopsis, '')), 'D')" +
            ') STORED',
    );

    // O índice caiu junto com a coluna anterior.
    pgm.createIndex('movies', 'search_vector', { method: 'gin' });
};

exports.down = (pgm) => {
    pgm.sql('ALTER TABLE movies DROP COLUMN search_vector');

    pgm.sql(
        "ALTER TABLE movies ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (" +
            "setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') || " +
            "setweight(to_tsvector('portuguese', coalesce(original_title, '')), 'B') || " +
            "setweight(to_tsvector('portuguese', coalesce(director, '')), 'C') || " +
            "setweight(to_tsvector('portuguese', coalesce(synopsis, '')), 'D')" +
            ') STORED',
    );

    pgm.createIndex('movies', 'search_vector', { method: 'gin' });
    pgm.sql('DROP FUNCTION IF EXISTS public.text_array_to_string(text[])');
    pgm.sql('DROP TEXT SEARCH CONFIGURATION public.portuguese_unaccent');
    pgm.dropExtension('unaccent');
};
