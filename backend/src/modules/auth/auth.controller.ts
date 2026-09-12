import type { CookieOptions, Request, Response } from 'express';
import { env, isProduction } from '../../config/env';
import { unauthorized } from '../../utils/AppError';
import * as service from './auth.service';

export const REFRESH_COOKIE = 'cinema_refresh';

/**
 * Onde guardar cada token — a decisão de segurança mais importante do front:
 *
 * - Access token: só na memória do JavaScript. Não vai para localStorage,
 *   porque qualquer XSS leria de lá; some ao fechar a aba, e dura 15 min.
 * - Refresh token: cookie httpOnly. O JavaScript não consegue ler (imune a
 *   XSS), e SameSite=Strict impede que outro site dispare requisições
 *   autenticadas em nome do usuário (CSRF).
 *
 * O `path` restrito faz o cookie ser enviado só nas rotas de auth — ele não
 * acompanha cada busca de filme à toa.
 */
function refreshCookieOptions(expiresAt: Date): CookieOptions {
    return {
        httpOnly: true,
        // Em produção o cookie só trafega sob HTTPS.
        secure: isProduction,
        sameSite: 'strict',
        path: '/api/auth',
        expires: expiresAt,
    };
}

function sendAuth(res: Response, result: service.AuthResult, status = 200): void {
    res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions(result.refreshExpiresAt));

    res.status(status).json({
        user: result.user,
        accessToken: result.accessToken,
        expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    });
}

function userAgentOf(req: Request): string | null {
    return req.headers['user-agent'] ?? null;
}

export async function register(req: Request, res: Response): Promise<void> {
    const result = await service.register(req.body, userAgentOf(req));
    sendAuth(res, result, 201);
}

export async function login(req: Request, res: Response): Promise<void> {
    const result = await service.login(req.body, userAgentOf(req));
    sendAuth(res, result);
}

export async function refresh(req: Request, res: Response): Promise<void> {
    const token = req.cookies?.[REFRESH_COOKIE];

    if (!token || typeof token !== 'string') {
        throw unauthorized('Sessão não encontrada.', 'NO_REFRESH_TOKEN');
    }

    const result = await service.refresh(token, userAgentOf(req));
    sendAuth(res, result);
}

export async function logout(req: Request, res: Response): Promise<void> {
    await service.logout(req.cookies?.[REFRESH_COOKIE]);

    // Limpar exige as MESMAS opções usadas ao criar, senão o navegador
    // entende como outro cookie e o original continua lá.
    res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: isProduction, sameSite: 'strict', path: '/api/auth' });
    res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
    const user = await service.getProfile(req.user!.id);
    res.json({ user });
}
