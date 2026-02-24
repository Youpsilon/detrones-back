import { Room, Client } from "colyseus";
import { ArraySchema } from "@colyseus/schema";
import { GameState, Player, GamePhase, Card } from "./schema/GameState";
import { Deck } from "./logic/Deck";
import { Rules } from "./logic/Rules";

export class MatchRoom extends Room<GameState> {
    maxClients = 7;

    // Store hands as plain arrays OUTSIDE the Schema (avoids Schema v2 encoding issues)
    private playerHands: Map<string, { suit: string; rank: string }[]> = new Map();

    static activeRooms: Map<string, { roomId: string; code: string; clients: number; maxClients: number }> = new Map();

    static generateRoomId(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let id = '';
        for (let i = 0; i < 4; i++) {
            id += chars[Math.floor(Math.random() * chars.length)];
        }
        return id;
    }

    broadcastState() {
        const players: any[] = [];
        this.state.players.forEach((p, key) => {
            const hand = this.playerHands.get(key) || [];
            players.push({
                id: p.id,
                sessionId: key,
                username: p.username,
                connected: p.connected,
                role: p.role,
                handCount: hand.length,
            });
        });

        // Current trick from plain array
        const shared = {
            phase: this.state.phase,
            code: this.state.code,
            currentTurnPlayerId: this.state.currentTurnPlayerId,
            currentTrick: this.plainTrick,
            players,
            finishedPlayers: [...this.plainFinished],
        };

        this.broadcast("state_update", shared);

        // Send each player their own hand privately
        this.clients.forEach(client => {
            const hand = this.playerHands.get(client.sessionId) || [];
            client.send("my_hand", hand);
        });
    }

    // Plain data storage (bypass Schema entirely for game data)
    private plainTrick: { suit: string; rank: string }[] = [];
    private plainFinished: string[] = [];
    private lastTrickWinnerId: string = "";
    private consecutivePasses: number = 0;

    onCreate(options: any) {
        this.setState(new GameState());
        const code = options.code || MatchRoom.generateRoomId();
        this.state.code = code;
        this.state.phase = GamePhase.LOBBY;
        this.setMetadata({ code });
        this.unlock();

        MatchRoom.activeRooms.set(this.roomId, {
            roomId: this.roomId,
            code,
            clients: 0,
            maxClients: this.maxClients
        });
        console.log('[registry] room created:', this.roomId, 'code:', code);

        if (options.maxPlayers) {
            this.maxClients = options.maxPlayers;
        }

        // ─── start_game ──────────────────────────────────────────────────
        this.onMessage("start_game", (client) => {
            const firstKey = this.state.players.keys().next().value;
            if (client.sessionId !== firstKey) return;

            const playerCount = this.state.players.size;
            if (playerCount < 3) {
                client.send("error", { message: "Not enough players (min 3)" });
                return;
            }

            // Deal cards
            const deck = new Deck();
            deck.shuffle();
            const playerIds = Array.from(this.state.players.keys());
            const hands = deck.deal(playerIds.length);

            playerIds.forEach((sessionId, i) => {
                // Store hand as plain objects
                const plainHand = hands[i].map(c => ({ suit: c.suit, rank: c.rank }));
                this.playerHands.set(sessionId, plainHand);
                console.log(`[deal] ${this.state.players.get(sessionId)!.username}: ${plainHand.length} cards`);
            });

            // Find who has 3♣
            let starterSessionId = playerIds[0];
            for (const sessionId of playerIds) {
                const hand = this.playerHands.get(sessionId)!;
                if (hand.some(c => c.rank === '3' && c.suit === 'C')) {
                    starterSessionId = sessionId;
                    break;
                }
            }

            this.state.currentTurnPlayerId = starterSessionId;
            this.state.phase = GamePhase.PLAY;
            this.plainTrick = [];
            this.plainFinished = [];
            this.consecutivePasses = 0;

            console.log('[game] Started, first player:', this.state.players.get(starterSessionId)!.username);
            this.broadcastState();
        });

        // ─── play_card ───────────────────────────────────────────────────
        this.onMessage("play_card", (client, message: { cards: { suit: string; rank: string }[] }) => {
            if (this.state.phase !== GamePhase.PLAY) return;
            if (client.sessionId !== this.state.currentTurnPlayerId) return;

            const hand = this.playerHands.get(client.sessionId);
            if (!hand) return;

            // Validate all cards exist in hand
            for (const pc of message.cards) {
                const found = hand.some(c => c.suit === pc.suit && c.rank === pc.rank);
                if (!found) {
                    client.send("error", { message: "Card not in hand" });
                    return;
                }
            }

            // Build Card objects for rule validation
            const playedCards = message.cards.map(c => new Card(c.suit, c.rank));
            const trickCards = this.plainTrick.map(c => new Card(c.suit, c.rank));

            if (!Rules.isValidMove(playedCards, trickCards)) {
                client.send("error", { message: "Invalid move" });
                return;
            }

            // Remove played cards from hand
            for (const pc of message.cards) {
                const idx = hand.findIndex(c => c.suit === pc.suit && c.rank === pc.rank);
                if (idx !== -1) hand.splice(idx, 1);
            }

            // Update trick
            this.plainTrick = message.cards.map(c => ({ suit: c.suit, rank: c.rank }));
            this.lastTrickWinnerId = client.sessionId;
            this.consecutivePasses = 0;

            // Check if player finished
            if (hand.length === 0) {
                this.plainFinished.push(client.sessionId);
            }

            this.nextTurn();
            this.broadcastState();
        });

        // ─── pass ────────────────────────────────────────────────────────
        this.onMessage("pass", (client) => {
            if (this.state.phase !== GamePhase.PLAY) return;
            if (client.sessionId !== this.state.currentTurnPlayerId) return;
            this.nextTurn(true);
            this.broadcastState();
        });

        // ─── chat ────────────────────────────────────────────────────────
        this.onMessage("chat_message", (client, message: { text: string }) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;
            this.broadcast("chat_message", {
                sender: player.username,
                text: message.text,
                timestamp: Date.now()
            });
        });
    }

    nextTurn(passed: boolean = false) {
        if (passed) this.consecutivePasses++;

        const playerIds = Array.from(this.state.players.keys())
            .filter(id => !this.plainFinished.includes(id));

        // Trick finished (everyone passed except last player)
        if (this.consecutivePasses >= playerIds.length - 1 && this.plainTrick.length > 0) {
            this.plainTrick = [];
            this.consecutivePasses = 0;
            // Winner starts next trick
            if (this.plainFinished.includes(this.lastTrickWinnerId)) {
                this.state.currentTurnPlayerId = playerIds[0] || "";
            } else {
                this.state.currentTurnPlayerId = this.lastTrickWinnerId;
            }
            return;
        }

        // Round over
        if (playerIds.length <= 1) {
            this.state.phase = GamePhase.RESULTS;
            if (playerIds.length === 1) {
                this.plainFinished.push(playerIds[0]);
            }
            this.assignRoles();
            return;
        }

        // Next player
        const allKeys = Array.from(this.state.players.keys());
        let currentIndex = allKeys.indexOf(this.state.currentTurnPlayerId);
        let nextIndex = (currentIndex + 1) % allKeys.length;

        // Skip finished players
        let attempts = 0;
        while (this.plainFinished.includes(allKeys[nextIndex]) && attempts < allKeys.length) {
            nextIndex = (nextIndex + 1) % allKeys.length;
            attempts++;
        }

        this.state.currentTurnPlayerId = allKeys[nextIndex];
    }

    assignRoles() {
        const playerCount = this.state.players.size;
        this.plainFinished.forEach((sessionId, index) => {
            const player = this.state.players.get(sessionId);
            if (!player) return;
            if (index === 0) player.role = "PRESIDENT";
            else if (index === playerCount - 1) player.role = "TDC";
            else if (index === 1 && playerCount >= 4) player.role = "VICE_PRESIDENT";
            else if (index === playerCount - 2 && playerCount >= 4) player.role = "VICE_TDC";
            else player.role = "NEUTRE";
        });
        this.broadcastState();
    }

    async onJoin(client: Client, options: any) {
        console.log(client.sessionId, "joined!");
        const player = new Player(client.sessionId, options.username || "Anonymous");
        this.state.players.set(client.sessionId, player);

        const reg = MatchRoom.activeRooms.get(this.roomId);
        if (reg) reg.clients = this.clients.length;

        this.broadcast("chat_message", {
            sender: "🎮 Système",
            text: `${player.username} a rejoint la partie !`,
            timestamp: Date.now()
        });

        this.broadcastState();
    }

    async onLeave(client: Client, consented: boolean) {
        console.log(client.sessionId, "left!", consented ? "(consented)" : "(disconnected)");
        const player = this.state.players.get(client.sessionId);
        if (player) player.connected = false;
        this.broadcastState();

        if (!consented) {
            try {
                console.log(`[reconnect] waiting for ${client.sessionId}...`);
                await this.allowReconnection(client, 120);
                console.log(`[reconnect] ${client.sessionId} reconnected!`);
                if (player) player.connected = true;
                this.broadcastState();
                return;
            } catch (e) {
                console.log(`[reconnect] ${client.sessionId} timed out`);
            }
        }

        // Remove player
        this.state.players.delete(client.sessionId);
        this.playerHands.delete(client.sessionId);
        const reg = MatchRoom.activeRooms.get(this.roomId);
        if (reg) reg.clients = this.clients.length;
        this.broadcastState();
    }

    onDispose() {
        console.log("room", this.roomId, "disposing...");
        MatchRoom.activeRooms.delete(this.roomId);
        console.log('[registry] room removed:', this.roomId);
    }
}
