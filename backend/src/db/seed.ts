/* eslint-disable no-console */
import { pool, withTransaction } from './index';
import { isProduction } from '../config/env';
import { hashPassword } from '../utils/password';
import { generateSeatLayout } from '../modules/rooms/seatLayout';

/**
 * Popula o banco com um catálogo realista.
 *
 * Um app de reservas vazio é impossível de avaliar: não dá para ver o mapa
 * de poltronas, nem o calendário, nem testar filtro de busca. O seed garante
 * que `npm run dev` já abre com cinema funcionando.
 *
 * É idempotente: apaga o que existe e recria. Nunca rode em produção.
 */

interface MovieSeed {
    slug: string;
    title: string;
    originalTitle: string | null;
    synopsis: string;
    durationMin: number;
    genres: string[];
    ageRating: string;
    director: string;
    cast: string[];
    releaseDate: string;
}

const MOVIES: MovieSeed[] = [
    {
        slug: 'duna-parte-dois',
        title: 'Duna: Parte Dois',
        originalTitle: 'Dune: Part Two',
        synopsis:
            'Paul Atreides se une aos Fremen em uma guerra de vingança contra os conspiradores que destruíram sua família. Dividido entre o amor de sua vida e o destino do universo conhecido, ele luta para impedir um futuro terrível que só ele consegue prever.',
        durationMin: 166,
        genres: ['Ficção Científica', 'Aventura', 'Drama'],
        ageRating: '14',
        director: 'Denis Villeneuve',
        cast: ['Timothée Chalamet', 'Zendaya', 'Rebecca Ferguson', 'Javier Bardem'],
        releaseDate: '2024-02-29',
    },
    {
        slug: 'oppenheimer',
        title: 'Oppenheimer',
        originalTitle: 'Oppenheimer',
        synopsis:
            'A história do físico J. Robert Oppenheimer e seu papel no desenvolvimento da bomba atômica durante a Segunda Guerra Mundial, e o peso moral que carregou pelo resto da vida.',
        durationMin: 180,
        genres: ['Drama', 'História', 'Suspense'],
        ageRating: '14',
        director: 'Christopher Nolan',
        cast: ['Cillian Murphy', 'Emily Blunt', 'Robert Downey Jr.', 'Matt Damon'],
        releaseDate: '2023-07-20',
    },
    {
        slug: 'ainda-estou-aqui',
        title: 'Ainda Estou Aqui',
        originalTitle: null,
        synopsis:
            'Rio de Janeiro, 1971. Eunice Paiva tem a vida transformada quando o marido, o ex-deputado Rubens Paiva, é levado por agentes da ditadura militar e nunca mais volta. Ela então reinventa a própria vida para criar cinco filhos e buscar a verdade.',
        durationMin: 137,
        genres: ['Drama', 'História'],
        ageRating: '14',
        director: 'Walter Salles',
        cast: ['Fernanda Torres', 'Selton Mello', 'Fernanda Montenegro'],
        releaseDate: '2024-11-07',
    },
    {
        slug: 'interestelar',
        title: 'Interestelar',
        originalTitle: 'Interstellar',
        synopsis:
            'Com a Terra se tornando inabitável, um ex-piloto da NASA atravessa um buraco de minhoca em busca de um novo lar para a humanidade — sabendo que cada hora no outro lado pode custar anos ao lado da filha.',
        durationMin: 169,
        genres: ['Ficção Científica', 'Drama', 'Aventura'],
        ageRating: '10',
        director: 'Christopher Nolan',
        cast: ['Matthew McConaughey', 'Anne Hathaway', 'Jessica Chastain'],
        releaseDate: '2014-11-06',
    },
    {
        slug: 'parasita',
        title: 'Parasita',
        originalTitle: 'Gisaengchung',
        synopsis:
            'A família Kim, toda desempregada, se infiltra pouco a pouco na casa dos ricos Park. O plano funciona bem demais — até que um segredo no porão transforma a farsa em tragédia.',
        durationMin: 132,
        genres: ['Suspense', 'Drama', 'Comédia'],
        ageRating: '16',
        director: 'Bong Joon-ho',
        cast: ['Song Kang-ho', 'Lee Sun-kyun', 'Cho Yeo-jeong'],
        releaseDate: '2019-11-07',
    },
    {
        slug: 'cidade-de-deus',
        title: 'Cidade de Deus',
        originalTitle: null,
        synopsis:
            'Buscapé cresce em uma favela violenta do Rio de Janeiro e encontra na fotografia a chance de escapar do destino que consome seus amigos, enquanto Zé Pequeno transforma o bairro em um império do crime.',
        durationMin: 130,
        genres: ['Drama', 'Crime'],
        ageRating: '18',
        director: 'Fernando Meirelles',
        cast: ['Alexandre Rodrigues', 'Leandro Firmino', 'Matheus Nachtergaele'],
        releaseDate: '2002-08-30',
    },
    {
        slug: 'aranhaverso',
        title: 'Homem-Aranha: Através do Aranhaverso',
        originalTitle: 'Spider-Man: Across the Spider-Verse',
        synopsis:
            'Miles Morales é lançado através do multiverso e conhece uma equipe de Aranhas encarregada de proteger sua própria existência. Quando discorda de como enfrentar uma nova ameaça, ele decide desafiar todos eles.',
        durationMin: 140,
        genres: ['Animação', 'Ação', 'Aventura'],
        ageRating: '10',
        director: 'Joaquim Dos Santos',
        cast: ['Shameik Moore', 'Hailee Steinfeld', 'Oscar Isaac'],
        releaseDate: '2023-06-01',
    },
    {
        slug: 'bacurau',
        title: 'Bacurau',
        originalTitle: null,
        synopsis:
            'Após a morte da matriarca, os moradores de um pequeno povoado no sertão percebem que a cidade sumiu do mapa — literalmente — e que forasteiros armados chegaram à região.',
        durationMin: 131,
        genres: ['Suspense', 'Faroeste', 'Drama'],
        ageRating: '16',
        director: 'Kleber Mendonça Filho',
        cast: ['Sônia Braga', 'Udo Kier', 'Bárbara Colen', 'Thomás Aquino'],
        releaseDate: '2019-08-29',
    },
    {
        slug: 'tudo-em-todo-lugar',
        title: 'Tudo em Todo Lugar ao Mesmo Tempo',
        originalTitle: 'Everything Everywhere All at Once',
        synopsis:
            'Uma dona de lavanderia sobrecarregada com impostos e problemas de família descobre que precisa acessar versões alternativas de si mesma em outros universos para impedir o colapso de todos eles.',
        durationMin: 139,
        genres: ['Ficção Científica', 'Comédia', 'Ação'],
        ageRating: '14',
        director: 'Daniel Kwan',
        cast: ['Michelle Yeoh', 'Ke Huy Quan', 'Jamie Lee Curtis'],
        releaseDate: '2022-03-25',
    },
    {
        slug: 'a-chegada',
        title: 'A Chegada',
        originalTitle: 'Arrival',
        synopsis:
            'Doze naves alienígenas pousam ao redor do mundo e uma linguista é convocada para descobrir o que os visitantes querem — antes que o medo global transforme o primeiro contato em guerra.',
        durationMin: 116,
        genres: ['Ficção Científica', 'Drama', 'Suspense'],
        ageRating: '12',
        director: 'Denis Villeneuve',
        cast: ['Amy Adams', 'Jeremy Renner', 'Forest Whitaker'],
        releaseDate: '2016-11-10',
    },
    {
        slug: 'sociedade-do-anel',
        title: 'O Senhor dos Anéis: A Sociedade do Anel',
        originalTitle: 'The Lord of the Rings: The Fellowship of the Ring',
        synopsis:
            'Um hobbit herda um anel capaz de dominar a Terra-média e parte com oito companheiros em uma jornada para destruí-lo no único lugar onde isso é possível: as chamas da Montanha da Perdição.',
        durationMin: 178,
        genres: ['Fantasia', 'Aventura', 'Ação'],
        ageRating: '12',
        director: 'Peter Jackson',
        cast: ['Elijah Wood', 'Ian McKellen', 'Viggo Mortensen'],
        releaseDate: '2002-01-18',
    },
    {
        slug: 'pobres-criaturas',
        title: 'Pobres Criaturas',
        originalTitle: 'Poor Things',
        synopsis:
            'Trazida de volta à vida por um cientista pouco convencional, Bella Baxter foge com um advogado libertino para uma aventura pela Europa, decidida a aprender sobre o mundo sem pedir licença a ninguém.',
        durationMin: 141,
        genres: ['Comédia', 'Drama', 'Romance'],
        ageRating: '18',
        director: 'Yorgos Lanthimos',
        cast: ['Emma Stone', 'Mark Ruffalo', 'Willem Dafoe'],
        releaseDate: '2024-02-01',
    },
];

interface RoomSeed {
    name: string;
    technology: string;
    rowsCount: number;
    seatsPerRow: number;
    basePrice: number;
    formats: Array<'2D' | '3D' | 'IMAX' | '4DX'>;
}

const ROOMS: RoomSeed[] = [
    { name: 'Sala 1', technology: 'Padrão', rowsCount: 10, seatsPerRow: 14, basePrice: 28, formats: ['2D'] },
    { name: 'Sala 2', technology: '3D Dolby Atmos', rowsCount: 8, seatsPerRow: 12, basePrice: 36, formats: ['3D', '2D'] },
    { name: 'Sala 3', technology: 'IMAX Laser', rowsCount: 12, seatsPerRow: 18, basePrice: 48, formats: ['IMAX'] },
    { name: 'Sala 4', technology: '4DX Motion', rowsCount: 6, seatsPerRow: 8, basePrice: 54, formats: ['4DX', '3D'] },
];

/** Abertura e fechamento da programação diária. */
const FIRST_SESSION_HOUR = 13;
const LAST_SESSION_END_HOUR = 23.5;
/** Intervalo entre sessões: trailers, limpeza e troca de público. */
const TURNOVER_MINUTES = 25;

function atLocalTime(day: Date, hour: number, minute: number): Date {
    const result = new Date(day);
    result.setHours(hour, minute, 0, 0);
    return result;
}

function roundUpToFiveMinutes(date: Date): Date {
    const result = new Date(date);
    const remainder = result.getMinutes() % 5;
    if (remainder !== 0) {
        result.setMinutes(result.getMinutes() + (5 - remainder), 0, 0);
    }
    result.setSeconds(0, 0);
    return result;
}

/**
 * A senha do admin de demonstração está no README, que é público. Em
 * produção isso daria o painel administrativo a qualquer leitor do
 * repositório, então lá ela precisa vir de fora — e o seed se recusa a rodar
 * sem ela, em vez de cair silenciosamente no valor conhecido.
 */
function resolveAdminPassword(): string {
    const fromEnv = process.env.SEED_ADMIN_PASSWORD;

    if (isProduction && (!fromEnv || fromEnv.length < 16)) {
        throw new Error(
            'Em produção, defina SEED_ADMIN_PASSWORD (16+ caracteres). A senha padrão do admin é pública no README.',
        );
    }

    return fromEnv ?? 'Admin@12345';
}

async function seed(): Promise<void> {
    // Valida antes do TRUNCATE: falhar depois deixaria o banco vazio.
    const adminPassword = resolveAdminPassword();

    console.log('Limpando dados existentes...');

    await withTransaction(async (client) => {
        // TRUNCATE ... CASCADE respeita as FKs e reinicia tudo de uma vez.
        await client.query(
            'TRUNCATE reservation_seats, reservations, showtimes, seats, rooms, movies, refresh_tokens, users RESTART IDENTITY CASCADE',
        );
    });

    console.log('Criando usuários...');

    const [adminHash, clientHash] = await Promise.all([
        hashPassword(adminPassword),
        hashPassword('Cliente@12345'),
    ]);

    await withTransaction(async (client) => {
        await client.query(
            `INSERT INTO users (name, email, password_hash, role)
             VALUES ($1, $2, $3, 'ADMIN'), ($4, $5, $6, 'CLIENT')`,
            [
                'Administração do Cine Aurora',
                'admin@cinema.dev',
                adminHash,
                'Cliente Demonstração',
                'cliente@cinema.dev',
                clientHash,
            ],
        );
    });

    console.log('Criando filmes...');

    const movieIds = await withTransaction(async (client) => {
        const ids: string[] = [];

        for (const movie of MOVIES) {
            const { rows } = await client.query<{ id: string }>(
                `INSERT INTO movies
                    (title, original_title, synopsis, duration_min, genres, age_rating,
                     director, cast_names, poster_url, backdrop_url, release_date)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 RETURNING id`,
                [
                    movie.title,
                    movie.originalTitle,
                    movie.synopsis,
                    movie.durationMin,
                    movie.genres,
                    movie.ageRating,
                    movie.director,
                    movie.cast,
                    `/posters/${movie.slug}.svg`,
                    `/posters/${movie.slug}-wide.svg`,
                    movie.releaseDate,
                ],
            );
            ids.push(rows[0]!.id);
        }

        return ids;
    });

    console.log('Criando salas e poltronas...');

    const roomIds = await withTransaction(async (client) => {
        const ids: string[] = [];

        for (const room of ROOMS) {
            const { rows } = await client.query<{ id: string }>(
                `INSERT INTO rooms (name, technology, rows_count, seats_per_row)
                 VALUES ($1, $2, $3, $4) RETURNING id`,
                [room.name, room.technology, room.rowsCount, room.seatsPerRow],
            );

            const roomId = rows[0]!.id;
            ids.push(roomId);

            const seats = generateSeatLayout({
                rowsCount: room.rowsCount,
                seatsPerRow: room.seatsPerRow,
                // A sala 4DX é pequena e toda premium: nada de fileira normal.
                ...(room.name === 'Sala 4' ? { normalRatio: 0, semiVipRatio: 0.5 } : {}),
            });

            /**
             * Um único INSERT com UNNEST em vez de centenas de INSERTs.
             * São ~500 poltronas no total: em linha a linha seriam ~500
             * idas ao banco; aqui são 4. A diferença é de segundos para
             * milissegundos.
             */
            await client.query(
                `INSERT INTO seats (room_id, row_label, seat_number, tier, is_accessible)
                 SELECT $1, row_label, seat_number, tier::seat_tier, is_accessible
                 FROM UNNEST($2::text[], $3::int[], $4::text[], $5::boolean[])
                      AS t(row_label, seat_number, tier, is_accessible)`,
                [
                    roomId,
                    seats.map((s) => s.rowLabel),
                    seats.map((s) => s.seatNumber),
                    seats.map((s) => s.tier),
                    seats.map((s) => s.isAccessible),
                ],
            );
        }

        return ids;
    });

    console.log('Montando a programação dos próximos 14 dias...');

    const showtimeCount = await withTransaction(async (client) => {
        let created = 0;
        let movieCursor = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
            const day = new Date(today);
            day.setDate(day.getDate() + dayOffset);

            const weekday = day.getDay();
            const isWeekend = weekday === 0 || weekday === 5 || weekday === 6;

            for (let roomIndex = 0; roomIndex < ROOMS.length; roomIndex += 1) {
                const room = ROOMS[roomIndex]!;
                const roomId = roomIds[roomIndex]!;

                // Cada sala começa em um horário levemente diferente para as
                // sessões não saírem todas juntas (e a vitrine ficar variada).
                let cursor = atLocalTime(day, FIRST_SESSION_HOUR, roomIndex * 15);

                while (true) {
                    const movieIndex = movieCursor % MOVIES.length;
                    const movie = MOVIES[movieIndex]!;
                    const movieId = movieIds[movieIndex]!;
                    movieCursor += 1;

                    const startsAt = roundUpToFiveMinutes(cursor);
                    const endsAt = new Date(startsAt.getTime() + movie.durationMin * 60_000);

                    const endHour = endsAt.getHours() + endsAt.getMinutes() / 60;
                    if (endHour > LAST_SESSION_END_HOUR || endsAt.getDate() !== startsAt.getDate()) {
                        break;
                    }

                    const format = room.formats[created % room.formats.length]!;
                    const language = created % 3 === 0 ? 'DUBBED' : 'SUBTITLED';
                    // Fim de semana e sessões da noite custam mais caro.
                    const price =
                        room.basePrice * (isWeekend ? 1.25 : 1) * (startsAt.getHours() >= 18 ? 1.1 : 1);

                    await client.query(
                        `INSERT INTO showtimes
                            (movie_id, room_id, starts_at, ends_at, format, language, base_price)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [
                            movieId,
                            roomId,
                            startsAt.toISOString(),
                            endsAt.toISOString(),
                            format,
                            language,
                            Math.round(price * 100) / 100,
                        ],
                    );

                    created += 1;
                    cursor = new Date(endsAt.getTime() + TURNOVER_MINUTES * 60_000);
                }
            }
        }

        return created;
    });

    const { rows: counts } = await pool.query<{ seats: string }>('SELECT count(*) AS seats FROM seats');

    console.log('');
    console.log('Seed concluído:');
    console.log(`  ${MOVIES.length} filmes`);
    console.log(`  ${ROOMS.length} salas / ${counts[0]!.seats} poltronas`);
    console.log(`  ${showtimeCount} sessões nos próximos 14 dias`);
    console.log('');
    console.log(
        `  Admin ....... admin@cinema.dev   / ${process.env.SEED_ADMIN_PASSWORD ? '(SEED_ADMIN_PASSWORD)' : adminPassword}`,
    );
    console.log('  Cliente ..... cliente@cinema.dev / Cliente@12345');
    console.log('');
}

seed()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch(async (error) => {
        console.error('Falha no seed:', error);
        await pool.end();
        process.exit(1);
    });
