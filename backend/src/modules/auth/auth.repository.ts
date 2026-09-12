import { query, queryOne, type Queryable } from '../../db';
import type { UserRole } from '../../utils/tokens';

export interface UserRow {
    id: string;
    name: string;
    email: string;
    password_hash: string;
    role: UserRole;
    is_active: boolean;
    created_at: Date;
}

export interface RefreshTokenRow {
    id: string;
    user_id: string;
    token_hash: string;
    family_id: string;
    expires_at: Date;
    revoked_at: Date | null;
}

export type PublicUser = Pick<UserRow, 'id' | 'name' | 'email' | 'role' | 'created_at'>;

export function toPublicUser(user: UserRow): PublicUser {
    // Nunca devolver password_hash: mesmo sendo hash, é material para
    // ataque offline se vazar em uma resposta JSON.
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
    };
}

export function findUserByEmail(email: string): Promise<UserRow | null> {
    return queryOne<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
}

export function findUserById(id: string): Promise<UserRow | null> {
    return queryOne<UserRow>('SELECT * FROM users WHERE id = $1 AND is_active', [id]);
}

export async function insertUser(
    name: string,
    email: string,
    passwordHash: string,
): Promise<UserRow> {
    const rows = await query<UserRow>(
        `INSERT INTO users (name, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name, email, passwordHash],
    );

    return rows[0]!;
}

export async function insertRefreshToken(
    params: {
        userId: string;
        tokenHash: string;
        familyId: string;
        userAgent: string | null;
        expiresAt: Date;
    },
    executor?: Queryable,
): Promise<void> {
    await query(
        `INSERT INTO refresh_tokens (user_id, token_hash, family_id, user_agent, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [
            params.userId,
            params.tokenHash,
            params.familyId,
            params.userAgent?.slice(0, 255) ?? null,
            params.expiresAt,
        ],
        executor,
    );
}

export function findRefreshTokenByHash(
    tokenHash: string,
    executor?: Queryable,
): Promise<RefreshTokenRow | null> {
    return queryOne<RefreshTokenRow>(
        'SELECT * FROM refresh_tokens WHERE token_hash = $1',
        [tokenHash],
        executor,
    );
}

/**
 * Consome o token: revoga apenas se ainda estiver válido.
 *
 * A condição `revoked_at IS NULL` está no WHERE, e não em um `if` antes —
 * é ela que serializa dois refresh simultâneos (duas abas do navegador
 * renovando ao mesmo tempo). O primeiro atualiza a linha; o segundo não
 * encontra linha na condição e recebe `false`, em vez de os dois emitirem
 * tokens válidos a partir do mesmo pai.
 */
export async function consumeRefreshToken(id: string, executor?: Queryable): Promise<boolean> {
    const rows = await query<{ id: string }>(
        'UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL RETURNING id',
        [id],
        executor,
    );
    return rows.length > 0;
}

/**
 * Revoga a família inteira de tokens.
 *
 * Acionado quando um refresh token já usado reaparece: ou o usuário está com
 * uma cópia antiga, ou alguém roubou o token. Como não há como distinguir,
 * a resposta segura é derrubar todas as sessões daquela linhagem e obrigar
 * um login novo.
 */
export async function revokeTokenFamily(familyId: string, executor?: Queryable): Promise<void> {
    await query(
        'UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL',
        [familyId],
        executor,
    );
}

export async function deleteExpiredRefreshTokens(): Promise<number> {
    const rows = await query<{ id: string }>(
        'DELETE FROM refresh_tokens WHERE expires_at < now() RETURNING id',
    );
    return rows.length;
}
