import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export enum GamePhase {
    LOBBY = "LOBBY",
    DEAL = "DEAL",
    PLAY = "PLAY",
    EXCHANGE = "EXCHANGE",
    RESULTS = "RESULTS"
}

export class Card extends Schema {
    @type("string") suit: string;
    @type("string") rank: string;

    constructor(suit: string, rank: string) {
        super();
        this.suit = suit;
        this.rank = rank;
    }
}

export class Player extends Schema {
    @type("string") id: string;
    @type("string") username: string;
    @type("boolean") connected: boolean = true;
    @type("boolean") isReady: boolean = false;
    @type("string") role: string = "NEUTRE"; // PRESIDENT, VICE_PRESIDENT, etc.
    @type("number") handCount: number = 0;
    @type([Card]) hand = new ArraySchema<Card>();

    constructor(id: string, username: string) {
        super();
        this.id = id;
        this.username = username;
    }
}

export class GameState extends Schema {
    @type("string") phase: GamePhase = GamePhase.LOBBY;
    @type("string") code: string = ""; // 4-char display code
    @type("string") currentTurnPlayerId: string = "";
    @type({ map: Player }) players = new MapSchema<Player>();
    @type([Card]) currentTrick = new ArraySchema<Card>();
    @type("string") lastTrickWinnerId: string = "";
    @type("number") consecutivePasses: number = 0;
    @type(["string"]) finishedPlayers = new ArraySchema<string>();

    // Configuration
    @type("number") minPlayers: number = 3;
    @type("number") maxPlayers: number = 5;
}
