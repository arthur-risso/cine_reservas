import express, { type Application, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env, isProduction } from './config/env';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { createRateLimiter } from './middlewares/rateLimit';
import { docsRoutes } from './docs/docs.routes';
import { cronRoutes } from './jobs/cron.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { movieRoutes } from './modules/movies/movies.routes';
import { roomRoutes } from './modules/rooms/rooms.routes';
import { reservationRoutes } from './modules/reservations/reservations.routes';
import { showtimeRoutes } from './modules/showtimes/showtimes.routes';

export function createApp(): Application {
    const app = express();

    /**
     * Confia no primeiro proxy à frente (Nginx, Render, Railway...).
     *
     * Sem isso, atrás de proxy TODA requisição parece vir do mesmo IP e o
     * rate limit vira global: um usuário abusivo bloquearia o site inteiro.
     * O número 1 (em vez de `true`) evita que alguém forje X-Forwarded-For
     * encadeado para escapar do limite.
     */
    app.set('trust proxy', 1);
    app.disable('x-powered-by');

    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    // A API só devolve JSON; não há página para carregar script.
                    scriptSrc: ["'none'"],
                    styleSrc: ["'self'"],
                    imgSrc: ["'self'", 'data:'],
                    connectSrc: ["'self'", env.CORS_ORIGIN],
                    objectSrc: ["'none'"],
                    frameAncestors: ["'none'"],
                    baseUri: ["'self'"],
                    formAction: ["'self'"],
                },
            },
            // Navegador só fala com a API por HTTPS depois da primeira visita.
            hsts: isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
            referrerPolicy: { policy: 'no-referrer' },
            crossOriginResourcePolicy: { policy: 'same-site' },
        }),
    );

    app.use(
        cors({
            // Lista fixa: `origin: true` (ecoar qualquer origem) somado a
            // credentials:true permitiria a qualquer site ler respostas
            // autenticadas do usuário.
            origin: env.CORS_ORIGIN.split(',').map((value) => value.trim()),
            credentials: true,
            methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        }),
    );

    // Gzip/deflate nas respostas: a listagem de filmes e o mapa de poltronas
    // são JSON repetitivo, que comprime em torno de 80%.
    app.use(compression());

    // Limite no corpo: sem ele, um POST de 500MB consome memória do processo.
    app.use(express.json({ limit: '100kb' }));
    app.use(cookieParser());

    /**
     * Teto geral por IP. Rotas sensíveis (login, cadastro, reserva) têm
     * limites próprios e mais apertados, definidos em cada módulo.
     */
    app.use(
        createRateLimiter({
            windowMs: 15 * 60 * 1000,
            limit: 300,
            message: {
                message: 'Muitas requisições. Aguarde um instante.',
                code: 'TOO_MANY_REQUESTS',
            },
        }),
    );

    app.get('/health', (_req: Request, res: Response) => {
        res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
    });

    app.use('/api/docs', docsRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/movies', movieRoutes);
    app.use('/api/rooms', roomRoutes);
    app.use('/api/showtimes', showtimeRoutes);
    app.use('/api/reservations', reservationRoutes);
    app.use('/api/cron', cronRoutes);

    app.use(notFoundHandler);
    // Sempre por último: o Express só chega aqui quando algo dá next(erro).
    app.use(errorHandler);

    return app;
}
