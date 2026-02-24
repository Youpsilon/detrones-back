import { Card } from "../schema/GameState";
export declare class Deck {
    cards: Card[];
    constructor();
    reset(): void;
    shuffle(): void;
    deal(numPlayers: number): Card[][];
}
//# sourceMappingURL=Deck.d.ts.map