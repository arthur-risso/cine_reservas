import { Router, type Request, type Response } from 'express';
import { openApiSpec } from './openapi';

export const docsRoutes = Router();

docsRoutes.get('/', (_req: Request, res: Response) => {
    res.json(openApiSpec);
});

/**
 * Página interativa da documentação.
 *
 * Servida via CDN em vez de instalar `swagger-ui-express`: essa dependência
 * traz alguns megabytes de assets estáticos para dentro do bundle do
 * servidor, e a documentação não é caminho crítico da aplicação.
 *
 * A CSP do helmet bloquearia scripts externos, então esta rota declara a
 * própria política — restrita ao domínio do Swagger e a mais nada.
 */
docsRoutes.get('/ui', (_req: Request, res: Response) => {
    res.setHeader(
        'Content-Security-Policy',
        [
            "default-src 'self'",
            "script-src 'self' https://unpkg.com 'unsafe-inline'",
            "style-src 'self' https://unpkg.com 'unsafe-inline'",
            "img-src 'self' data:",
            "connect-src 'self'",
        ].join('; '),
    );

    res.type('html').send(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Cine Aurora — Documentação da API</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
  <style>body { margin: 0; background: #fafafa; }</style>
</head>
<body>
  <div id="swagger"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '/api/docs',
      dom_id: '#swagger',
      docExpansion: 'list',
      defaultModelsExpandDepth: 0,
      persistAuthorization: true,
    });
  </script>
</body>
</html>`);
});
