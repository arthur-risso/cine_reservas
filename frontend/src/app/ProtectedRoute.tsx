import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Skeleton } from '../components/ui';

/**
 * Guarda de rota.
 *
 * Vale dizer o que ela NÃO é: proteção de dados. Qualquer pessoa desativa
 * este componente pelo DevTools. O que realmente protege são o
 * `authenticate` e o `requireRole` do backend. Isto aqui é experiência de
 * uso — evitar que o usuário abra uma tela que só mostraria erro 401.
 */
export function ProtectedRoute({ requireAdmin = false }: { requireAdmin?: boolean }) {
    const { isAuthenticated, isAdmin, isBootstrapping } = useAuthStore();
    const location = useLocation();

    // Enquanto a sessão é restaurada pelo cookie, não dá para decidir: se
    // redirecionasse agora, quem está logado seria mandado ao login a cada
    // F5 na página protegida.
    if (isBootstrapping) {
        return (
            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="mt-4 h-64 w-full" />
            </div>
        );
    }

    if (!isAuthenticated) {
        // `state.from` permite voltar para onde o usuário queria ir depois
        // do login, em vez de despejá-lo na home.
        return <Navigate to="/entrar" replace state={{ from: location.pathname + location.search }} />;
    }

    if (requireAdmin && !isAdmin) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
}
