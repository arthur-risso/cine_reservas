# Notas para trabalhar neste repositório

Plataforma de reservas de cinema. Backend Express + TypeScript com PostgreSQL em SQL puro;
frontend React 19 + Vite + Tailwind v4. Tudo em português — código, comentários e interface.

## Comandos

```bash
docker compose up -d                 # Postgres (host: porta 5433) + Adminer

cd backend
npm run dev                          # API com hot reload em :3333
npm run migrate:up | migrate:down    # schema
npm run seed                         # recria o catálogo de demonstração
npm test                             # Vitest + Supertest (usa o banco cinema_test)

cd frontend
npm run dev                          # :5173
npm run build                        # checagem de tipos + build de produção
```

O banco de testes é separado (`cinema_test`, criado por `docker/postgres-init` na primeira
subida do volume) e precisa das migrations aplicadas: `npm run migrate:test`.

## Invariantes — não quebrar

1. **Poltrona não pode ser vendida duas vezes.** Garantido pelo índice único parcial
   `reservation_seats_assento_ocupado_idx`, não por validação em JavaScript. Qualquer
   mudança em `reservations.repository.ts` precisa manter o `ORDER BY s.id` no INSERT
   das poltronas — é ele que evita deadlock entre transações concorrentes.

2. **Preço é calculado no banco.** Nunca aceitar valor monetário vindo do cliente.

3. **Sessões não se sobrepõem na mesma sala.** Constraint `showtimes_sem_sobreposicao`.
   `ends_at` é sempre derivado da duração do filme, nunca informado pelo admin.

4. **Reserva pendente vencida não ocupa lugar.** Toda leitura de disponibilidade compara
   `expires_at` com `now()`. O job de expiração é limpeza, não é a garantia.

5. **RBAC no servidor.** Esconder botão no React é usabilidade. A proteção é
   `requireRole('ADMIN')` na rota.

## Convenções

- Módulo do backend = `routes` → `controller` → `service` → `repository` + `schema` (zod).
  Regra de negócio no service; SQL só no repository.
- Banco em `snake_case`, API em `camelCase`. A tradução acontece nos mapeadores do service.
- Todo handler async passa por `asyncHandler` — o Express 4 não captura rejeição de Promise.
- Erros de negócio: lançar `AppError` (ou os atalhos `conflict`, `notFound`…). O
  `errorHandler` traduz códigos SQLSTATE do Postgres em respostas HTTP — ao adicionar uma
  constraint nova, mapear o `constraint` name lá.
- Filtros opcionais em SQL: `($n::tipo IS NULL OR condição)`, nunca concatenação de string.
- No frontend, estado de filtro vive na URL (`useSearchParams`), não em `useState`.
- Cores e espaçamentos saem dos tokens em `frontend/src/index.css` (`@theme`), não de
  valores arbitrários no meio do JSX.

## Comentários

O código é comentado para ensinar: os comentários explicam **por que** a decisão foi tomada
e o que aconteceria sem ela, não o que a linha faz. Manter esse padrão ao editar.
