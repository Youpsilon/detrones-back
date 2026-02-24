"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameState = exports.Player = exports.Card = exports.GamePhase = void 0;
const schema_1 = require("@colyseus/schema");
var GamePhase;
(function (GamePhase) {
    GamePhase["LOBBY"] = "LOBBY";
    GamePhase["DEAL"] = "DEAL";
    GamePhase["EXCHANGE"] = "EXCHANGE";
    GamePhase["PLAY"] = "PLAY";
    GamePhase["RESULTS"] = "RESULTS";
})(GamePhase || (exports.GamePhase = GamePhase = {}));
class Card extends schema_1.Schema {
    suit;
    rank;
    constructor(suit, rank) {
        super();
        this.suit = suit;
        this.rank = rank;
    }
}
exports.Card = Card;
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], Card.prototype, "suit", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], Card.prototype, "rank", void 0);
class Player extends schema_1.Schema {
    id;
    username;
    connected = true;
    isReady = false;
    role = "NEUTRE"; // PRESIDENT, VICE_PRESIDENT, NEUTRE, VICE_TDC, TDC
    handCount = 0;
    hand = new schema_1.ArraySchema();
    constructor(id, username) {
        super();
        this.id = id;
        this.username = username;
    }
}
exports.Player = Player;
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], Player.prototype, "id", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], Player.prototype, "username", void 0);
__decorate([
    (0, schema_1.type)("boolean"),
    __metadata("design:type", Boolean)
], Player.prototype, "connected", void 0);
__decorate([
    (0, schema_1.type)("boolean"),
    __metadata("design:type", Boolean)
], Player.prototype, "isReady", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], Player.prototype, "role", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], Player.prototype, "handCount", void 0);
__decorate([
    (0, schema_1.type)([Card]),
    __metadata("design:type", Object)
], Player.prototype, "hand", void 0);
class GameState extends schema_1.Schema {
    phase = GamePhase.LOBBY;
    code = ""; // 4-char display code
    currentTurnPlayerId = "";
    players = new schema_1.MapSchema();
    currentTrick = new schema_1.ArraySchema();
    lastTrickWinnerId = "";
    consecutivePasses = 0;
    finishedPlayers = new schema_1.ArraySchema();
    // Configuration
    minPlayers = 3;
    maxPlayers = 7;
    // Révolution
    reversed = false;
    // Multi-manche
    roundNumber = 0;
    // Type du pli courant (single, pair, triple, quad, sequence)
    currentTrickType = "";
    // Track identical cards played to force next player / close trick
    activeConsecutiveCards = 0;
    isForcedRank = "";
}
exports.GameState = GameState;
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], GameState.prototype, "phase", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], GameState.prototype, "code", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], GameState.prototype, "currentTurnPlayerId", void 0);
__decorate([
    (0, schema_1.type)({ map: Player }),
    __metadata("design:type", Object)
], GameState.prototype, "players", void 0);
__decorate([
    (0, schema_1.type)([Card]),
    __metadata("design:type", Object)
], GameState.prototype, "currentTrick", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], GameState.prototype, "lastTrickWinnerId", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], GameState.prototype, "consecutivePasses", void 0);
__decorate([
    (0, schema_1.type)(["string"]),
    __metadata("design:type", Object)
], GameState.prototype, "finishedPlayers", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], GameState.prototype, "minPlayers", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], GameState.prototype, "maxPlayers", void 0);
__decorate([
    (0, schema_1.type)("boolean"),
    __metadata("design:type", Boolean)
], GameState.prototype, "reversed", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], GameState.prototype, "roundNumber", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], GameState.prototype, "currentTrickType", void 0);
__decorate([
    (0, schema_1.type)("number"),
    __metadata("design:type", Number)
], GameState.prototype, "activeConsecutiveCards", void 0);
__decorate([
    (0, schema_1.type)("string"),
    __metadata("design:type", String)
], GameState.prototype, "isForcedRank", void 0);
