import rateLimit, { type Options } from 'express-rate-limit';
import { isTest } from '../config/env';

/**
 * Cria um limitador que se desliga sozinho durante os testes.
 *
 * Sem isso, a suíte esbarra no próprio limite: o teste de concorrência
 * dispara 10 reservas de uma vez e os testes de auth fazem vários cadastros
 * seguidos, todos vindos do mesmo IP. As falhas resultantes seriam 429 —
 * ruído que não tem nada a ver com o comportamento sob teste.
 *
 * O limite em si é validado à parte, no teste de concorrência via HTTP
 * (tools/teste-concorrencia.mjs), onde ele deve mesmo entrar em ação.
 */
export function createRateLimiter(options: Partial<Options>) {
    return rateLimit({
        standardHeaders: true,
        legacyHeaders: false,
        skip: () => isTest,
        ...options,
    });
}
