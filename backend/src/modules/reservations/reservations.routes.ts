import { Router, type Request, type Response } from 'express';
import { createRateLimiter } from '../../middlewares/rateLimit';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { uuidParamSchema } from '../movies/movies.schema';
import { createReservationSchema, listReservationsQuerySchema } from './reservations.schema';
import * as service from './reservations.service';

/**
 * Limite específico para criação de reserva.
 *
 * Cada reserva segura poltronas por 10 minutos. Sem teto, um script criaria
 * centenas de reservas pendentes e esgotaria a sala inteira sem pagar nada —
 * negação de serviço contra a bilheteria, não contra o servidor.
 */
const createReservationLimiter = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    limit: 40,
    // Por usuário autenticado (e não por IP): uma família no mesmo wi-fi não
    // deve atrapalhar a compra de quem está do lado.
    keyGenerator: (req) => req.user?.id ?? req.ip ?? 'anon',
    message: {
        message: 'Você criou muitas reservas seguidas. Aguarde alguns minutos.',
        code: 'TOO_MANY_RESERVATIONS',
    },
});

export const reservationRoutes = Router();

// Nenhuma rota de reserva é pública.
reservationRoutes.use(authenticate);

reservationRoutes.get(
    '/me',
    validate({ query: listReservationsQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
        res.json(await service.listMyReservations(req.user!.id, req.query as never));
    }),
);

reservationRoutes.get(
    '/:id',
    validate({ params: uuidParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const reservation = await service.getReservation(
            req.params.id as string,
            req.user!.id,
            req.user!.role === 'ADMIN',
        );
        res.json({ data: reservation });
    }),
);

reservationRoutes.post(
    '/',
    createReservationLimiter,
    validate({ body: createReservationSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const reservation = await service.createReservation(req.user!.id, req.body);
        res.status(201).json({ data: reservation });
    }),
);

reservationRoutes.post(
    '/:id/confirm',
    validate({ params: uuidParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const reservation = await service.confirmReservation(req.params.id as string, req.user!.id);
        res.json({ data: reservation });
    }),
);

reservationRoutes.post(
    '/:id/cancel',
    validate({ params: uuidParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const reservation = await service.cancelReservation(req.params.id as string, req.user!.id);
        res.json({ data: reservation });
    }),
);
