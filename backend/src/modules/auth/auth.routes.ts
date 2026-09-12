import { Router } from 'express';
import { createRateLimiter } from '../../middlewares/rateLimit';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import * as controller from './auth.controller';
import { loginSchema, registerSchema } from './auth.schema';

/**
 * Rate limit dedicado e agressivo nas rotas de credencial.
 *
 * O limite geral (100 req / 15 min) é generoso demais aqui: 100 tentativas
 * de senha por IP a cada 15 minutos é força bruta viável. Estas rotas ganham
 * um teto próprio e muito menor.
 */
const credentialsLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    // Login bem-sucedido não conta: quem acertou a senha não está atacando,
    // e assim um escritório inteiro atrás do mesmo IP não trava.
    skipSuccessfulRequests: true,
    message: {
        message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
        code: 'TOO_MANY_ATTEMPTS',
    },
});

const registerLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    message: {
        message: 'Muitas contas criadas a partir deste endereço. Tente mais tarde.',
        code: 'TOO_MANY_ATTEMPTS',
    },
});

export const authRoutes = Router();

authRoutes.post(
    '/register',
    registerLimiter,
    validate({ body: registerSchema }),
    asyncHandler(controller.register),
);

authRoutes.post(
    '/login',
    credentialsLimiter,
    validate({ body: loginSchema }),
    asyncHandler(controller.login),
);

authRoutes.post('/refresh', asyncHandler(controller.refresh));
authRoutes.post('/logout', asyncHandler(controller.logout));
authRoutes.get('/me', authenticate, asyncHandler(controller.me));
