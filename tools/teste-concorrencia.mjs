/**
 * Teste de corrida na reserva de poltronas.
 *
 * Dispara N requisições SIMULTÂNEAS tentando reservar exatamente a mesma
 * poltrona da mesma sessão. O resultado correto é sempre o mesmo:
 * exatamente 1 sucesso (201) e N-1 conflitos (409).
 *
 * É o único teste que prova que o sistema não vende o mesmo lugar duas
 * vezes. Um teste sequencial passaria mesmo com o código errado, porque o
 * bug só aparece quando duas transações se cruzam no mesmo instante.
 *
 * Uso: node tools/teste-concorrencia.mjs [quantidade]
 */

const API = process.env.API_URL ?? 'http://localhost:3333';
const ATTEMPTS = Number(process.argv[2] ?? 20);

const login = async (email, password) => {
    const response = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        throw new Error(`Falha no login (${response.status}): ${await response.text()}`);
    }

    const { accessToken } = await response.json();
    return accessToken;
};

const json = async (url, token) => {
    const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return response.json();
};

console.log(`Alvo: ${API}\n`);

const token = await login('cliente@cinema.dev', 'Cliente@12345');

// Pega a primeira sessão futura com lugares livres.
const { data: showtimes } = await json(`${API}/api/showtimes?limit=1`);
const showtime = showtimes[0];

if (!showtime) {
    console.error('Nenhuma sessão futura encontrada. Rode o seed primeiro.');
    process.exit(1);
}

const { data: seatMap } = await json(`${API}/api/showtimes/${showtime.id}/seats`, token);
const target = seatMap.rows.flatMap((row) => row.seats).find((seat) => seat.status === 'AVAILABLE');

if (!target) {
    console.error('A sessão escolhida está lotada.');
    process.exit(1);
}

console.log(`Sessão ..... ${showtime.movie.title} — ${showtime.room.name}`);
console.log(`Horário .... ${new Date(showtime.startsAt).toLocaleString('pt-BR')}`);
console.log(`Poltrona ... ${target.label} (${target.tier}) — R$ ${target.price.toFixed(2)}`);
console.log(`Disparando ${ATTEMPTS} reservas simultâneas...\n`);

const startedAt = Date.now();

/**
 * Promise.all dispara tudo junto: as requisições saem sem esperar a
 * anterior, que é exatamente a condição em que o bug de overbooking
 * apareceria.
 */
const results = await Promise.all(
    Array.from({ length: ATTEMPTS }, async (_, index) => {
        const response = await fetch(`${API}/api/reservations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                showtimeId: showtime.id,
                seats: [{ seatId: target.id, ticketKind: 'FULL' }],
            }),
        });

        const body = await response.json().catch(() => ({}));
        return { index, status: response.status, code: body.code, message: body.message };
    }),
);

const elapsed = Date.now() - startedAt;
const created = results.filter((result) => result.status === 201);
const conflicts = results.filter((result) => result.status === 409);
// 429 também é uma rejeição legítima: o rate limit por usuário entra em
// ação antes do banco. O que não pode existir é um segundo 201.
const throttled = results.filter((result) => result.status === 429);
const others = results.filter(
    (result) => ![201, 409, 429].includes(result.status),
);

console.log(`Tempo total ....... ${elapsed}ms`);
console.log(`Criadas (201) ..... ${created.length}`);
console.log(`Conflitos (409) ... ${conflicts.length}   ${[...new Set(conflicts.map((c) => c.code))].join(', ')}`);
console.log(`Rate limit (429) .. ${throttled.length}`);

if (others.length > 0) {
    console.log(`Outros ............ ${others.length}`);
    for (const result of others.slice(0, 5)) {
        console.log(`   ${result.status} ${result.code ?? ''} ${result.message ?? ''}`);
    }
}

console.log('');

if (created.length === 1 && others.length === 0) {
    console.log('APROVADO: exatamente uma reserva venceu a disputa. Sem overbooking.');
    process.exit(0);
}

if (others.length > 0) {
    console.log(`REPROVADO: ${others.length} resposta(s) inesperada(s).`);
} else {
    console.log(`REPROVADO: esperado exatamente 1 sucesso, obtido ${created.length}.`);
}
process.exit(1);
