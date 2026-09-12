import { create } from 'zustand';
import { authApi } from '../api/endpoints';
import { setAccessToken } from '../api/client';
import type { User } from '../api/types';

interface AuthState {
    user: User | null;
    /** `true` só até a primeira tentativa de restaurar a sessão terminar. */
    isBootstrapping: boolean;
    isAuthenticated: boolean;
    isAdmin: boolean;

    bootstrap: () => Promise<void>;
    login: (email: string, password: string) => Promise<User>;
    register: (name: string, email: string, password: string) => Promise<User>;
    logout: () => Promise<void>;
}

/**
 * Estado de sessão.
 *
 * Guarda apenas o usuário — o token fica no módulo do axios, em memória.
 * Assim nenhum componente tem acesso ao token, e não há risco de alguém
 * persistir isso em localStorage "para facilitar".
 */
export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isBootstrapping: true,
    isAuthenticated: false,
    isAdmin: false,

    /**
     * Reconstrói a sessão ao abrir o app.
     *
     * O access token some quando a aba fecha, mas o cookie httpOnly de
     * refresh sobrevive. Esta chamada troca o cookie por um token novo — é
     * o que faz o usuário continuar logado depois de fechar o navegador,
     * sem nunca ter guardado credencial em lugar acessível a scripts.
     */
    bootstrap: async () => {
        try {
            const { user, accessToken } = await authApi.refresh();
            setAccessToken(accessToken);
            set({ user, isAuthenticated: true, isAdmin: user.role === 'ADMIN' });
        } catch {
            // Sem sessão válida é o caso normal de quem nunca entrou.
            setAccessToken(null);
            set({ user: null, isAuthenticated: false, isAdmin: false });
        } finally {
            set({ isBootstrapping: false });
        }
    },

    login: async (email, password) => {
        const { user, accessToken } = await authApi.login(email, password);
        setAccessToken(accessToken);
        set({ user, isAuthenticated: true, isAdmin: user.role === 'ADMIN' });
        return user;
    },

    register: async (name, email, password) => {
        const { user, accessToken } = await authApi.register(name, email, password);
        setAccessToken(accessToken);
        set({ user, isAuthenticated: true, isAdmin: user.role === 'ADMIN' });
        return user;
    },

    logout: async () => {
        try {
            // Revoga a família de refresh tokens no servidor; sem isso o
            // cookie continuaria valendo mesmo após "sair".
            await authApi.logout();
        } finally {
            setAccessToken(null);
            set({ user: null, isAuthenticated: false, isAdmin: false });
        }
    },
}));
