type ClassValue = string | number | false | null | undefined | ClassValue[];

/**
 * Junta classes condicionais: cn('base', ativo && 'ativo', ['a', 'b']).
 *
 * Versão mínima do `clsx` — 12 linhas resolvem o que o projeto precisa e
 * evitam uma dependência a mais no bundle.
 */
export function cn(...values: ClassValue[]): string {
    const classes: string[] = [];

    for (const value of values) {
        if (!value) continue;

        if (Array.isArray(value)) {
            const nested = cn(...value);
            if (nested) classes.push(nested);
        } else {
            classes.push(String(value));
        }
    }

    return classes.join(' ');
}
