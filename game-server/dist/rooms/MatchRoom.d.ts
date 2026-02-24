import { Room, Client } from "colyseus";
import { GameState } from "./schema/GameState";
export declare class MatchRoom extends Room<GameState> {
    maxClients: number;
    private playerHands;
    private plainTrick;
    private plainFinished;
    private losers;
    private lastTrickWinnerId;
    private consecutivePasses;
    private config;
    private turnTimer;
    private previousRoles;
    static activeRooms: Map<string, {
        roomId: string;
        code: string;
        clients: number;
        maxClients: number;
    }>;
    static generateRoomId(): string;
    isPlayerFinished(sessionId: string): boolean;
    checkPlayerFinished(sessionId: string, hand: any[], playedCards: any[]): void;
    broadcastState(): void;
    onCreate(options: any): void;
    startRound(): void;
    performExchanges(playerIds: string[]): void;
    findPlayerByRole(role: string): string | null;
    nextTurn(passed?: boolean): void;
    /**
     * Set the current player, skipping to next active if the player has finished.
     */
    setCurrentPlayer(sessionId: string): void;
    startTurnTimer(): void;
    clearTurnTimer(): void;
    endRound(): void;
    assignRoles(): void;
    resortAllHands(): void;
    onJoin(client: Client, options: any): Promise<void>;
    onLeave(client: Client, consented: boolean): Promise<void>;
    onDispose(): void;
}
//# sourceMappingURL=MatchRoom.d.ts.map