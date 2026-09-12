import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';

/**
 * Rotas carregadas sob demanda.
 *
 * Sem `lazy`, o visitante que abre a home baixa também o painel admin, o
 * mapa de poltronas e todos os formulários — código que talvez nunca use.
 * Com a divisão, cada rota vira um arquivo separado buscado no momento da
 * navegação, e o primeiro carregamento fica bem menor.
 *
 * A home é a exceção proposital: é a porta de entrada, então entra no bundle
 * principal para aparecer sem nenhum salto de rede extra.
 */
import { HomePage } from '../pages/HomePage';

const MoviesPage = lazy(() => import('../pages/MoviesPage'));
const MovieDetailPage = lazy(() => import('../pages/MovieDetailPage'));
const SchedulePage = lazy(() => import('../pages/SchedulePage'));
const SeatSelectionPage = lazy(() => import('../pages/SeatSelectionPage'));
const CheckoutPage = lazy(() => import('../pages/CheckoutPage'));
const MyReservationsPage = lazy(() => import('../pages/MyReservationsPage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const RegisterPage = lazy(() => import('../pages/RegisterPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));
const AdminLayout = lazy(() => import('../pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const AdminMovies = lazy(() => import('../pages/admin/AdminMovies'));
const AdminRooms = lazy(() => import('../pages/admin/AdminRooms'));
const AdminShowtimes = lazy(() => import('../pages/admin/AdminShowtimes'));

export const router = createBrowserRouter([
    {
        element: <AppLayout />,
        children: [
            { path: '/', element: <HomePage /> },
            { path: '/filmes', element: <MoviesPage /> },
            { path: '/filmes/:id', element: <MovieDetailPage /> },
            { path: '/programacao', element: <SchedulePage /> },
            { path: '/sessoes/:id/poltronas', element: <SeatSelectionPage /> },

            { path: '/entrar', element: <LoginPage /> },
            { path: '/cadastro', element: <RegisterPage /> },

            // Exigem login — a checagem também existe no servidor.
            {
                element: <ProtectedRoute />,
                children: [
                    { path: '/reservas/:id', element: <CheckoutPage /> },
                    { path: '/minhas-reservas', element: <MyReservationsPage /> },
                ],
            },

            // Exigem papel ADMIN.
            {
                element: <ProtectedRoute requireAdmin />,
                children: [
                    {
                        path: '/admin',
                        element: <AdminLayout />,
                        children: [
                            { index: true, element: <AdminDashboard /> },
                            { path: 'filmes', element: <AdminMovies /> },
                            { path: 'salas', element: <AdminRooms /> },
                            { path: 'sessoes', element: <AdminShowtimes /> },
                        ],
                    },
                ],
            },

            { path: '*', element: <NotFoundPage /> },
        ],
    },
]);
