import { useEffect, useState } from 'react';

/**
 * Atrasa a propagação de um valor que muda rápido.
 *
 * Aplicado à busca: sem isso, digitar "oppenheimer" dispara 11 requisições
 * — uma por tecla — e as respostas podem até chegar fora de ordem, fazendo
 * a lista piscar com resultados de "oppen" depois dos de "oppenheimer".
 * Com 300ms, sai uma requisição só, quando a pessoa para de digitar.
 */
export function useDebounce<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        // A limpeza cancela o timer anterior a cada tecla — é o que faz o
        // atraso ser "desde a última tecla", e não um enfileiramento.
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debounced;
}
