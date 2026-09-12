import crypto from 'node:crypto';
import { env } from '../../config/env';
import { withTransaction } from '../../db';
import { unauthorized } from '../../utils/AppError';
import { fakeVerify, hashPassword, verifyPassword } from '../../utils/password';
import {
    durationToMs,
    generateRefreshToken,
    hashRefreshToken,
    signAccessToken,
} from '../../utils/tokens';
import * as repo from './auth.repository';
import type { LoginInput, RegisterInput } from './auth.schema';

export interface AuthResult {
    user: repo.PublicUser;
    accessToken: string;
    refreshToken: string;
    refreshExpiresAt: Date;
}

function buildAuthResult(user: repo.UserRow, refreshToken: string, expiresAt: Date): AuthResult {
    return {
        user: repo.toPublicUser(user),
        accessToken: signAccessToken({ sub: user.id, email: user.email, role: user.role }),
        refreshToken,
        refreshExpiresAt: expiresAt,
    };
}

async function issueRefreshToken(
    userId: string,
    familyId: string,
    userAgent: string | null,
): Promise<{ token: string; expiresAt: Date }> {
    const token = generateRefreshToken();
    const expiresAt = new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRES_IN));

    await repo.insertRefreshToken({
        userId,
        tokenHash: hashRefreshToken(token),
        familyId,
        userAgent,
        expiresAt,
    });

    return { token, expiresAt };
}

export async function register(input: RegisterInput, userAgent: string | null): Promise<AuthResult> {
    const passwordHash = await hashPassword(input.password);

    // Sem SELECT prévio para checar duplicidade: entre o SELECT e o INSERT
    // cabe outra requisição com o mesmo e-mail. Deixamos o UNIQUE do banco
    // decidir e o errorHandler traduz o 23505 em "e-mail já cadastrado".
    const user = await repo.insertUser(input.name, input.email, passwordHash);

    const familyId = crypto.randomUUID();
    const { token, expiresAt } = await issueRefreshToken(user.id, familyId, userAgent);

    return buildAuthResult(user, token, expiresAt);
}

export async function login(input: LoginInput, userAgent: string | null): Promise<AuthResult> {
    const user = await repo.findUserByEmail(input.email);

    if (!user) {
        // Gasta o mesmo tempo de um bcrypt real antes de responder, para que
        // "e-mail não existe" e "senha errada" sejam indistinguíveis no relógio.
        await fakeVerify();
        throw unauthorized('E-mail ou senha inválidos.', 'INVALID_CREDENTIALS');
    }

    const passwordOk = await verifyPassword(input.password, user.password_hash);

    // Mensagem idêntica nos dois casos, de novo para não revelar quais
    // e-mails estão cadastrados.
    if (!passwordOk || !user.is_active) {
        throw unauthorized('E-mail ou senha inválidos.', 'INVALID_CREDENTIALS');
    }

    const familyId = crypto.randomUUID();
    const { token, expiresAt } = await issueRefreshToken(user.id, familyId, userAgent);

    return buildAuthResult(user, token, expiresAt);
}

/**
 * Troca um refresh token por um par novo (rotação) e detecta reuso.
 *
 * A rotação é o que limita o estrago de um token vazado: cada refresh
 * invalida o anterior, então uma cópia roubada só serve até o usuário
 * legítimo renovar. E quando o token antigo é apresentado de novo, sabemos
 * que existem duas partes com o mesmo token — momento de derrubar a família
 * inteira, porque não dá para saber qual das duas é o dono.
 */
export async function refresh(rawToken: string, userAgent: string | null): Promise<AuthResult> {
    const tokenHash = hashRefreshToken(rawToken);
    const stored = await repo.findRefreshTokenByHash(tokenHash);

    if (!stored) {
        throw unauthorized('Sessão inválida. Faça login novamente.', 'INVALID_REFRESH_TOKEN');
    }

    /**
     * Detecção de reuso — e o motivo de esta parte ficar FORA de qualquer
     * transação.
     *
     * A revogação da família precisa persistir mesmo com o erro lançado logo
     * em seguida. Dentro de uma transação, o `throw` provocaria ROLLBACK e
     * desfaria justamente a defesa que acabamos de aplicar: o atacante
     * receberia 401 e, na tentativa seguinte, encontraria tudo válido de novo.
     */
    if (stored.revoked_at) {
        await repo.revokeTokenFamily(stored.family_id);
        throw unauthorized(
            'Detectamos um uso suspeito da sua sessão. Por segurança, faça login novamente.',
            'REFRESH_TOKEN_REUSED',
        );
    }

    if (stored.expires_at.getTime() <= Date.now()) {
        throw unauthorized('Sessão expirada. Faça login novamente.', 'REFRESH_TOKEN_EXPIRED');
    }

    const user = await repo.findUserById(stored.user_id);
    if (!user) {
        throw unauthorized('Sessão inválida.', 'INVALID_REFRESH_TOKEN');
    }

    // A rotação em si é atômica: consumir o token antigo e emitir o novo
    // acontecem juntos, ou nenhum dos dois.
    return withTransaction(async (client) => {
        const consumed = await repo.consumeRefreshToken(stored.id, client);

        // Outra requisição chegou primeiro e já rotacionou este token.
        if (!consumed) {
            throw unauthorized('Sessão inválida. Faça login novamente.', 'INVALID_REFRESH_TOKEN');
        }

        const newToken = generateRefreshToken();
        const expiresAt = new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRES_IN));

        await repo.insertRefreshToken(
            {
                userId: user.id,
                tokenHash: hashRefreshToken(newToken),
                // Mesma família: é a mesma linhagem de sessão do login original.
                familyId: stored.family_id,
                userAgent,
                expiresAt,
            },
            client,
        );

        return buildAuthResult(user, newToken, expiresAt);
    });
}

export async function logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;

    const stored = await repo.findRefreshTokenByHash(hashRefreshToken(rawToken));
    if (!stored) return;

    // Encerra a sessão inteira, não só o token atual.
    await repo.revokeTokenFamily(stored.family_id);
}

export async function getProfile(userId: string): Promise<repo.PublicUser> {
    const user = await repo.findUserById(userId);

    if (!user) {
        throw unauthorized('Sessão inválida.', 'INVALID_TOKEN');
    }

    return repo.toPublicUser(user);
}
