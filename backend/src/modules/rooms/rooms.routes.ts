import { Router, type Request, type Response } from 'express';
import { authenticate, optionalAuthenticate, requireRole } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { uuidParamSchema } from '../movies/movies.schema';
import { createRoomSchema, listRoomsQuerySchema, updateRoomSchema } from './rooms.schema';
import * as service from './rooms.service';

export const roomRoutes = Router();

roomRoutes.get(
    '/',
    // Identifica o usuário se houver token, mas não exige login.
    optionalAuthenticate,
    validate({ query: listRoomsQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
        const query = req.query as unknown as { includeInactive: boolean };
        // Só o admin enxerga salas desativadas.
        const includeInactive = query.includeInactive && req.user?.role === 'ADMIN';
        res.json({ data: await service.listRooms(Boolean(includeInactive)) });
    }),
);

roomRoutes.get(
    '/:id',
    validate({ params: uuidParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        res.json({ data: await service.getRoom(req.params.id as string) });
    }),
);

roomRoutes.post(
    '/',
    authenticate,
    requireRole('ADMIN'),
    validate({ body: createRoomSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        res.status(201).json({ data: await service.createRoom(req.body) });
    }),
);

roomRoutes.patch(
    '/:id',
    authenticate,
    requireRole('ADMIN'),
    validate({ params: uuidParamSchema, body: updateRoomSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        res.json({ data: await service.updateRoom(req.params.id as string, req.body) });
    }),
);

roomRoutes.delete(
    '/:id',
    authenticate,
    requireRole('ADMIN'),
    validate({ params: uuidParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
        await service.deactivateRoom(req.params.id as string);
        res.status(204).send();
    }),
);
