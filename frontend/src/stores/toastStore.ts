import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
    id: number;
    tone: ToastTone;
    title: string;
    description?: string;
}

interface ToastState {
    toasts: Toast[];
    push: (toast: Omit<Toast, 'id'>) => void;
    dismiss: (id: number) => void;
}

let nextId = 1;

/**
 * Fila de avisos.
 *
 * Fica em store global (e não em estado de componente) porque quem dispara
 * o aviso quase nunca é quem o exibe: o erro nasce numa mutation dentro de
 * um modal e precisa aparecer no canto da tela, sobrevivendo à desmontagem
 * daquele modal.
 */
export const useToastStore = create<ToastState>((set) => ({
    toasts: [],

    push: (toast) => {
        const id = nextId++;
        set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));

        // Erros ficam mais tempo: costumam ter texto para ler.
        const timeout = toast.tone === 'error' ? 7000 : 4000;
        setTimeout(() => {
            set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
        }, timeout);
    },

    dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),
}));

/** Atalhos para não repetir `push({ tone: ... })` em todo lugar. */
export const toast = {
    success: (title: string, description?: string) =>
        useToastStore.getState().push({ tone: 'success', title, description }),
    error: (title: string, description?: string) =>
        useToastStore.getState().push({ tone: 'error', title, description }),
    info: (title: string, description?: string) =>
        useToastStore.getState().push({ tone: 'info', title, description }),
};
