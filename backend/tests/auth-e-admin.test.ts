import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { query } from '../src/db';
import {
    app,
    closeDatabase,
    createFixture,
    createUser,
    request,
    resetDatabase,
    type Fixture,
    type TestUser,
} from './helpers';

/**
 * `afterAll` no nível do ARQUIVO, não dentro de cada describe.
 *
 * Dentro de um describe, ele roda ao fim daquele bloco — e fecharia o pool
 * de conexões antes dos describes seguintes, que então falhariam com
 * "Cannot use a pool after calling end on the pool".
 */
afterAll(closeDatabase);

describe('Autenticação', () => {
    beforeEach(resetDatabase);

    it('cadastra e devolve token + cookie httpOnly de refresh', async () => {
        const response = await request(app).post('/api/auth/register').send({
            name: 'Maria Silva',
            email: 'maria@teste.dev',
            password: 'Senha12345',
        });

        expect(response.status).toBe(201);
        expect(response.body.accessToken).toBeTruthy();
        expect(response.body.user.role).toBe('CLIENT');
        // A senha nunca pode voltar na resposta, nem como hash.
        expect(response.body.user.password_hash).toBeUndefined();

        const cookies = response.headers['set-cookie'] as unknown as string[];
        const refreshCookie = cookies.find((cookie) => cookie.startsWith('cinema_refresh='));

        expect(refreshCookie).toBeDefined();
        expect(refreshCookie).toContain('HttpOnly');
        expect(refreshCookie).toContain('SameSite=Strict');
    });

    it('não deixa o cadastro criar um administrador', async () => {
        // Mass assignment: o zod descarta `role` porque ele não está no schema.
        const response = await request(app).post('/api/auth/register').send({
            name: 'Invasor',
            email: 'invasor@teste.dev',
            password: 'Senha12345',
            role: 'ADMIN',
        });

        expect(response.status).toBe(201);
        expect(response.body.user.role).toBe('CLIENT');
    });

    it('recusa senha fraca', async () => {
        const response = await request(app).post('/api/auth/register').send({
            name: 'Fraco',
            email: 'fraco@teste.dev',
            password: 'abc',
        });

        expect(response.status).toBe(422);
        expect(response.body.details.password).toBeTruthy();
    });

    it('recusa e-mail duplicado', async () => {
        await createUser('duplicado@teste.dev');

        const response = await request(app).post('/api/auth/register').send({
            name: 'Outro',
            email: 'duplicado@teste.dev',
            password: 'Senha12345',
        });

        expect(response.status).toBe(409);
        expect(response.body.code).toBe('EMAIL_IN_USE');
    });

    it('usa a mesma mensagem para e-mail inexistente e senha errada', async () => {
        await createUser('existe@teste.dev');

        const wrongPassword = await request(app)
            .post('/api/auth/login')
            .send({ email: 'existe@teste.dev', password: 'SenhaErrada1' });

        const noUser = await request(app)
            .post('/api/auth/login')
            .send({ email: 'naoexiste@teste.dev', password: 'SenhaErrada1' });

        // Mensagens idênticas: não dá para descobrir quais e-mails existem.
        expect(wrongPassword.status).toBe(401);
        expect(noUser.status).toBe(401);
        expect(wrongPassword.body.message).toBe(noUser.body.message);
    });

    it('rotaciona o refresh token e derruba a sessão se o antigo for reusado', async () => {
        const login = await request(app)
            .post('/api/auth/login')
            .send({ email: (await createUser('rotacao@teste.dev')).email, password: 'Senha@12345' });

        const originalCookie = (login.headers['set-cookie'] as unknown as string[])[0]!;

        const firstRefresh = await request(app).post('/api/auth/refresh').set('Cookie', originalCookie);
        expect(firstRefresh.status).toBe(200);

        // Reapresentar o token já usado é sinal de roubo.
        const reuse = await request(app).post('/api/auth/refresh').set('Cookie', originalCookie);
        expect(reuse.status).toBe(401);
        expect(reuse.body.code).toBe('REFRESH_TOKEN_REUSED');

        // E a família inteira foi revogada — nem o token novo vale mais.
        const newCookie = (firstRefresh.headers['set-cookie'] as unknown as string[])[0]!;
        const afterBreach = await request(app).post('/api/auth/refresh').set('Cookie', newCookie);
        expect(afterBreach.status).toBe(401);
    });
});

describe('Autorização e regras de administração', () => {
    let client: TestUser;
    let admin: TestUser;
    let fixture: Fixture;

    beforeEach(async () => {
        await resetDatabase();
        client = await createUser('cliente@teste.dev');
        admin = await createUser('admin@teste.dev', 'ADMIN');
        fixture = await createFixture();
    });

    const novoFilme = {
        title: 'Filme Novo',
        synopsis: 'Sinopse com tamanho suficiente para passar na validação.',
        durationMin: 110,
        genres: ['Drama'],
        ageRating: '12',
    };

    it('bloqueia cliente comum no CRUD de filmes', async () => {
        const response = await request(app)
            .post('/api/movies')
            .set('Authorization', `Bearer ${client.token}`)
            .send(novoFilme);

        expect(response.status).toBe(403);
        expect(response.body.code).toBe('FORBIDDEN');
    });

    it('bloqueia requisição sem token', async () => {
        const response = await request(app).post('/api/movies').send(novoFilme);
        expect(response.status).toBe(401);
    });

    it('permite que o admin crie filme', async () => {
        const response = await request(app)
            .post('/api/movies')
            .set('Authorization', `Bearer ${admin.token}`)
            .send(novoFilme);

        expect(response.status).toBe(201);
        expect(response.body.data.title).toBe('Filme Novo');
    });

    /**
     * Sobreposição de sessões na mesma sala.
     *
     * Quem garante isso é a constraint EXCLUDE do Postgres, não um SELECT
     * de verificação — por isso vale ter o teste: ele prova que a proteção
     * está mesmo ligada no banco.
     */
    it('recusa duas sessões sobrepostas na mesma sala', async () => {
        // +6h: bem depois da sessão que o fixture já criou (+2h, 125 min).
        const startsAt = new Date(Date.now() + 6 * 60 * 60 * 1000);

        const first = await request(app)
            .post('/api/showtimes')
            .set('Authorization', `Bearer ${admin.token}`)
            .send({
                movieId: fixture.movieId,
                roomId: fixture.roomId,
                startsAt: startsAt.toISOString(),
                basePrice: 30,
            });
        expect(first.status).toBe(201);

        // 30 minutos depois: o filme de 100 min ainda está passando.
        const overlapping = await request(app)
            .post('/api/showtimes')
            .set('Authorization', `Bearer ${admin.token}`)
            .send({
                movieId: fixture.movieId,
                roomId: fixture.roomId,
                startsAt: new Date(startsAt.getTime() + 30 * 60_000).toISOString(),
                basePrice: 30,
            });

        expect(overlapping.status).toBe(409);
        expect(overlapping.body.code).toBe('SHOWTIME_OVERLAP');
    });

    it('aceita sessão que começa depois do fim da anterior', async () => {
        const startsAt = new Date(Date.now() + 6 * 60 * 60 * 1000);

        await request(app)
            .post('/api/showtimes')
            .set('Authorization', `Bearer ${admin.token}`)
            .send({
                movieId: fixture.movieId,
                roomId: fixture.roomId,
                startsAt: startsAt.toISOString(),
                basePrice: 30,
            });

        // 100 min de filme + 25 de intervalo = 125. Começando em 130, cabe.
        const next = await request(app)
            .post('/api/showtimes')
            .set('Authorization', `Bearer ${admin.token}`)
            .send({
                movieId: fixture.movieId,
                roomId: fixture.roomId,
                startsAt: new Date(startsAt.getTime() + 130 * 60_000).toISOString(),
                basePrice: 30,
            });

        expect(next.status).toBe(201);
    });

    it('recusa sessão no passado', async () => {
        const response = await request(app)
            .post('/api/showtimes')
            .set('Authorization', `Bearer ${admin.token}`)
            .send({
                movieId: fixture.movieId,
                roomId: fixture.roomId,
                startsAt: new Date(Date.now() - 60 * 60_000).toISOString(),
                basePrice: 30,
            });

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('SHOWTIME_IN_PAST');
    });

    it('impede tirar de cartaz um filme com sessão futura', async () => {
        const response = await request(app)
            .delete(`/api/movies/${fixture.movieId}`)
            .set('Authorization', `Bearer ${admin.token}`);

        expect(response.status).toBe(409);
        expect(response.body.code).toBe('MOVIE_HAS_SHOWTIMES');
    });

    it('gera o mapa de poltronas ao criar uma sala', async () => {
        const response = await request(app)
            .post('/api/rooms')
            .set('Authorization', `Bearer ${admin.token}`)
            .send({ name: 'Sala Gerada', rowsCount: 5, seatsPerRow: 10 });

        expect(response.status).toBe(201);
        expect(response.body.data.seatSummary.total).toBe(50);

        const seats = await query('SELECT id FROM seats WHERE room_id = $1', [response.body.data.id]);
        expect(seats).toHaveLength(50);
    });
});

describe('Busca e filtros', () => {
    let admin: TestUser;

    beforeEach(async () => {
        await resetDatabase();
        admin = await createUser('admin@teste.dev', 'ADMIN');

        await request(app)
            .post('/api/movies')
            .set('Authorization', `Bearer ${admin.token}`)
            .send({
                title: 'A Viagem Espacial',
                synopsis: 'Uma missão tripulada encontra alienígenas em Júpiter.',
                durationMin: 120,
                genres: ['Ficção Científica'],
                ageRating: '12',
                director: 'Ana Ribeiro',
            });
    });

    it('encontra o filme mesmo sem acento no termo buscado', async () => {
        const response = await request(app).get('/api/movies?q=alienigenas&onlyShowing=false');

        expect(response.status).toBe(200);
        expect(response.body.meta.total).toBe(1);
    });

    it('encontra por gênero digitado sem acento', async () => {
        const response = await request(app).get('/api/movies?q=ficcao&onlyShowing=false');
        expect(response.body.meta.total).toBe(1);
    });

    it('encontra por diretor', async () => {
        const response = await request(app).get('/api/movies?q=ribeiro&onlyShowing=false');
        expect(response.body.meta.total).toBe(1);
    });

    it('não devolve nada para termo sem correspondência', async () => {
        const response = await request(app).get('/api/movies?q=jacare&onlyShowing=false');
        expect(response.body.meta.total).toBe(0);
    });

    it('limita o tamanho da página para evitar abuso', async () => {
        const response = await request(app).get('/api/movies?limit=100000');

        expect(response.status).toBe(422);
        expect(response.body.code).toBe('VALIDATION_ERROR');
    });
});
