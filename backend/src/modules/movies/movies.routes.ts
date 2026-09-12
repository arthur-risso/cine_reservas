import { Router, type Request, type Response } from 'express';
import { authenticate, requireRole } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import {
    calendarQuerySchema,
    createMovieSchema,
    listMoviesQuerySchema,
    updateMovieSchema,
    uuidParamSchema,
} from './movies.schema';
import * as service from './movies.service';

export const movieRoutes = Router();

/**
 * Leitura é pública: a vitrine precisa funcionar para quem nunca entrou no
 * site. Escrita exige login + papel ADMIN, checado no servidor.
 */

movieRoutes.get(
    '/',
    validate({ query: listMoviesQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const result = await service.listMovies(req.query as never);
        // Cache curto na borda: o catálogo muda pouco, mas não pode ficar
        // preso por muito tempo quando o admin publica um filme novo.
        res.set('Cache-Control', 'public, max-age=30');
        res.json(result);
    }),
);

movieRoutes.get(
    '/genres',
    asyncHandler(async (_req: Request, res: Response) => {
        res.set('Cache-Control', 'public, max-age=300');
        res.json({ data: await service.listGenres() });
    }),
);

movieRoutes.get(
    '/:id',
    validate({ params: uuidParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        res.json({ data: await service.getMovie(req.params.id as string) });
    }),
);

movieRoutes.get(
    '/:id/calendar',
    validate({ params: uuidParamSchema, query: calendarQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const days = await service.getMovieCalendar(req.params.id as string, req.query as never);
        res.json({ data: days });
    }),
);

movieRoutes.post(
    '/',
    authenticate,
    requireRole('ADMIN'),
    validate({ body: createMovieSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        res.status(201).json({ data: await service.createMovie(req.body) });
    }),
);

movieRoutes.patch(
    '/:id',
    authenticate,
    requireRole('ADMIN'),
    validate({ params: uuidParamSchema, body: updateMovieSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        res.json({ data: await service.updateMovie(req.params.id as string, req.body) });
    }),
);

movieRoutes.delete(
    '/:id',
    authenticate,
    requireRole('ADMIN'),
    validate({ params: uuidParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        await service.deactivateMovie(req.params.id as string);
        res.status(204).send();
    }),
);
