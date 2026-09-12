import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Validação das variáveis de ambiente no boot.
 *
 * Por que validar aqui? Porque um `process.env.JWT_SECRET` indefinido não
 * quebra na hora — ele quebra em produção, na primeira tentativa de login,
 * ou pior: assina token com `undefined` e passa despercebido. Validando no
 * boot, a aplicação simplesmente não sobe com configuração errada.
 */
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3333),

    DATABASE_URL: z.string().url('DATABASE_URL precisa ser uma URL de conexão válida'),

    JWT_ACCESS_SECRET: z
        .string()
        .min(32, 'JWT_ACCESS_SECRET precisa ter ao menos 32 caracteres'),
    JWT_REFRESH_SECRET: z
        .string()
        .min(32, 'JWT_REFRESH_SECRET precisa ter ao menos 32 caracteres'),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    CORS_ORIGIN: z.string().default('http://localhost:5173'),

    /** Minutos que uma reserva PENDING segura as poltronas antes de expirar. */
    RESERVATION_HOLD_MINUTES: z.coerce.number().int().positive().default(10),
    /** Máximo de poltronas por reserva — regra de negócio comum em cinemas. */
    MAX_SEATS_PER_RESERVATION: z.coerce.number().int().positive().default(6),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    const detalhes = parsed.error.issues
        .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n');

    console.error(`\nConfiguração inválida no .env:\n${detalhes}\n`);
    process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
