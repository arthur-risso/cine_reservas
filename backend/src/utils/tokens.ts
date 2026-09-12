import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { unauthorized } from './AppError';

export type UserRole = 'CLIENT' | 'ADMIN';

export interface AccessTokenPayload {
    sub: string;
    email: string;
    role: UserRole;
}

/**
 * Access token: JWT curto (15 min), guardado apenas em memória no frontend.
 *
 * Ele é auto-contido — o servidor valida a assinatura sem ir ao banco, o que
 * deixa cada requisição autenticada barata. O preço é não conseguir revogar
 * antes de expirar; por isso a validade é curta e a revogação de verdade
 * acontece no refresh token, esse sim registrado no banco.
 */
export function signAccessToken(payload: AccessTokenPayload): string {
    const options: SignOptions = {
        expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
        issuer: 'cinema-platform',
        audience: 'cinema-web',
    };

    return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
    try {
        const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
            issuer: 'cinema-platform',
            audience: 'cinema-web',
        });

        if (typeof decoded === 'string') {
            throw unauthorized('Token inválido.', 'INVALID_TOKEN');
        }

        return {
            sub: String(decoded.sub),
            email: String(decoded.email),
            role: decoded.role as UserRole,
        };
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            // Código distinto: é o sinal para o frontend tentar o refresh
            // automático em vez de mandar o usuário para o login.
            throw unauthorized('Sessão expirada.', 'TOKEN_EXPIRED');
        }
        if (error instanceof jwt.JsonWebTokenError) {
            throw unauthorized('Token inválido.', 'INVALID_TOKEN');
        }
        throw error;
    }
}

/**
 * Refresh token: string opaca aleatória, não JWT.
 *
 * Não precisa carregar informação — só precisa ser impossível de adivinhar
 * e possível de revogar. 48 bytes de entropia criptográfica dão isso, e
 * ficam menores e mais simples que um JWT.
 */
export function generateRefreshToken(): string {
    return crypto.randomBytes(48).toString('base64url');
}

/**
 * No banco guardamos só o HMAC do token, nunca o token.
 *
 * Se o banco vazar, os hashes não servem para nada sem o segredo da
 * aplicação (que fica no .env, em outro lugar) — é a mesma lógica de nunca
 * guardar senha em texto puro, aplicada a sessões.
 *
 * HMAC-SHA256 em vez de bcrypt aqui porque o valor já é aleatório e de alta
 * entropia: não há o que quebrar por força bruta, e o refresh precisa ser rápido.
 */
export function hashRefreshToken(token: string): string {
    return crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');
}

/** Converte "7d" / "15m" / "30s" em milissegundos. */
export function durationToMs(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration.trim());

    if (!match) {
        throw new Error(`Duração inválida: "${duration}". Use formatos como 15m, 24h, 7d.`);
    }

    const amount = Number(match[1]);
    const unit = match[2] as 's' | 'm' | 'h' | 'd';
    const multipliers = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

    return amount * multipliers[unit];
}

/**
 * Código da reserva mostrado ao cliente (ex.: "CINE-7KQ2XB").
 *
 * Sem 0/O/1/I/L para não gerar confusão quando alguém lê o código em voz
 * alta na bilheteria.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateReservationCode(): string {
    const bytes = crypto.randomBytes(6);
    let code = '';

    for (const byte of bytes) {
        code += ALPHABET[byte % ALPHABET.length];
    }

    return `CINE-${code}`;
}
