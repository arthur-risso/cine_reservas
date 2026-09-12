import { Pool, types } from 'pg';
import { env, isProduction } from '../config/env';

/**
 * Por padrão o node-pg devolve `numeric` como string, para não perder
 * precisão em valores gigantes. Aqui todo numeric é dinheiro com 2 casas,
 * e receber string transforma `preco + preco` em concatenação silenciosa.
 * Convertendo no driver, o resto do código trabalha com number de verdade.
 *
 * (Em um sistema financeiro real o caminho seria o oposto: manter string e
 * usar inteiro de centavos ou uma lib decimal.)
 */
types.setTypeParser(types.builtins.NUMERIC, (value) => Number.parseFloat(value));

/**
 * Um único pool para todo o processo. Abrir conexão por requisição custa
 * handshake TCP + autenticação a cada chamada — com pool, a conexão é
 * reaproveitada e o tempo de resposta cai de dezenas de ms para ~1ms.
 */
export const pool = new Pool({
    connectionString: env.DATABASE_URL,
    // Acima disso o Postgres passa a sofrer com troca de contexto. 10 é
    // folgado para uma API deste porte; ajuste junto com max_connections.
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: isProduction ? { rejectUnauthorized: false } : undefined,
});

// Erro em conexão ociosa não pertence a nenhuma requisição: sem este
// listener, o processo inteiro cai com uma exceção não tratada.
pool.on('error', (err) => {
    console.error('[db] erro em conexão ociosa do pool:', err.message);
});

export async function checkDatabaseConnection(): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query('SELECT 1');
    } finally {
        client.release();
    }
}

export async function closePool(): Promise<void> {
    await pool.end();
}
