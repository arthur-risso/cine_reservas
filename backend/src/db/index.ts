import type { PoolClient, QueryResultRow } from 'pg';
import { pool } from './pool';
import { isProduction } from '../config/env';

/** Qualquer coisa que aceite `.query()`: o pool ou um client em transação. */
export interface Queryable {
    query<T extends QueryResultRow>(
        text: string,
        params?: unknown[],
    ): Promise<{ rows: T[]; rowCount: number | null }>;
}

const SLOW_QUERY_MS = 200;

/**
 * Executa SQL e devolve as linhas.
 *
 * `params` NUNCA é interpolado na string: o driver envia comando e dados
 * separados ao Postgres, o que torna SQL injection impossível por
 * construção. Toda query do projeto passa por aqui ou por `client.query`
 * com parâmetros — nenhuma monta SQL com template string de input.
 */
export async function query<T extends QueryResultRow>(
    text: string,
    params: unknown[] = [],
    executor: Queryable = pool,
): Promise<T[]> {
    const startedAt = Date.now();
    const result = await executor.query<T>(text, params);
    const elapsed = Date.now() - startedAt;

    // Em desenvolvimento, denuncia a query lenta na hora em que ela nasce —
    // muito mais barato que descobrir em produção.
    if (!isProduction && elapsed > SLOW_QUERY_MS) {
        console.warn(`[db] query lenta (${elapsed}ms): ${text.replace(/\s+/g, ' ').slice(0, 120)}`);
    }

    return result.rows;
}

/** Mesma coisa, mas para quando se espera no máximo uma linha. */
export async function queryOne<T extends QueryResultRow>(
    text: string,
    params: unknown[] = [],
    executor: Queryable = pool,
): Promise<T | null> {
    const rows = await query<T>(text, params, executor);
    return rows[0] ?? null;
}

/**
 * Roda `fn` dentro de uma transação, com COMMIT no sucesso e ROLLBACK em
 * qualquer erro — e devolve a conexão ao pool em qualquer cenário.
 *
 * É o que garante atomicidade na reserva: ou todas as poltronas entram,
 * ou nenhuma entra. Sem isso, uma falha no meio deixaria o cliente com
 * 3 das 5 poltronas que pediu, e as outras 2 travadas em limbo.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('[db] falha no ROLLBACK:', rollbackError);
        }
        throw error;
    } finally {
        client.release();
    }
}

export { pool };
