/**
 * Erro de negócio, com status HTTP e código estável.
 *
 * A diferença para um `throw new Error()` solto: o errorHandler sabe que
 * este erro é esperado e pode mostrar a mensagem ao usuário. Qualquer outro
 * erro vira 500 genérico, sem vazar detalhes internos. O `code` é o que o
 * frontend consulta para reagir (ex.: `SEAT_TAKEN` recarrega o mapa).
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly details?: unknown;

    constructor(statusCode: number, message: string, code: string, details?: unknown) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Error.captureStackTrace(this, AppError);
    }
}

export const badRequest = (message: string, code = 'BAD_REQUEST', details?: unknown) =>
    new AppError(400, message, code, details);

export const unauthorized = (message = 'Autenticação necessária.', code = 'UNAUTHORIZED') =>
    new AppError(401, message, code);

export const forbidden = (message = 'Você não tem permissão para esta ação.', code = 'FORBIDDEN') =>
    new AppError(403, message, code);

export const notFound = (message = 'Recurso não encontrado.', code = 'NOT_FOUND') =>
    new AppError(404, message, code);

export const conflict = (message: string, code = 'CONFLICT', details?: unknown) =>
    new AppError(409, message, code, details);

export const unprocessable = (message: string, code = 'UNPROCESSABLE', details?: unknown) =>
    new AppError(422, message, code, details);

export const tooManyRequests = (
    message = 'Muitas requisições. Tente novamente em instantes.',
    code = 'TOO_MANY_REQUESTS',
) => new AppError(429, message, code);
