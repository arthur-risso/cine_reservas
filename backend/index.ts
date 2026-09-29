// O tsconfig só inclui `src/`; compilando a partir deste arquivo, o builder
// do Vercel não veria a declaração de `req.user` e acusaria erro de tipo.
/// <reference path="./src/types/express.d.ts" />
import { createApp } from './src/app';

/**
 * Entrada do deploy no Vercel.
 *
 * O Vercel procura um `index.ts` na raiz do projeto e usa o app exportado
 * como handler de uma função. Não dá para reaproveitar `src/server.ts`: ele
 * ocupa uma porta, liga os jobs em setInterval e trata SIGTERM — tudo coisa
 * de processo contínuo, que numa função congelada entre requisições não roda
 * (os jobs viram Vercel Cron, ver vercel.json).
 *
 * Fica fora de `src/` de propósito: se ficasse em `src/index.ts`, o Vercel
 * poderia escolher `src/app.ts` antes dele, que não tem export default.
 */
export default createApp();
