import { z } from 'zod';

/**
 * Regras de senha: comprimento pesa muito mais que "caractere especial".
 *
 * Exigir @ e maiúscula empurra o usuário para "Senha@1" — curta e previsível.
 * Aqui o mínimo é 8 com pelo menos uma letra e um número, e o limite de 72
 * existe porque o bcrypt trunca silenciosamente acima disso (se aceitássemos
 * mais, os caracteres extras não seriam verificados de fato).
 */
const passwordSchema = z
    .string()
    .min(8, 'A senha precisa ter ao menos 8 caracteres.')
    .max(72, 'A senha pode ter no máximo 72 caracteres.')
    .regex(/[A-Za-zÀ-ÿ]/, 'A senha precisa conter ao menos uma letra.')
    .regex(/\d/, 'A senha precisa conter ao menos um número.');

const emailSchema = z
    .string()
    .trim()
    .toLowerCase()
    .email('Informe um e-mail válido.')
    .max(180, 'E-mail muito longo.');

export const registerSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, 'Informe seu nome.')
        .max(120, 'Nome muito longo.'),
    email: emailSchema,
    password: passwordSchema,
    // `role` não está aqui de propósito: o zod descarta o que não é declarado,
    // então ninguém vira ADMIN mandando {"role":"ADMIN"} no cadastro.
});

export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Informe sua senha.').max(72),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
