import { Schema, MapSchema, ArraySchema } from "@colyseus/schema";
export declare enum GamePhase {
    LOBBY = "LOBBY",
    DEAL = "DEAL",
    EXCHANGE = "EXCHANGE",
    PLAY = "PLAY",
    RESULTS = "RESULTS"
}
export declare class Card extends Schema {
    suit: string;
    rank: string;
    constructor(suit: string, rank: string);
}
export declare class Player extends Schema {
    id: string;
    username: string;
    connected: boolean;
    isReady: boolean;
    role: string;
    handCount: number;
    hand: ArraySchema<Card>;
    constructor(id: string, username: string);
}
export declare class GameState extends Schema {
    phase: GamePhase;
    code: string;
    currentTurnPlayerId: string;
    players: MapSchema<Player, string>;
    currentTrick: ArraySchema<Card>;
    lastTrickWinnerId: string;
    consecutivePasses: number;
    finishedPlayers: ArraySchema<string>;
    minPlayers: number;
    maxPlayers: number;
    reversed: boolean;
    roundNumber: number;
    currentTrickType: string;
    activeConsecutiveCards: number;
    isForcedRank: string;
}
//# sourceMappingURL=GameState.d.ts.map