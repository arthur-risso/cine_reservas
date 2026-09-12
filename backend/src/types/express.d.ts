import type { UserRole } from '../utils/tokens';

/**
 * Adiciona `req.user` ao tipo Request do Express.
 *
 * Sem isso, todo controller precisaria de `(req as any).user` — perdendo
 * a checagem do TypeScript exatamente no ponto mais sensível do código,
 * que é decidir quem pode fazer o quê.
 */
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                role: UserRole;
            };
        }
    }
}

export {};
