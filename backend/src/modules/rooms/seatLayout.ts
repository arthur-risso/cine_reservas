export type SeatTier = 'NORMAL' | 'SEMI_VIP' | 'VIP';

export interface GeneratedSeat {
    rowLabel: string;
    seatNumber: number;
    tier: SeatTier;
    isAccessible: boolean;
}

export interface LayoutOptions {
    rowsCount: number;
    seatsPerRow: number;
    /** Fração das fileiras da frente que fica como NORMAL (0 a 1). */
    normalRatio?: number;
    /** Fração seguinte que fica como SEMI_VIP (0 a 1). */
    semiVipRatio?: number;
    /** Quantas poltronas da primeira fileira são para cadeirantes. */
    accessibleSeats?: number;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function rowLabelFor(index: number): string {
    if (index < 0 || index >= ALPHABET.length) {
        throw new Error(`Índice de fileira fora do alfabeto: ${index}`);
    }
    return ALPHABET[index] as string;
}

/**
 * Gera o mapa de poltronas de uma sala.
 *
 * A distribuição segue a lógica real de cinema: as primeiras fileiras (perto
 * da tela, onde o pescoço dói) são Normais; o miolo — melhor ângulo — é
 * Semi-VIP; o fundo, com reclinável, é VIP. Assim o preço acompanha a
 * qualidade do assento em vez de ser aleatório.
 *
 * Centralizar isso aqui significa que o seed e o CRUD de salas produzem
 * exatamente o mesmo layout, sem duas versões da regra para divergirem.
 */
export function generateSeatLayout({
    rowsCount,
    seatsPerRow,
    normalRatio = 0.45,
    semiVipRatio = 0.35,
    accessibleSeats = 2,
}: LayoutOptions): GeneratedSeat[] {
    if (rowsCount < 1 || rowsCount > ALPHABET.length) {
        throw new Error('A sala precisa ter entre 1 e 26 fileiras.');
    }
    if (seatsPerRow < 1 || seatsPerRow > 40) {
        throw new Error('A sala precisa ter entre 1 e 40 poltronas por fileira.');
    }

    const normalRows = Math.max(1, Math.round(rowsCount * normalRatio));
    const semiVipRows = Math.round(rowsCount * semiVipRatio);
    const seats: GeneratedSeat[] = [];

    for (let rowIndex = 0; rowIndex < rowsCount; rowIndex += 1) {
        let tier: SeatTier = 'VIP';
        if (rowIndex < normalRows) {
            tier = 'NORMAL';
        } else if (rowIndex < normalRows + semiVipRows) {
            tier = 'SEMI_VIP';
        }

        for (let seatNumber = 1; seatNumber <= seatsPerRow; seatNumber += 1) {
            seats.push({
                rowLabel: rowLabelFor(rowIndex),
                seatNumber,
                tier,
                // Cadeirantes ficam na fileira A, junto ao corredor de acesso.
                isAccessible: rowIndex === 0 && seatNumber <= accessibleSeats,
            });
        }
    }

    return seats;
}
