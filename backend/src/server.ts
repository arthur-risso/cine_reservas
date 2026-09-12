import type { Server } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { checkDatabaseConnection, closePool } from './db/pool';
import { startBackgroundJobs } from './jobs/expireReservations';

/**
 * Ponto de entrada: só sobe o processo.
 *
 * A montagem do Express fica em `app.ts` porque os testes precisam da
 * aplicação SEM ninguém ocupando uma porta — o Supertest chama o app
 * direto. Misturar as duas coisas obriga cada teste a subir um servidor real.
 */
async function bootstrap(): Promise<void> {
    // Falha agora, com mensagem clara, em vez de na primeira requisição.
    await checkDatabaseConnection();
    console.log('[db] conexão com o PostgreSQL estabelecida');

    const app = createApp();
    const stopJobs = startBackgroundJobs();

    const server: Server = app.listen(env.PORT, () => {
        console.log(`[api] http://localhost:${env.PORT}  (${env.NODE_ENV})`);
    });

    /**
     * Encerramento gracioso.
     *
     * Em um deploy, o orquestrador manda SIGTERM e mata o processo segundos
     * depois. Sem tratar o sinal, requisições em andamento são cortadas no
     * meio — inclusive uma transação de reserva, que ficaria com poltronas
     * travadas até o timeout do banco.
     */
    const shutdown = (signal: string) => {
        console.log(`\n[api] ${signal} recebido, encerrando...`);

        stopJobs();

        server.close(async () => {
            await closePool();
            console.log('[api] encerrado com sucesso');
            process.exit(0);
        });

        // Rede de segurança: se algo travar, não fica pendurado para sempre.
        setTimeout(() => {
            console.error('[api] encerramento forçado após 10s');
            process.exit(1);
        }, 10_000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
    console.error('[api] falha ao iniciar:', error);
    process.exit(1);
});
