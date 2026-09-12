import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './app/router';
import { onUnauthorized } from './api/client';
import { useAuthStore } from './stores/authStore';
import { toast } from './stores/toastStore';
import { Toaster } from './components/ui/Toaster';
import './index.css';

/**
 * Configuração do cache de dados.
 *
 * `staleTime: 30s` é o ajuste com mais impacto perceptível: sem ele, o React
 * Query considera todo dado velho na hora e refaz a requisição a cada
 * montagem de componente — voltar de uma página para a lista de filmes
 * dispararia a busca de novo, com piscada na tela.
 *
 * Dados que mudam por segundo (o mapa de poltronas) sobrescrevem isso na
 * própria query, com `staleTime: 0`.
 */
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            // Voltar para a aba não deve refazer tudo; a lista de filmes não
            // muda a cada troca de janela.
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
                // Não insistir em erro do cliente (404, 403, 422): a resposta
                // seria idêntica, e as tentativas só atrasam a mensagem.
                const status = (error as { response?: { status?: number } })?.response?.status;
                if (status && status >= 400 && status < 500) return false;
                return failureCount < 2;
            },
        },
        mutations: { retry: false },
    },
});

function Root() {
    const bootstrap = useAuthStore((state) => state.bootstrap);

    useEffect(() => {
        // Tenta restaurar a sessão a partir do cookie httpOnly de refresh.
        void bootstrap();

        // Quando o refresh falha de vez (token revogado, expirado ou reuso
        // detectado), limpa o cache: dados de outro usuário não podem
        // sobrar na tela.
        onUnauthorized(() => {
            queryClient.clear();
            useAuthStore.setState({ user: null, isAuthenticated: false, isAdmin: false });
            toast.error('Sua sessão expirou.', 'Entre novamente para continuar.');
        });
    }, [bootstrap]);

    return (
        <>
            <RouterProvider router={router} />
            <Toaster />
        </>
    );
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <Root />
        </QueryClientProvider>
    </StrictMode>,
);
