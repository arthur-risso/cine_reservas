import { expirePendingReservations } from '../modules/reservations/reservations.repository';
import { deleteExpiredRefreshTokens } from '../modules/auth/auth.repository';

const EXPIRATION_INTERVAL_MS = 60_000;
const TOKEN_CLEANUP_INTERVAL_MS = 60 * 60_000;

/**
 * Rotinas de manutenção.
 *
 * Ponto importante: o job NÃO é o que garante a correção. Toda leitura de
 * disponibilidade já ignora reservas pendentes vencidas (comparando
 * `expires_at` com `now()`), então mesmo que este processo morra, ninguém vê
 * poltrona presa indevidamente.
 *
 * O job existe para manter o banco arrumado — status coerente nos relatórios
 * e `released = true` nas linhas antigas, o que mantém o índice único parcial
 * pequeno e rápido.
 *
 * Existem dois disparadores para as mesmas funções: `setInterval` quando a
 * API roda como processo contínuo (local, Render, VPS) e o Vercel Cron no
 * deploy serverless (ver cron.routes.ts), onde não há processo vivo entre
 * requisições para manter um timer.
 */
export async function runReservationExpiration(): Promise<number> {
    const count = await expirePendingReservations();
    if (count > 0) {
        console.log(`[job] ${count} reserva(s) expirada(s) e poltronas liberadas`);
    }
    return count;
}

export async function runTokenCleanup(): Promise<number> {
    const count = await deleteExpiredRefreshTokens();
    if (count > 0) {
        console.log(`[job] ${count} refresh token(s) expirado(s) removido(s)`);
    }
    return count;
}

/**
 * Em uma implantação com várias instâncias contínuas, isso migraria para um
 * worker único (ou um advisory lock), para não ter N processos varrendo a
 * mesma tabela ao mesmo tempo.
 */
export function startBackgroundJobs(): () => void {
    const expirationTimer = setInterval(() => {
        runReservationExpiration().catch((error) => {
            // Nunca deixar a exceção escapar de um setInterval: uma
            // rejeição não tratada derruba o processo inteiro.
            console.error('[job] falha ao expirar reservas:', error);
        });
    }, EXPIRATION_INTERVAL_MS);

    const tokenTimer = setInterval(() => {
        runTokenCleanup().catch((error) => {
            console.error('[job] falha ao limpar refresh tokens:', error);
        });
    }, TOKEN_CLEANUP_INTERVAL_MS);

    // unref: estes timers não seguram o processo vivo no encerramento.
    expirationTimer.unref();
    tokenTimer.unref();

    return () => {
        clearInterval(expirationTimer);
        clearInterval(tokenTimer);
    };
}
