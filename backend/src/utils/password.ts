import bcrypt from 'bcrypt';

/**
 * Custo 12: cada verificação leva ~250ms em hardware atual.
 *
 * Parece lento de propósito — e é. Esse é o ponto: torna força bruta
 * inviável (um atacante testa ~4 senhas/s por núcleo em vez de milhões).
 * Abaixo de 10 hoje é fraco; acima de 14 o login começa a incomodar.
 */
const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
}

/**
 * Hash descartável usado quando o e-mail do login não existe.
 *
 * Sem isso, "e-mail inexistente" responde na hora e "senha errada" responde
 * em 250ms — a diferença de tempo revela quais e-mails estão cadastrados
 * (user enumeration). Gastando o mesmo tempo nos dois casos, o atacante não
 * consegue distinguir.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.eDSMhlqZFcXFbD/PHHFT9dxsrM4Bd6O';

export async function fakeVerify(): Promise<void> {
    await bcrypt.compare('senha-que-nao-existe', DUMMY_HASH);
}
