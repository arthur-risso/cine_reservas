import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

/**
 * Em produção a API é chamada por caminho relativo (`/api/...`), e o Vercel
 * repassa ao backend via rewrite (ver vercel.json). Assim o navegador vê uma
 * única origem: o cookie de refresh, que é `SameSite=Strict`, continua sendo
 * enviado. Com a API em outro domínio `*.vercel.app` ele seria descartado
 * como cookie de outro site, e o usuário perderia a sessão a cada F5.
 */
const BASE_URL =
    import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3333' : '');

/**
 * O access token vive em memória, não em localStorage.
 *
 * localStorage é legível por qualquer script da página — um XSS, ou uma
 * dependência comprometida, levaria o token embora. Em memória, ele morre
 * ao fechar a aba; a sessão é reconstruída no carregamento pelo cookie
 * httpOnly de refresh, que o JavaScript não consegue ler.
 */
let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
    accessToken = token;
}

export function getAccessToken(): string | null {
    return accessToken;
}

export function onUnauthorized(handler: () => void): void {
    onSessionLost = handler;
}

export const api = axios.create({
    baseURL: BASE_URL,
    // Envia o cookie de refresh nas rotas de auth (o back responde com
    // Access-Control-Allow-Credentials).
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15_000,
});

api.interceptors.request.use((config) => {
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
});

/**
 * Renovação automática da sessão.
 *
 * O access token dura 15 minutos; sem isso, o usuário seria expulso no meio
 * da escolha das poltronas. Ao receber 401, o interceptor chama /refresh uma
 * única vez e repete a requisição original de forma transparente.
 *
 * A promessa compartilhada (`refreshPromise`) é o detalhe que evita o
 * problema clássico: a tela dispara 4 requisições, todas voltam 401 juntas,
 * e sem esse controle seriam 4 refreshes em paralelo — com rotação de token,
 * três deles seriam considerados reuso e derrubariam a sessão inteira.
 */
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
    refreshPromise ??= axios
        .post<{ accessToken: string }>(
            `${BASE_URL}/api/auth/refresh`,
            {},
            { withCredentials: true },
        )
        .then((response) => {
            accessToken = response.data.accessToken;
            return response.data.accessToken;
        })
        .finally(() => {
            refreshPromise = null;
        });

    return refreshPromise;
}

interface RetriableConfig extends AxiosRequestConfig {
    _retried?: boolean;
}

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<{ code?: string; message?: string }>) => {
        const original = error.config as RetriableConfig | undefined;
        const status = error.response?.status;
        const code = error.response?.data?.code;

        const isAuthRoute = original?.url?.includes('/api/auth/');

        // Só tenta renovar em 401 por token vencido/ausente, uma vez por
        // requisição, e nunca nas próprias rotas de autenticação (senão um
        // login com senha errada dispararia um refresh sem sentido).
        if (
            status === 401 &&
            original &&
            !original._retried &&
            !isAuthRoute &&
            (code === 'TOKEN_EXPIRED' || code === 'NO_TOKEN' || code === 'INVALID_TOKEN')
        ) {
            original._retried = true;

            try {
                await refreshAccessToken();
                return api(original);
            } catch {
                accessToken = null;
                onSessionLost?.();
            }
        }

        return Promise.reject(error);
    },
);

export interface ApiErrorShape {
    message: string;
    code: string;
    details?: Record<string, string>;
}

/**
 * Normaliza qualquer falha em algo que a interface sabe exibir.
 *
 * Sem isso, cada `catch` no app precisaria adivinhar se o erro tem
 * `response.data.message`, se é erro de rede, ou se é um Error comum.
 */
export function toApiError(error: unknown): ApiErrorShape {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as ApiErrorShape | undefined;

        if (data?.message) {
            return { message: data.message, code: data.code ?? 'ERROR', details: data.details };
        }

        if (error.code === 'ECONNABORTED') {
            return { message: 'A conexão demorou demais. Tente novamente.', code: 'TIMEOUT' };
        }

        if (!error.response) {
            return {
                message: 'Não foi possível falar com o servidor. Verifique sua conexão.',
                code: 'NETWORK_ERROR',
            };
        }
    }

    return { message: 'Algo deu errado. Tente novamente.', code: 'UNKNOWN' };
}
