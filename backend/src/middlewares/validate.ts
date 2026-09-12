import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { AppError } from '../utils/AppError';

interface ValidationSchemas {
    body?: ZodTypeAny;
    query?: ZodTypeAny;
    params?: ZodTypeAny;
}

/**
 * Valida body, query e params com zod ANTES do controller rodar.
 *
 * Duas consequências que valem mais do que parecem:
 *
 * 1. Segurança — nada não declarado no schema chega ao service. Um cliente
 *    que mande `{ "email": "x", "role": "ADMIN" }` no cadastro tem o `role`
 *    descartado pelo zod, porque o schema não o inclui (mass assignment).
 *
 * 2. Tipagem real — depois deste middleware, `req.body` tem exatamente o
 *    formato do schema. O controller para de checar `if (!req.body.email)`.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
    return (req: Request, _res: Response, next: NextFunction) => {
        try {
            if (schemas.params) {
                req.params = schemas.params.parse(req.params);
            }
            if (schemas.query) {
                // No Express 4 `req.query` é gravável; o valor convertido
                // (números, datas, defaults) substitui as strings cruas.
                req.query = schemas.query.parse(req.query);
            }
            if (schemas.body) {
                req.body = schemas.body.parse(req.body);
            }

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                // Formato estável para o frontend marcar o campo errado
                // no formulário: { campo: "mensagem" }.
                const fields: Record<string, string> = {};

                for (const issue of error.issues) {
                    const path = issue.path.join('.') || 'body';
                    if (!fields[path]) {
                        fields[path] = issue.message;
                    }
                }

                next(new AppError(422, 'Dados inválidos.', 'VALIDATION_ERROR', fields));
                return;
            }

            next(error);
        }
    };
}
