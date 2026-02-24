import { Room, Client } from "colyseus";
import { ArraySchema } from "@colyseus/schema";
import { GameState, Player, GamePhase, Card } from "./schema/GameState";
import { Deck } from "./logic/Deck";
import { Rules } from "./logic/Rules";

export class MatchRoom extends Room<GameState> {
    maxClients = 7;

    static activeRooms: Map<string, { roomId: string; code: string; clients: number; maxClients: number }> = new Map();

    static generateRoomId(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (I, O, 0, 1)
        let id = '';
        for (let i = 0; i < 4; i++) {
            id += chars[Math.floor(Math.random() * chars.length)];
        }
        return id;
    }

    onCreate(options: any) {
        this.setState(new GameState());
        const code = options.code || MatchRoom.generateRoomId();
        this.state.code = code;
        this.setMetadata({ code });

        // Explicitly unlock so joinById always works.
        // In Colyseus 0.15, rooms created via client.create() can end up locked
        // (matchmaker protection), which blocks joinById for other players.
        this.unlock();

        // Register in in-memory registry
        MatchRoom.activeRooms.set(this.roomId, {
            roomId: this.roomId,
            code,
            clients: 0,
            maxClients: this.maxClients
        });
        console.log('[registry] room created:', this.roomId, 'code:', code);

        if (options.maxPlayers) {
            this.maxClients = options.maxPlayers;
            this.state.maxPlayers = options.maxPlayers;
        }

        this.onMessage("start_game", (client, message) => {
            if (this.state.players.get(client.sessionId)?.id !== this.state.players.keys().next().value) {
                return; // Only host can start
            }
            if (this.state.players.size < this.state.minPlayers) {
                client.send("error", { message: "Not enough players" });
                return;
            }
            this.state.phase = GamePhase.DEAL;
            this.broadcast("game_started");

            // Deal cards
            const deck = new Deck();
            deck.shuffle();
            const hands = deck.deal(this.state.players.size);

            let i = 0;
            this.state.players.forEach((player) => {
                player.hand = new ArraySchema<Card>(...hands[i]);
                player.handCount = player.hand.length;
                i++;
            });

            this.state.phase = GamePhase.PLAY;
            // TODO: Determine starting player (3 of Clubs)

        });

        this.onMessage("play_card", (client, message: { cards: Card[] }) => {
            if (this.state.phase !== GamePhase.PLAY) return;

            const player = this.state.players.get(client.sessionId);
            if (!player || player.id !== this.state.currentTurnPlayerId) return;

            // Validate move
            // Note: message.cards needs to be mapped to actual Card objects or validated
            // For simplicity here assuming message.cards contains {suit, rank} objects
            const playedCards = message.cards.map(c => new Card(c.suit, c.rank));

            // Verify player has these cards
            // TODO: Implement verification

            if (Rules.isValidMove(playedCards, [...this.state.currentTrick])) {
                // Remove cards from hand
                // TODO: Implement removal (filtering out played cards)
                // For now, just reducing count for visual
                player.handCount -= playedCards.length;

                // Update trick
                this.state.currentTrick.clear();
                this.state.currentTrick.push(...playedCards);
                this.state.lastTrickWinnerId = player.id;
                this.state.consecutivePasses = 0;

                // Check if player finished
                if (player.handCount === 0) {
                    this.state.finishedPlayers.push(player.id);
                    // TODO: Assign role based on finish order
                }

                // Next turn
                this.nextTurn();
            } else {
                client.send("error", { message: "Invalid move" });
            }
        });

        this.onMessage("pass", (client) => {
            if (this.state.phase !== GamePhase.PLAY) return;
            const player = this.state.players.get(client.sessionId);
            if (!player || player.id !== this.state.currentTurnPlayerId) return;

            this.nextTurn(true);
        });

        this.onMessage("exchange_cards", (client, message: { cards: Card[] }) => {
            if (this.state.phase !== GamePhase.EXCHANGE) return;
            // TODO: Implement exchange logic (swapping cards between players)
            // This requires tracking who exchanged with whom

            // For MVP/Prototype, let's just skip to DEAL for now when everyone is ready
        });

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
        if (passed) {
            this.state.consecutivePasses++;
        }

        const activePlayers = Array.from(this.state.players.values()).filter(p => !this.state.finishedPlayers.includes(p.id));

        // Check if trick is over (everyone passed except winner)
        if (this.state.consecutivePasses >= activePlayers.length - 1 && this.state.currentTrick.length > 0) {
            // Trick finished, winner starts new trick
            this.state.currentTrick.clear();
            this.state.consecutivePasses = 0;

            // Winner starts
            // If winner finished, next active player starts (simple rule for now)
            if (this.state.finishedPlayers.includes(this.state.lastTrickWinnerId)) {
                // Find next active player
                // This is a simplification, usually it passes to next player
                this.state.currentTurnPlayerId = activePlayers[0]?.id || "";
            } else {
                this.state.currentTurnPlayerId = this.state.lastTrickWinnerId;
            }
            return;
        }

        // Check if round is over (only 1 player left)
        if (activePlayers.length <= 1) {
            this.state.phase = GamePhase.RESULTS;
            // Add last player to finished
            if (activePlayers.length === 1) {
                this.state.finishedPlayers.push(activePlayers[0].id);
            }
            // Trigger Role Assignment
            this.assignRoles();
            return;
        }

        // Find next player
        const playerIds = Array.from(this.state.players.keys());
        let currentIndex = playerIds.findIndex(id => this.state.players.get(id)?.id === this.state.currentTurnPlayerId);

        let nextIndex = (currentIndex + 1) % playerIds.length;
        let nextPlayer = this.state.players.get(playerIds[nextIndex]);

        // Skip finished players
        while (nextPlayer && this.state.finishedPlayers.includes(nextPlayer.id)) {
            nextIndex = (nextIndex + 1) % playerIds.length;
            nextPlayer = this.state.players.get(playerIds[nextIndex]);
        }

        this.state.currentTurnPlayerId = nextPlayer?.id || "";
    }

    assignRoles() {
        const playerCount = this.state.players.size;
        const finishedOrder = this.state.finishedPlayers;

        // Assign roles based on finish order
        // 1st -> PRESIDENT
        // 2nd -> VICE_PRESIDENT (if enough players)
        // Last -> TDC
        // 2nd Last -> VICE_TDC (if enough players)

        finishedOrder.forEach((playerId, index) => {
            const player = Array.from(this.state.players.values()).find(p => p.id === playerId);
            if (!player) return;

            if (index === 0) player.role = "PRESIDENT";
            else if (index === playerCount - 1) player.role = "TDC";
            else if (index === 1 && playerCount >= 4) player.role = "VICE_PRESIDENT";
            else if (index === playerCount - 2 && playerCount >= 4) player.role = "VICE_TDC";
            else player.role = "NEUTRE";
        });

        this.state.phase = GamePhase.EXCHANGE;
        // In a real game, we would wait for players to see results, then start exchange
        // For now, we can just wait for 'ready' or 'exchange_cards' messages
    }

    onJoin(client: Client, options: any) {
        console.log(client.sessionId, "joined!");
        const player = new Player(client.sessionId, options.username || "Anonymous");
        this.state.players.set(client.sessionId, player);
        // Update client count in registry
        const reg = MatchRoom.activeRooms.get(this.roomId);
        if (reg) reg.clients = this.clients.length;

        this.broadcast("chat_message", {
            sender: "🎮 Système",
            text: `${player.username} a rejoint la partie !`,
            timestamp: Date.now()
        });
    }

    onLeave(client: Client, consented: boolean) {
        console.log(client.sessionId, "left!");
        const player = this.state.players.get(client.sessionId);
        if (player) {
            player.connected = false;
        }

        try {
            if (consented) {
                throw new Error("consented leave");
            }
            // Allow reconnection for 60 seconds
            // await this.allowReconnection(client, 60);
            // player.connected = true;
        } catch (e) {
            this.state.players.delete(client.sessionId);
        }
    }

    onDispose() {
        console.log("room", this.roomId, "disposing...");
        MatchRoom.activeRooms.delete(this.roomId);
        console.log('[registry] room removed:', this.roomId);
    }
}
