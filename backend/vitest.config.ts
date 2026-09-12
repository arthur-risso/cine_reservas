import { defineConfig } from 'vitest/config';

const TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ??
    'postgresql://cinema_user:cinema_pass@localhost:5433/cinema_test';

export default defineConfig({
    test: {
        /**
         * Banco separado do de desenvolvimento.
         *
         * Os testes começam com TRUNCATE em todas as tabelas — apontar para
         * o banco de dev apagaria o seed a cada execução. Como o dotenv não
         * sobrescreve variáveis já definidas, o valor daqui vence o do .env.
         */
        env: {
            NODE_ENV: 'test',
            DATABASE_URL: TEST_DATABASE_URL,
        },
        environment: 'node',
        globals: false,
        // Os testes compartilham um único banco: rodar arquivos em paralelo
        // faria um limpar as tabelas enquanto o outro lê. Em um projeto maior
        // o caminho seria um banco por worker; aqui, sequencial resolve.
        fileParallelism: false,
        include: ['tests/**/*.test.ts'],
        testTimeout: 20_000,
        hookTimeout: 30_000,
    },
});
