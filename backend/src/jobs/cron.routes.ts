import { timingSafeEqual } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { env } from '../config/env';
import { asyncHandler } from '../utils/asyncHandler';
import { notFound, unauthorized } from '../utils/AppError';
import { runReservationExpiration, runTokenCleanup } from './expireReservations';

export const cronRoutes = Router();

/**
 * Só o Vercel Cron pode disparar a limpeza.
 *
 * A rota é pública na internet; sem a checagem, qualquer um poderia martelá-la
 * e gerar carga de escrita no banco. O Vercel envia
 * `Authorization: Bearer <CRON_SECRET>` automaticamente quando a variável
 * existe no projeto.
 *
 * Sem CRON_SECRET configurado a rota responde 404: fica fechada por padrão,
 * em vez de aberta por esquecimento.
 */
function requireCronSecret(req: Request, _res: Response, next: NextFunction): void {
    if (!env.CRON_SECRET) {
        next(notFound());
        return;
    }

    const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
    const received = Buffer.from(req.headers.authorization ?? '');

    // Comparação em tempo constante: com `===` o tempo de resposta vaza
    // quantos caracteres iniciais batem, e o segredo pode ser adivinhado aos
    // poucos. O timingSafeEqual exige tamanhos iguais, daí o teste antes.
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
        next(unauthorized('Acesso restrito ao agendador.', 'INVALID_CRON_SECRET'));
        return;
    }

    next();
}

cronRoutes.get(
    '/limpeza',
    requireCronSecret,
    asyncHandler(async (_req: Request, res: Response) => {
        const expiredReservations = await runReservationExpiration();
        const deletedTokens = await runTokenCleanup();
        res.json({ data: { expiredReservations, deletedTokens } });
    }),
);
