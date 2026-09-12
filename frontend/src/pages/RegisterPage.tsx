import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import { toApiError } from '../api/client';
import { Button, Card, Input } from '../components/ui';
import { cn } from '../lib/cn';

/**
 * Força da senha, mesmas regras do backend.
 *
 * A validação no cliente é sobre feedback imediato — mostrar o problema
 * enquanto a pessoa digita, sem esperar o servidor. A que vale é a do zod
 * no backend; esta apenas evita uma viagem inútil.
 */
function passwordChecks(password: string) {
    return [
        { label: 'Ao menos 8 caracteres', ok: password.length >= 8 },
        { label: 'Uma letra', ok: /[A-Za-zÀ-ÿ]/.test(password) },
        { label: 'Um número', ok: /\d/.test(password) },
    ];
}

export default function RegisterPage() {
    const navigate = useNavigate();
    const register = useAuthStore((state) => state.register);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const checks = useMemo(() => passwordChecks(password), [password]);
    const isValid = name.trim().length >= 2 && email.includes('@') && checks.every((c) => c.ok);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            const user = await register(name, email, password);
            toast.success(`Conta criada. Boas-vindas, ${user.name.split(' ')[0]}!`);
            navigate('/', { replace: true });
        } catch (caught) {
            setError(toApiError(caught).message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-14">
            <h1 className="text-center text-3xl font-bold">Criar conta</h1>
            <p className="mt-2 text-center text-sm text-cream-faint">
                Leva menos de um minuto e já dá para reservar.
            </p>

            <Card className="mt-7 p-6">
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    <Input
                        label="Nome completo"
                        autoComplete="name"
                        required
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Como quer ser chamado"
                    />

                    <Input
                        type="email"
                        label="E-mail"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="voce@email.com"
                    />

                    <div>
                        <Input
                            type="password"
                            label="Senha"
                            autoComplete="new-password"
                            required
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="••••••••"
                        />

                        <ul className="mt-2 space-y-1">
                            {checks.map((check) => (
                                <li
                                    key={check.label}
                                    className={cn(
                                        'flex items-center gap-1.5 text-xs transition-colors',
                                        check.ok ? 'text-success' : 'text-cream-faint',
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'grid size-3.5 place-items-center rounded-full border text-[8px]',
                                            check.ok
                                                ? 'border-success bg-success/20'
                                                : 'border-ink-600',
                                        )}
                                        aria-hidden="true"
                                    >
                                        {check.ok ? '✓' : ''}
                                    </span>
                                    {check.label}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {error && (
                        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                            {error}
                        </p>
                    )}

                    <Button
                        type="submit"
                        fullWidth
                        size="lg"
                        disabled={!isValid}
                        isLoading={isSubmitting}
                    >
                        Criar conta
                    </Button>
                </form>

                <p className="mt-5 text-center text-sm text-cream-faint">
                    Já tem conta?{' '}
                    <Link to="/entrar" className="font-medium text-accent hover:underline">
                        Entrar
                    </Link>
                </p>
            </Card>
        </div>
    );
}
