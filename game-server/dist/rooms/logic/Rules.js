"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rules = void 0;
/* ── Constantes ─────────────────────────────────────────────── */
/** Ordre normal : 3 le plus faible, 2 le plus fort */
const NORMAL_ORDER = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
/** Ordre inversé (révolution) : 2 le plus faible, 3 le plus fort */
const REVERSED_ORDER = ["2", "A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3"];
/** Ordre des couleurs pour le tri (Clubs < Diamonds < Hearts < Spades) */
const SUIT_ORDER = ["C", "D", "H", "S"];
/* ── Classe Rules ───────────────────────────────────────────── */
class Rules {
    /**
     * Retourne la valeur numérique d'un rang.
     * Si `reversed` est true (révolution), l'ordre est inversé.
     */
    static getCardValue(rank, reversed = false) {
        const order = reversed ? REVERSED_ORDER : NORMAL_ORDER;
        return order.indexOf(rank);
    }
    /**
     * Retourne la valeur numérique d'une couleur (pour le tri).
     */
    static getSuitValue(suit) {
        return SUIT_ORDER.indexOf(suit);
    }
    /**
     * Détermine le type de combinaison d'un ensemble de cartes.
     */
    static getCombinationType(cards, config) {
        if (cards.length === 0)
            return "invalid";
        if (cards.length === 1)
            return "single";
        const firstRank = cards[0].rank;
        const allSameRank = cards.every(c => c.rank === firstRank);
        if (allSameRank) {
            switch (cards.length) {
                case 2: return "pair";
                case 3: return "triple";
                case 4: return "quad";
                default: return "invalid";
            }
        }
        // Vérifier si c'est une séquence (si activée)
        if (config.enableSequences && cards.length >= 3) {
            if (this.isSequence(cards, false))
                return "sequence";
        }
        return "invalid";
    }
    /**
     * Vérifie si les cartes forment une séquence (suite) valide.
     */
    static isSequence(cards, reversed) {
        if (cards.length < 3)
            return false;
        const order = reversed ? REVERSED_ORDER : NORMAL_ORDER;
        const values = cards.map(c => order.indexOf(c.rank)).sort((a, b) => a - b);
        // Vérifier que les valeurs sont consécutives
        for (let i = 1; i < values.length; i++) {
            if (values[i] !== values[i - 1] + 1)
                return false;
        }
        // Vérifier pas de doublons
        const uniqueRanks = new Set(cards.map(c => c.rank));
        if (uniqueRanks.size !== cards.length)
            return false;
        return true;
    }
    /**
     * Vérifie si un coup est valide par rapport au pli courant.
     */
    static isValidMove(playedCards, currentTrick, config, reversed = false, isForcedRank = "", activeConsecutiveCards = 0) {
        if (playedCards.length === 0)
            return false;
        const playedType = this.getCombinationType(playedCards, config);
        if (playedType === "invalid")
            return false;
        // ── 2 spécial : coupe le pli ──
        if (config.enableSpecialTwo && playedCards.every(c => c.rank === "2")) {
            // Un ou plusieurs 2 peuvent toujours être joués pour couper
            return true;
        }
        // ── Pli vide → n'importe quelle combinaison valide ──
        if (currentTrick.length === 0) {
            return true;
        }
        const trickType = this.getCombinationType(currentTrick, config);
        // ── Carré (révolution) peut être joué sur n'importe quel pli ──
        if (playedType === "quad" && config.enableRevolution) {
            return true;
        }
        // ── Même type de combinaison requis ──
        if (playedType !== trickType)
            return false;
        // ── Règle du 3ème joueur forcé ──
        if (isForcedRank && playedType !== "sequence") {
            // Le joueur doit absolument jouer ce rang
            if (playedCards[0].rank !== isForcedRank) {
                return false;
            }
        }
        // ── Complétion de carré dynamique ──
        // Si le joueur ajoute le nombre exact de cartes manquantes pour former un carré final de 4
        if (currentTrick.length > 0 &&
            playedType !== "sequence" &&
            playedCards[0].rank === currentTrick[0].rank &&
            activeConsecutiveCards + playedCards.length === 4) {
            return true;
        }
        // ── Même nombre de cartes ──
        if (playedCards.length !== currentTrick.length)
            return false;
        // ── Valeur supérieure ou égale requise ──
        if (playedType === "sequence") {
            // Pour une séquence, comparer la plus haute carte
            const playedMax = Math.max(...playedCards.map(c => this.getCardValue(c.rank, reversed)));
            const trickMax = Math.max(...currentTrick.map(c => this.getCardValue(c.rank, reversed)));
            return playedMax >= trickMax;
        }
        else {
            // Pour single / pair / triple / quad : comparer le rang
            const playedValue = this.getCardValue(playedCards[0].rank, reversed);
            const trickValue = this.getCardValue(currentTrick[0].rank, reversed);
            return playedValue >= trickValue;
        }
    }
    /**
     * Trie une main par valeur croissante, puis par couleur.
     */
    static sortHand(hand, reversed = false) {
        return hand.sort((a, b) => {
            const valA = this.getCardValue(a.rank, reversed);
            const valB = this.getCardValue(b.rank, reversed);
            if (valA !== valB)
                return valA - valB;
            return this.getSuitValue(a.suit) - this.getSuitValue(b.suit);
        });
    }
    /**
     * Trouve le joueur qui doit commencer la manche.
     * - "three_of_clubs" : celui qui a le 3♣
     * - "lowest_card" : celui qui a la plus petite carte
     */
    static findStartingPlayer(hands, config, reversed = false) {
        const playerIds = Array.from(hands.keys());
        if (config.startRule === "three_of_clubs") {
            for (const id of playerIds) {
                const hand = hands.get(id);
                if (hand.some(c => c.rank === "3" && c.suit === "C")) {
                    return id;
                }
            }
        }
        // Fallback ou "lowest_card" : trouver la plus petite carte
        let lowestPlayerId = playerIds[0];
        let lowestValue = Infinity;
        for (const id of playerIds) {
            const hand = hands.get(id);
            for (const card of hand) {
                const val = this.getCardValue(card.rank, reversed);
                const suitVal = this.getSuitValue(card.suit);
                const compositeVal = val * 10 + suitVal;
                if (compositeVal < lowestValue) {
                    lowestValue = compositeVal;
                    lowestPlayerId = id;
                }
            }
        }
        return lowestPlayerId;
    }
    /**
     * Effectue l'échange de cartes entre deux joueurs.
     * @param giverHand  Main du donneur (modifiée en place)
     * @param receiverHand  Main du receveur (modifiée en place)
     * @param count  Nombre de cartes à échanger
     * @param giveBest  true = donner les meilleures, false = donner les pires
     * @param reversed  true = révolution active
     */
    static exchangeCards(giverHand, receiverHand, count, giveBest, reversed = false) {
        // Trier la main du donneur
        this.sortHand(giverHand, reversed);
        // Extraire les cartes à donner
        const cardsToGive = [];
        for (let i = 0; i < count && giverHand.length > 0; i++) {
            const idx = giveBest ? giverHand.length - 1 : 0;
            cardsToGive.push(giverHand.splice(idx, 1)[0]);
        }
        // Ajouter les cartes au receveur
        receiverHand.push(...cardsToGive);
    }
}
exports.Rules = Rules;
