import { env } from '../config/env';

/**
 * Especificação OpenAPI escrita à mão.
 *
 * Poderia ser gerada a partir dos schemas zod, mas isso amarraria a
 * documentação ao formato interno de validação. Mantida separada, ela
 * descreve o CONTRATO — o que o cliente pode esperar — e continua legível
 * para quem nunca abriu o código.
 *
 * Servida em /api/docs (JSON) e /api/docs/ui (página interativa).
 */

const errorResponse = {
    type: 'object',
    properties: {
        message: { type: 'string' },
        code: { type: 'string' },
        details: { type: 'object', additionalProperties: { type: 'string' } },
    },
} as const;

const pageMeta = {
    type: 'object',
    properties: {
        page: { type: 'integer' },
        limit: { type: 'integer' },
        total: { type: 'integer' },
        totalPages: { type: 'integer' },
        hasNext: { type: 'boolean' },
        hasPrevious: { type: 'boolean' },
    },
} as const;

export const openApiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'Cine Aurora — API de reservas',
        version: '1.0.0',
        description: [
            'API da plataforma de reservas de cinema.',
            '',
            '**Autenticação:** access token JWT (15 min) no header `Authorization: Bearer <token>`.',
            'O refresh token vive em cookie httpOnly e é rotacionado a cada uso — reapresentar',
            'um token já usado derruba a sessão inteira (detecção de roubo).',
            '',
            '**Concorrência:** a reserva de poltronas é garantida por um índice único parcial no',
            'PostgreSQL. Sob disputa, exatamente uma requisição recebe 201 e as demais recebem',
            '409 `SEAT_TAKEN`.',
        ].join('\n'),
    },
    servers: [{ url: `http://localhost:${env.PORT}`, description: 'Desenvolvimento' }],
    tags: [
        { name: 'Autenticação' },
        { name: 'Filmes' },
        { name: 'Salas' },
        { name: 'Sessões' },
        { name: 'Reservas' },
    ],
    components: {
        securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
        schemas: {
            Erro: errorResponse,
            PageMeta: pageMeta,
            Movie: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    title: { type: 'string' },
                    originalTitle: { type: 'string', nullable: true },
                    synopsis: { type: 'string' },
                    durationMin: { type: 'integer' },
                    genres: { type: 'array', items: { type: 'string' } },
                    ageRating: { type: 'string', enum: ['L', '10', '12', '14', '16', '18'] },
                    director: { type: 'string', nullable: true },
                    cast: { type: 'array', items: { type: 'string' } },
                    posterUrl: { type: 'string', nullable: true },
                    nextShowtime: { type: 'string', format: 'date-time', nullable: true },
                },
            },
            Showtime: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    startsAt: { type: 'string', format: 'date-time' },
                    endsAt: { type: 'string', format: 'date-time' },
                    format: { type: 'string', enum: ['2D', '3D', 'IMAX', '4DX'] },
                    language: { type: 'string', enum: ['DUBBED', 'SUBTITLED', 'ORIGINAL'] },
                    basePrice: { type: 'number' },
                    movie: { type: 'object' },
                    room: { type: 'object' },
                    occupancy: {
                        type: 'object',
                        properties: {
                            total: { type: 'integer' },
                            taken: { type: 'integer' },
                            available: { type: 'integer' },
                            percentage: { type: 'integer' },
                        },
                    },
                },
            },
            SeatMap: {
                type: 'object',
                properties: {
                    showtime: { $ref: '#/components/schemas/Showtime' },
                    rows: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                label: { type: 'string', example: 'F' },
                                seats: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string', format: 'uuid' },
                                            label: { type: 'string', example: 'F7' },
                                            tier: {
                                                type: 'string',
                                                enum: ['NORMAL', 'SEMI_VIP', 'VIP'],
                                            },
                                            status: {
                                                type: 'string',
                                                enum: ['AVAILABLE', 'HELD', 'SOLD', 'MINE'],
                                            },
                                            price: { type: 'number' },
                                            isAccessible: { type: 'boolean' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            Reservation: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    code: { type: 'string', example: 'CINE-7KQ2XB' },
                    status: {
                        type: 'string',
                        enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED'],
                    },
                    totalAmount: { type: 'number' },
                    expiresAt: { type: 'string', format: 'date-time', nullable: true },
                    secondsToExpire: { type: 'integer', nullable: true },
                    seats: { type: 'array', items: { type: 'object' } },
                },
            },
        },
    },
    paths: {
        '/health': {
            get: {
                tags: ['Autenticação'],
                summary: 'Verificação de saúde',
                security: [],
                responses: { 200: { description: 'API no ar' } },
            },
        },

        '/api/auth/register': {
            post: {
                tags: ['Autenticação'],
                summary: 'Cria uma conta de cliente',
                description:
                    'O papel é sempre CLIENT. Enviar `role` no corpo não tem efeito — o schema descarta campos não declarados.',
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['name', 'email', 'password'],
                                properties: {
                                    name: { type: 'string', minLength: 2 },
                                    email: { type: 'string', format: 'email' },
                                    password: {
                                        type: 'string',
                                        minLength: 8,
                                        description: 'Mínimo 8 caracteres, com letra e número.',
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: 'Conta criada; cookie de refresh definido' },
                    409: { description: 'E-mail já cadastrado' },
                    422: { description: 'Dados inválidos' },
                },
            },
        },

        '/api/auth/login': {
            post: {
                tags: ['Autenticação'],
                summary: 'Autentica e devolve o access token',
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email', 'password'],
                                properties: {
                                    email: { type: 'string', format: 'email' },
                                    password: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: { description: 'Autenticado' },
                    401: { description: 'Credenciais inválidas' },
                    429: { description: 'Muitas tentativas' },
                },
            },
        },

        '/api/auth/refresh': {
            post: {
                tags: ['Autenticação'],
                summary: 'Rotaciona o refresh token',
                description:
                    'Usa o cookie httpOnly. Reapresentar um token já consumido revoga toda a família de sessões.',
                security: [],
                responses: {
                    200: { description: 'Novo par de tokens' },
                    401: { description: 'Sessão inválida, expirada ou reuso detectado' },
                },
            },
        },

        '/api/auth/me': {
            get: {
                tags: ['Autenticação'],
                summary: 'Perfil do usuário autenticado',
                responses: { 200: { description: 'Perfil' }, 401: { description: 'Sem sessão' } },
            },
        },

        '/api/movies': {
            get: {
                tags: ['Filmes'],
                summary: 'Lista filmes com busca e filtros',
                description:
                    'A busca (`q`) é full-text em português, ignora acentos e cobre título, título original, diretor, gêneros e sinopse.',
                security: [],
                parameters: [
                    { name: 'q', in: 'query', schema: { type: 'string' }, example: 'ficcao' },
                    {
                        name: 'genre',
                        in: 'query',
                        schema: { type: 'string' },
                        description: 'Um ou mais, separados por vírgula.',
                    },
                    { name: 'ageRating', in: 'query', schema: { type: 'string' }, example: '14,16' },
                    { name: 'format', in: 'query', schema: { type: 'string' }, example: 'IMAX' },
                    { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } },
                    { name: 'roomId', in: 'query', schema: { type: 'string', format: 'uuid' } },
                    {
                        name: 'sort',
                        in: 'query',
                        schema: {
                            type: 'string',
                            enum: ['relevance', 'title', 'release', 'soonest'],
                        },
                    },
                    { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
                    {
                        name: 'limit',
                        in: 'query',
                        schema: { type: 'integer', minimum: 1, maximum: 50 },
                    },
                ],
                responses: {
                    200: {
                        description: 'Lista paginada',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        data: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/Movie' },
                                        },
                                        meta: { $ref: '#/components/schemas/PageMeta' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            post: {
                tags: ['Filmes'],
                summary: 'Cadastra um filme (ADMIN)',
                responses: {
                    201: { description: 'Criado' },
                    403: { description: 'Requer papel ADMIN' },
                },
            },
        },

        '/api/movies/{id}/calendar': {
            get: {
                tags: ['Filmes'],
                summary: 'Dias com sessão disponíveis',
                security: [],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                    { name: 'days', in: 'query', schema: { type: 'integer', default: 14 } },
                ],
                responses: { 200: { description: 'Dias com contagem de sessões e formatos' } },
            },
        },

        '/api/showtimes': {
            get: {
                tags: ['Sessões'],
                summary: 'Lista sessões',
                security: [],
                parameters: [
                    { name: 'movieId', in: 'query', schema: { type: 'string', format: 'uuid' } },
                    { name: 'roomId', in: 'query', schema: { type: 'string', format: 'uuid' } },
                    { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } },
                    { name: 'format', in: 'query', schema: { type: 'string' } },
                ],
                responses: { 200: { description: 'Lista paginada de sessões' } },
            },
            post: {
                tags: ['Sessões'],
                summary: 'Cria uma sessão (ADMIN)',
                description:
                    'O término é calculado a partir da duração do filme. Horários sobrepostos na mesma sala são recusados pelo banco com 409.',
                responses: {
                    201: { description: 'Criada' },
                    409: { description: 'SHOWTIME_OVERLAP — a sala já tem sessão no intervalo' },
                },
            },
        },

        '/api/showtimes/{id}/seats': {
            get: {
                tags: ['Sessões'],
                summary: 'Mapa de poltronas da sessão',
                description:
                    'Todas as poltronas da sala com status e preço já calculado por tipo. Com token, marca como MINE as poltronas da própria reserva.',
                security: [],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
                ],
                responses: {
                    200: {
                        description: 'Mapa completo',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: { data: { $ref: '#/components/schemas/SeatMap' } },
                                },
                            },
                        },
                    },
                },
            },
        },

        '/api/reservations': {
            post: {
                tags: ['Reservas'],
                summary: 'Reserva poltronas',
                description: [
                    'Cria uma reserva PENDING que segura as poltronas por 10 minutos.',
                    '',
                    'O preço NÃO vem do cliente: é calculado no banco a partir do preço-base da',
                    'sessão e do multiplicador do tipo de poltrona (Normal ×1,0 · Semi-VIP ×1,4 ·',
                    'VIP ×1,9), com metade do valor para meia-entrada.',
                ].join('\n'),
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['showtimeId', 'seats'],
                                properties: {
                                    showtimeId: { type: 'string', format: 'uuid' },
                                    seats: {
                                        type: 'array',
                                        minItems: 1,
                                        maxItems: 6,
                                        items: {
                                            type: 'object',
                                            required: ['seatId'],
                                            properties: {
                                                seatId: { type: 'string', format: 'uuid' },
                                                ticketKind: {
                                                    type: 'string',
                                                    enum: ['FULL', 'HALF'],
                                                    default: 'FULL',
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: 'Reserva criada',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        data: { $ref: '#/components/schemas/Reservation' },
                                    },
                                },
                            },
                        },
                    },
                    400: { description: 'INVALID_SEATS — poltrona não pertence à sessão' },
                    409: { description: 'SEAT_TAKEN — poltrona reservada por outra pessoa' },
                    422: { description: 'Validação (poltrona repetida, limite excedido)' },
                },
            },
        },

        '/api/reservations/me': {
            get: {
                tags: ['Reservas'],
                summary: 'Reservas do usuário autenticado',
                responses: { 200: { description: 'Lista paginada' } },
            },
        },

        '/api/reservations/{id}/confirm': {
            post: {
                tags: ['Reservas'],
                summary: 'Confirma a reserva antes de expirar',
                responses: {
                    200: { description: 'Confirmada' },
                    403: { description: 'A reserva é de outro usuário' },
                    409: { description: 'Já confirmada, cancelada ou expirada' },
                },
            },
        },

        '/api/reservations/{id}/cancel': {
            post: {
                tags: ['Reservas'],
                summary: 'Cancela e devolve as poltronas ao mapa',
                responses: {
                    200: { description: 'Cancelada' },
                    409: { description: 'A sessão já começou' },
                },
            },
        },

        '/api/rooms': {
            get: {
                tags: ['Salas'],
                summary: 'Lista as salas com resumo de poltronas',
                security: [],
                responses: { 200: { description: 'Salas' } },
            },
            post: {
                tags: ['Salas'],
                summary: 'Cria sala e gera o mapa de poltronas (ADMIN)',
                responses: { 201: { description: 'Criada com as poltronas geradas' } },
            },
        },
    },
    security: [{ bearerAuth: [] }],
} as const;
