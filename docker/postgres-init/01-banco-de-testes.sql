-- Executado pelo Postgres apenas na PRIMEIRA inicialização do volume.
-- Cria o banco usado por `npm test`, separado do banco de desenvolvimento:
-- os testes apagam todas as tabelas antes de cada caso, e rodá-los no banco
-- de dev destruiria o catálogo do seed.
CREATE DATABASE cinema_test;
