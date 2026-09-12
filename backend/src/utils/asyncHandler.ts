import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * O Express 4 não captura rejeição de Promise: um `await` que falha dentro
 * de um handler async vira unhandled rejection e a requisição fica pendurada
 * até o timeout do cliente, sem resposta e sem log útil.
 *
 * Este wrapper liga o `.catch` ao `next()`, levando o erro ao errorHandler.
 * Toda rota async do projeto é registrada com ele.
 */
export function asyncHandler(
    handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
    return (req, res, next) => {
        handler(req, res, next).catch(next);
    };
}
