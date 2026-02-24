import { Card } from "../schema/GameState";
import { GameConfig } from "./GameConfig";
export type CombinationType = "single" | "pair" | "triple" | "quad" | "sequence" | "invalid";
export declare class Rules {
    /**
     * Retourne la valeur numérique d'un rang.
     * Si `reversed` est true (révolution), l'ordre est inversé.
     */
    static getCardValue(rank: string, reversed?: boolean): number;
    /**
     * Retourne la valeur numérique d'une couleur (pour le tri).
     */
    static getSuitValue(suit: string): number;
    /**
     * Détermine le type de combinaison d'un ensemble de cartes.
     */
    static getCombinationType(cards: Card[], config: GameConfig): CombinationType;
    /**
     * Vérifie si les cartes forment une séquence (suite) valide.
     */
    static isSequence(cards: Card[], reversed: boolean): boolean;
    /**
     * Vérifie si un coup est valide par rapport au pli courant.
     */
    static isValidMove(playedCards: Card[], currentTrick: Card[], config: GameConfig, reversed?: boolean, isForcedRank?: string, activeConsecutiveCards?: number): boolean;
    /**
     * Trie une main par valeur croissante, puis par couleur.
     */
    static sortHand(hand: {
        suit: string;
        rank: string;
    }[], reversed?: boolean): {
        suit: string;
        rank: string;
    }[];
    /**
     * Trouve le joueur qui doit commencer la manche.
     * - "three_of_clubs" : celui qui a le 3♣
     * - "lowest_card" : celui qui a la plus petite carte
     */
    static findStartingPlayer(hands: Map<string, {
        suit: string;
        rank: string;
    }[]>, config: GameConfig, reversed?: boolean): string;
    /**
     * Effectue l'échange de cartes entre deux joueurs.
     * @param giverHand  Main du donneur (modifiée en place)
     * @param receiverHand  Main du receveur (modifiée en place)
     * @param count  Nombre de cartes à échanger
     * @param giveBest  true = donner les meilleures, false = donner les pires
     * @param reversed  true = révolution active
     */
    static exchangeCards(giverHand: {
        suit: string;
        rank: string;
    }[], receiverHand: {
        suit: string;
        rank: string;
    }[], count: number, giveBest: boolean, reversed?: boolean): void;
}
//# sourceMappingURL=Rules.d.ts.map