import { Link } from 'react-router-dom';
import { Button } from '../components/ui';

export default function NotFoundPage() {
    return (
        <div className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-24 text-center">
            <p className="font-display text-7xl font-bold text-accent">404</p>
            <h1 className="mt-4 text-2xl font-bold">Esta sessão não existe</h1>
            <p className="mt-2 text-sm text-cream-faint">
                O endereço que você tentou abrir não faz parte da programação.
            </p>
            <Link to="/" className="mt-6">
                <Button size="lg">Voltar ao início</Button>
            </Link>
        </div>
    );
}
