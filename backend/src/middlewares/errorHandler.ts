import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { isProduction } from '../config/env';

/** Erro do driver do Postgres: traz `code` (SQLSTATE) e `constraint`. */
interface PostgresError extends Error {
    code?: string;
    constraint?: string;
    detail?: string;
}

/**
 * Traduz violações de constraint em respostas HTTP com sentido.
 *
 * Aqui está a virada de chave do projeto: as regras críticas vivem no banco
 * (índice único parcial de poltrona, EXCLUDE de sessões sobrepostas), então
 * o caminho normal sob concorrência é o banco recusar. Este mapeamento é o
 * que transforma essa recusa em "essa poltrona acabou de ser reservada" em
 * vez de um 500 feio.
 */
function mapPostgresError(error: PostgresError): AppError | null {
    switch (error.code) {
        case '23505': // unique_violation
            if (error.constraint === 'reservation_seats_assento_ocupado_idx') {
                return new AppError(
                    409,
                    'Uma das poltronas escolhidas acabou de ser reservada. Atualize o mapa e escolha outra.',
                    'SEAT_TAKEN',
                );
            }
            if (error.constraint === 'users_email_key') {
                return new AppError(409, 'Este e-mail já está cadastrado.', 'EMAIL_IN_USE');
            }
            if (error.constraint === 'rooms_name_key') {
                return new AppError(409, 'Já existe uma sala com este nome.', 'ROOM_NAME_IN_USE');
            }
            if (error.constraint === 'seats_posicao_unica') {
                return new AppError(409, 'Esta poltrona já existe na sala.', 'SEAT_DUPLICATED');
            }
            return new AppError(409, 'Registro duplicado.', 'DUPLICATE');

        case '23P01': // exclusion_violation
            if (error.constraint === 'showtimes_sem_sobreposicao') {
                return new AppError(
                    409,
                    'Esta sala já tem outra sessão neste horário.',
                    'SHOWTIME_OVERLAP',
                );
            }
            return new AppError(409, 'Conflito de horários.', 'EXCLUSION_CONFLICT');

        case '23503': // foreign_key_violation
            return new AppError(
                409,
                'Não é possível concluir: existe outro registro dependendo deste.',
                'FOREIGN_KEY_CONFLICT',
            );

        case '23514': // check_violation
            return new AppError(422, 'Dados fora das regras do sistema.', 'CHECK_VIOLATION');

        case '22P02': // invalid_text_representation (ex.: uuid malformado)
            return new AppError(400, 'Identificador inválido.', 'INVALID_INPUT');

        case '40001': // serialization_failure
        case '40P01': // deadlock_detected
            return new AppError(
                409,
                'Conflito de concorrência. Tente novamente.',
                'CONCURRENCY_CONFLICT',
            );

        default:
            return null;
    }
}

export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    // O Express só reconhece um middleware como tratador de erro se ele
    // declarar 4 parâmetros — por isso `_next` fica aqui mesmo sem uso.
    _next: NextFunction,
): void {
    const appError = err instanceof AppError ? err : mapPostgresError(err as PostgresError);

    if (appError) {
        res.status(appError.statusCode).json({
            message: appError.message,
            code: appError.code,
            ...(appError.details ? { details: appError.details } : {}),
        });
        return;
    }

    // Daqui para baixo é erro inesperado: registra tudo no servidor...
    console.error(`[erro] ${req.method} ${req.originalUrl}`, err);

    // ...e devolve o mínimo ao cliente. Stack trace em resposta HTTP entrega
    // caminhos de arquivo, versões de biblioteca e estrutura interna —
    // material de reconhecimento para quem está sondando a aplicação.
    res.status(500).json({
        message: 'Erro interno do servidor.',
        code: 'INTERNAL_ERROR',
        ...(isProduction ? {} : { debug: err.message }),
    });
}

export function notFoundHandler(req: Request, res: Response): void {
    res.status(404).json({
        message: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
        code: 'ROUTE_NOT_FOUND',
    });
}
