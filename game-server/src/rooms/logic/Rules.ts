import { Card } from "../schema/GameState";

export class Rules {
    static getCardValue(rank: string): number {
        const order = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
        return order.indexOf(rank);
    }

    static isValidMove(playedCards: Card[], currentTrick: Card[]): boolean {
        if (playedCards.length === 0) return false;

        // Check if all played cards are of the same rank
        const firstRank = playedCards[0].rank;
        if (!playedCards.every(c => c.rank === firstRank)) {
            return false;
        }

        // If trick is empty, any valid combination is allowed
        if (currentTrick.length === 0) {
            return true;
        }

        // Must play same number of cards
        if (playedCards.length !== currentTrick.length) {
            return false;
        }

        // Must be higher value
        const playedValue = this.getCardValue(firstRank);
        const trickValue = this.getCardValue(currentTrick[0].rank);

        return playedValue > trickValue;
    }
}
