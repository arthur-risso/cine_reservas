import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { forbidden, unauthorized } from '../utils/AppError';
import { verifyAccessToken, type UserRole } from '../utils/tokens';

function extractBearerToken(req: Request): string | null {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
        return null;
    }

    const token = header.slice('Bearer '.length).trim();
    return token.length > 0 ? token : null;
}

/** Exige um access token válido. Preenche `req.user`. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
    const token = extractBearerToken(req);

    if (!token) {
        next(unauthorized('Faça login para continuar.', 'NO_TOKEN'));
        return;
    }

    try {
        const payload = verifyAccessToken(token);
        req.user = { id: payload.sub, email: payload.email, role: payload.role };
        next();
    } catch (error) {
        next(error);
    }
}

/**
 * Autenticação opcional: identifica o usuário se houver token válido, mas
 * deixa passar quem está deslogado.
 *
 * Usado em listagens públicas que mudam um pouco quando há sessão — por
 * exemplo, marcar no mapa quais poltronas são da reserva do próprio usuário.
 */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
    const token = extractBearerToken(req);

    if (!token) {
        next();
        return;
    }

    try {
        const payload = verifyAccessToken(token);
        req.user = { id: payload.sub, email: payload.email, role: payload.role };
    } catch {
        // Token ruim aqui não é erro: segue como visitante.
    }

    next();
}

/**
 * Autorização por papel. Sempre no servidor.
 *
 * Esconder o botão "Novo filme" no React é usabilidade, não segurança —
 * qualquer pessoa chama `POST /api/movies` pelo terminal. É esta linha que
 * realmente impede.
 */
export function requireRole(...roles: UserRole[]): RequestHandler {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (!req.user) {
            next(unauthorized('Faça login para continuar.', 'NO_TOKEN'));
            return;
        }

        if (!roles.includes(req.user.role)) {
            next(forbidden('Esta ação é restrita a administradores.'));
            return;
        }

        next();
    };
}
