import { Router, type Request, type Response } from 'express';
import { authenticate, optionalAuthenticate, requireRole } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { uuidParamSchema } from '../movies/movies.schema';
import {
    createShowtimeSchema,
    listShowtimesQuerySchema,
    updateShowtimeSchema,
} from './showtimes.schema';
import * as service from './showtimes.service';

export const showtimeRoutes = Router();

showtimeRoutes.get(
    '/',
    validate({ query: listShowtimesQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
        res.set('Cache-Control', 'public, max-age=15');
        res.json(await service.listShowtimes(req.query as never));
    }),
);

showtimeRoutes.get(
    '/:id',
    validate({ params: uuidParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        res.json({ data: await service.getShowtime(req.params.id as string) });
    }),
);

showtimeRoutes.get(
    '/:id/seats',
    // Com login, marca as poltronas da própria reserva do usuário.
    optionalAuthenticate,
    validate({ params: uuidParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const seatMap = await service.getSeatMap(req.params.id as string, req.user?.id);
        // Disponibilidade muda a cada segundo: cachear aqui mostraria
        // poltrona livre que já foi vendida.
        res.set('Cache-Control', 'no-store');
        res.json({ data: seatMap });
    }),
);

showtimeRoutes.post(
    '/',
    authenticate,
    requireRole('ADMIN'),
    validate({ body: createShowtimeSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        res.status(201).json({ data: await service.createShowtime(req.body) });
    }),
);

showtimeRoutes.patch(
    '/:id',
    authenticate,
    requireRole('ADMIN'),
    validate({ params: uuidParamSchema, body: updateShowtimeSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        res.json({ data: await service.updateShowtime(req.params.id as string, req.body) });
    }),
);

showtimeRoutes.delete(
    '/:id',
    authenticate,
    requireRole('ADMIN'),
    validate({ params: uuidParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        await service.cancelShowtime(req.params.id as string);
        res.status(204).send();
    }),
);
