import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import { toApiError } from '../api/client';
import { Button, Card, Input } from '../components/ui';

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const login = useAuthStore((state) => state.login);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Para onde voltar depois de entrar: o ProtectedRoute guarda a rota
    // original aqui, então quem clicou em "reservar" volta ao mapa, não à home.
    const from = (location.state as { from?: string } | null)?.from ?? '/';

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            const user = await login(email, password);
            toast.success(`Bem-vindo de volta, ${user.name.split(' ')[0]}!`);
            navigate(from, { replace: true });
        } catch (caught) {
            setError(toApiError(caught).message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-14">
            <h1 className="text-center text-3xl font-bold">Entrar</h1>
            <p className="mt-2 text-center text-sm text-cream-faint">
                Acesse sua conta para reservar poltronas.
            </p>

            <Card className="mt-7 p-6">
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    <Input
                        type="email"
                        label="E-mail"
                        // autoComplete correto faz o gerenciador de senhas do
                        // navegador preencher e salvar direito — detalhe pequeno
                        // que muda muito a experiência de login.
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="voce@email.com"
                    />

                    <Input
                        type="password"
                        label="Senha"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="••••••••"
                    />

                    {error && (
                        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                            {error}
                        </p>
                    )}

                    <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
                        Entrar
                    </Button>
                </form>

                <p className="mt-5 text-center text-sm text-cream-faint">
                    Ainda não tem conta?{' '}
                    <Link to="/cadastro" className="font-medium text-accent hover:underline">
                        Criar conta
                    </Link>
                </p>
            </Card>

            {/* Atalho de demonstração — some em produção. */}
            {import.meta.env.DEV && (
                <div className="mt-5 rounded-xl border border-dashed border-ink-600 p-4 text-xs text-cream-faint">
                    <p className="mb-2 font-medium text-cream-dim">Contas de demonstração</p>
                    <div className="space-y-1.5">
                        {[
                            { label: 'Cliente', email: 'cliente@cinema.dev', password: 'Cliente@12345' },
                            { label: 'Admin', email: 'admin@cinema.dev', password: 'Admin@12345' },
                        ].map((account) => (
                            <button
                                key={account.email}
                                type="button"
                                onClick={() => {
                                    setEmail(account.email);
                                    setPassword(account.password);
                                }}
                                className="block w-full rounded-lg border border-ink-700 px-3 py-1.5 text-left transition-colors hover:border-accent/40 hover:text-cream"
                            >
                                <span className="font-medium text-cream-dim">{account.label}</span> —{' '}
                                {account.email}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
