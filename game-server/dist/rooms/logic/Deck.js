"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Deck = void 0;
const GameState_1 = require("../schema/GameState");
const SUITS = ["C", "D", "H", "S"]; // Clubs, Diamonds, Hearts, Spades
const RANKS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
class Deck {
    cards = [];
    constructor() {
        this.reset();
    }
    reset() {
        this.cards = [];
        for (const suit of SUITS) {
            for (const rank of RANKS) {
                this.cards.push(new GameState_1.Card(suit, rank));
            }
        }
    }
    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }
    deal(numPlayers) {
        const hands = Array.from({ length: numPlayers }, () => []);
        let playerIndex = 0;
        while (this.cards.length > 0) {
            const card = this.cards.pop();
            if (card) {
                hands[playerIndex].push(card);
                playerIndex = (playerIndex + 1) % numPlayers;
            }
        }
        return hands;
    }
}
exports.Deck = Deck;
