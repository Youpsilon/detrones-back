"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchRoom = void 0;
const colyseus_1 = require("colyseus");
const GameState_1 = require("./schema/GameState");
const Deck_1 = require("./logic/Deck");
const Rules_1 = require("./logic/Rules");
const GameConfig_1 = require("./logic/GameConfig");
class MatchRoom extends colyseus_1.Room {
    maxClients = 7;
    // ── Plain data (bypass Schema encoding issues) ──────────────────
    playerHands = new Map();
    plainTrick = [];
    plainFinished = [];
    losers = [];
    lastTrickWinnerId = "";
    consecutivePasses = 0;
    // ── Configuration ───────────────────────────────────────────────
    config = (0, GameConfig_1.buildConfig)();
    // ── Turn timeout handle ─────────────────────────────────────────
    turnTimer = null;
    // ── Previous round roles (for exchanges) ────────────────────────
    previousRoles = new Map();
    // ── Registry ────────────────────────────────────────────────────
    static activeRooms = new Map();
    static generateRoomId() {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let id = "";
        for (let i = 0; i < 4; i++) {
            id += chars[Math.floor(Math.random() * chars.length)];
        }
        return id;
    }
    isPlayerFinished(sessionId) {
        return this.plainFinished.includes(sessionId) || this.losers.includes(sessionId);
    }
    checkPlayerFinished(sessionId, hand, playedCards) {
        if (hand.length === 0) {
            const finishedWithTwo = playedCards.some((c) => c.rank === "2");
            if (finishedWithTwo) {
                this.losers.push(sessionId);
                const player = this.state.players.get(sessionId);
                this.broadcast("chat_message", {
                    sender: "🎮 Système",
                    text: `⚠️ ${player?.username || "Un joueur"} a fini avec un 2 ! Il est condamné à être Trou du Cul.`,
                    timestamp: Date.now(),
                });
            }
            else {
                this.plainFinished.push(sessionId);
            }
        }
    }
    /* ================================================================
     *  BROADCAST
     * ================================================================ */
    broadcastState() {
        const players = [];
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
        const shared = {
            phase: this.state.phase,
            code: this.state.code,
            currentTurnPlayerId: this.state.currentTurnPlayerId,
            currentTrick: this.plainTrick,
            currentTrickType: this.state.currentTrickType,
            players,
            finishedPlayers: [...this.plainFinished, ...this.losers.slice().reverse()],
            reversed: this.state.reversed,
            roundNumber: this.state.roundNumber,
            config: this.config,
        };
        this.broadcast("state_update", shared);
        // Send each player their own hand privately
        this.clients.forEach(client => {
            const hand = this.playerHands.get(client.sessionId) || [];
            client.send("my_hand", hand);
        });
    }
    /* ================================================================
     *  ON CREATE
     * ================================================================ */
    onCreate(options) {
        this.setState(new GameState_1.GameState());
        const code = options.code || MatchRoom.generateRoomId();
        this.state.code = code;
        this.state.phase = GameState_1.GamePhase.LOBBY;
        this.setMetadata({ code });
        this.unlock();
        // Build config from options
        this.config = (0, GameConfig_1.buildConfig)(options.config || {});
        this.maxClients = this.config.maxPlayers;
        this.state.minPlayers = this.config.minPlayers;
        this.state.maxPlayers = this.config.maxPlayers;
        MatchRoom.activeRooms.set(this.roomId, {
            roomId: this.roomId,
            code,
            clients: 0,
            maxClients: this.maxClients,
        });
        console.log("[registry] room created:", this.roomId, "code:", code);
        // ─── start_game ──────────────────────────────────────────────
        this.onMessage("start_game", (client) => {
            const firstKey = this.state.players.keys().next().value;
            if (client.sessionId !== firstKey)
                return;
            const playerCount = this.state.players.size;
            if (playerCount < this.config.minPlayers) {
                client.send("error", { message: `Not enough players (min ${this.config.minPlayers})` });
                return;
            }
            this.startRound();
        });
        // ─── next_round ──────────────────────────────────────────────
        this.onMessage("next_round", (client) => {
            if (this.state.phase !== GameState_1.GamePhase.RESULTS)
                return;
            const firstKey = this.state.players.keys().next().value;
            if (client.sessionId !== firstKey)
                return;
            this.startRound();
        });
        // ─── play_card ───────────────────────────────────────────────
        this.onMessage("play_card", (client, message) => {
            if (this.state.phase !== GameState_1.GamePhase.PLAY)
                return;
            if (client.sessionId !== this.state.currentTurnPlayerId)
                return;
            const hand = this.playerHands.get(client.sessionId);
            if (!hand)
                return;
            // Validate all cards exist in hand
            for (const pc of message.cards) {
                const found = hand.some(c => c.suit === pc.suit && c.rank === pc.rank);
                if (!found) {
                    client.send("error", { message: "Card not in hand" });
                    return;
                }
            }
            // Build Card objects for rule validation
            const playedCards = message.cards.map(c => new GameState_1.Card(c.suit, c.rank));
            const trickCards = this.plainTrick.map(c => new GameState_1.Card(c.suit, c.rank));
            if (!Rules_1.Rules.isValidMove(playedCards, trickCards, this.config, this.state.reversed, this.state.isForcedRank, this.state.activeConsecutiveCards)) {
                client.send("error", { message: "Invalid move" });
                return;
            }
            // Remove played cards from hand
            for (const pc of message.cards) {
                const idx = hand.findIndex(c => c.suit === pc.suit && c.rank === pc.rank);
                if (idx !== -1)
                    hand.splice(idx, 1);
            }
            const comboType = Rules_1.Rules.getCombinationType(playedCards, this.config);
            // ── Special 2: burns the trick ──
            if (this.config.enableSpecialTwo && playedCards.every(c => c.rank === "2")) {
                this.plainTrick = [];
                this.state.currentTrickType = "";
                this.state.activeConsecutiveCards = 0;
                this.state.isForcedRank = "";
                this.consecutivePasses = 0;
                this.lastTrickWinnerId = client.sessionId;
                // Check if player finished
                this.checkPlayerFinished(client.sessionId, hand, message.cards);
                // Same player leads again (if still in game)
                this.setCurrentPlayer(client.sessionId);
                this.broadcastState();
                return;
            }
            // ── Quad / Revolution ──
            if (comboType === "quad" && this.config.enableRevolution) {
                // Toggle reversed order
                this.state.reversed = !this.state.reversed;
                console.log(`[revolution] Order is now ${this.state.reversed ? "REVERSED" : "NORMAL"}`);
                this.broadcast("chat_message", {
                    sender: "🎮 Système",
                    text: `💥 RÉVOLUTION ! L'ordre des cartes est maintenant ${this.state.reversed ? "inversé" : "normal"} !`,
                    timestamp: Date.now(),
                });
                if (this.config.revolutionResetsTrick) {
                    // Quad resets the trick → player leads again
                    this.plainTrick = [];
                    this.state.currentTrickType = "";
                    this.state.activeConsecutiveCards = 0;
                    this.state.isForcedRank = "";
                    this.consecutivePasses = 0;
                    this.lastTrickWinnerId = client.sessionId;
                    this.checkPlayerFinished(client.sessionId, hand, message.cards);
                    this.setCurrentPlayer(client.sessionId);
                    // Re-sort everyone's hands with new order
                    this.resortAllHands();
                    this.broadcastState();
                    return;
                }
                // Re-sort everyone's hands with new order
                this.resortAllHands();
            }
            // ── Normal play & Consecutive/Quad Check ──
            // If the trick continues, check if the played rank matches the trick rank
            let newConsecutiveCount = message.cards.length;
            if (this.plainTrick.length > 0 && this.plainTrick[0].rank === message.cards[0].rank) {
                newConsecutiveCount += this.state.activeConsecutiveCards;
            }
            this.plainTrick = message.cards.map(c => ({ suit: c.suit, rank: c.rank }));
            this.state.currentTrickType = comboType;
            this.state.activeConsecutiveCards = newConsecutiveCount;
            this.lastTrickWinnerId = client.sessionId;
            this.consecutivePasses = 0;
            // Update forced rank logic (if 2 identical combos are played consecutively)
            if (this.state.activeConsecutiveCards >= message.cards.length * 2 && this.state.activeConsecutiveCards < 4) {
                this.state.isForcedRank = message.cards[0].rank;
            }
            else {
                this.state.isForcedRank = "";
            }
            // Check if player finished
            this.checkPlayerFinished(client.sessionId, hand, message.cards);
            // ── Trick closed by quad accumulation ──
            if (this.state.activeConsecutiveCards >= 4) {
                this.broadcast("chat_message", {
                    sender: "🎮 Système",
                    text: `🔥 Un carré s'est formé sur le pli ! Le pli est ramassé. (Si Révolution activée, elle a lieu !)`,
                    timestamp: Date.now(),
                });
                if (this.config.enableRevolution) {
                    this.state.reversed = !this.state.reversed;
                    this.resortAllHands();
                }
                this.plainTrick = [];
                this.state.currentTrickType = "";
                this.state.activeConsecutiveCards = 0;
                this.state.isForcedRank = "";
                this.consecutivePasses = 0;
                this.setCurrentPlayer(client.sessionId);
                this.broadcastState();
                return;
            }
            this.nextTurn();
            this.broadcastState();
        });
        // ─── pass ────────────────────────────────────────────────────
        this.onMessage("pass", (client) => {
            if (this.state.phase !== GameState_1.GamePhase.PLAY)
                return;
            if (client.sessionId !== this.state.currentTurnPlayerId)
                return;
            this.nextTurn(true);
            this.broadcastState();
        });
        // ─── exchange_select (for manual exchange selection) ─────────
        this.onMessage("exchange_done", (client) => {
            // For now, exchanges are automatic. This message is an acknowledgement.
            // Could be extended to allow manual selection in the future.
        });
        // ─── abandon ─────────────────────────────────────────────────
        this.onMessage("abandon", (client) => {
            if (this.state.phase !== GameState_1.GamePhase.PLAY)
                return;
            const player = this.state.players.get(client.sessionId);
            if (!player)
                return;
            console.log(`[abandon] ${player.username} has abandoned`);
            this.broadcast("chat_message", {
                sender: "🎮 Système",
                text: `${player.username} a abandonné la partie.`,
                timestamp: Date.now(),
            });
            if (this.config.abandonBehavior === "mmr_loss") {
                // Remove the player from the active players: they finish last
                if (!this.isPlayerFinished(client.sessionId)) {
                    this.losers.push(client.sessionId);
                    const activePlayers = Array.from(this.state.players.keys())
                        .filter(id => !this.isPlayerFinished(id));
                    if (activePlayers.length <= 1) {
                        if (activePlayers.length === 1) {
                            this.plainFinished.push(activePlayers[0]);
                        }
                        this.endRound();
                    }
                }
            }
            else {
                // "bot" behavior: mark as bot-controlled, auto-pass each turn
                player.username = `🤖 ${player.username}`;
                player.connected = false;
                // The bot will auto-pass on its turns (handled in startTurnTimer)
            }
            this.broadcastState();
        });
        // ─── chat ────────────────────────────────────────────────────
        this.onMessage("chat_message", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (!player)
                return;
            this.broadcast("chat_message", {
                sender: player.username,
                text: message.text,
                timestamp: Date.now(),
            });
        });
    }
    /* ================================================================
     *  START ROUND
     * ================================================================ */
    startRound() {
        this.state.roundNumber++;
        const isFirstRound = this.state.roundNumber === 1;
        // Save roles from previous round for exchanges
        if (!isFirstRound) {
            this.previousRoles.clear();
            this.state.players.forEach((p, key) => {
                this.previousRoles.set(key, p.role);
            });
        }
        // Deal cards
        const deck = new Deck_1.Deck();
        deck.shuffle();
        const playerIds = Array.from(this.state.players.keys());
        const hands = deck.deal(playerIds.length);
        playerIds.forEach((sessionId, i) => {
            const plainHand = hands[i].map(c => ({ suit: c.suit, rank: c.rank }));
            // Sort the hand
            Rules_1.Rules.sortHand(plainHand, this.state.reversed);
            this.playerHands.set(sessionId, plainHand);
            console.log(`[deal] ${this.state.players.get(sessionId).username}: ${plainHand.length} cards`);
        });
        // Reset state
        this.plainTrick = [];
        this.plainFinished = [];
        this.losers = [];
        this.consecutivePasses = 0;
        this.state.currentTrickType = "";
        this.state.activeConsecutiveCards = 0;
        this.state.isForcedRank = "";
        // Perform exchanges if not first round and config permits
        if (!isFirstRound && this.config.exchangeCards) {
            this.performExchanges(playerIds);
        }
        // Find starting player
        const starterSessionId = Rules_1.Rules.findStartingPlayer(this.playerHands, this.config, this.state.reversed);
        this.state.currentTurnPlayerId = starterSessionId;
        this.state.phase = GameState_1.GamePhase.PLAY;
        console.log("[game] Round", this.state.roundNumber, "started, first player:", this.state.players.get(starterSessionId).username);
        this.startTurnTimer();
        this.broadcastState();
    }
    /* ================================================================
     *  EXCHANGES
     * ================================================================ */
    performExchanges(playerIds) {
        const presidentId = this.findPlayerByRole("PRESIDENT");
        const tdcId = this.findPlayerByRole("TDC");
        const vpId = this.findPlayerByRole("VICE_PRESIDENT");
        const vtdcId = this.findPlayerByRole("VICE_TDC");
        // Président ↔ TDC : 2 cartes
        if (presidentId && tdcId) {
            const presHand = this.playerHands.get(presidentId);
            const tdcHand = this.playerHands.get(tdcId);
            // TDC gives their 2 best cards to Président
            Rules_1.Rules.exchangeCards(tdcHand, presHand, 2, true, this.state.reversed);
            // Président gives their 2 worst cards to TDC
            Rules_1.Rules.exchangeCards(presHand, tdcHand, 2, false, this.state.reversed);
            // Re-sort both hands
            Rules_1.Rules.sortHand(presHand, this.state.reversed);
            Rules_1.Rules.sortHand(tdcHand, this.state.reversed);
            console.log("[exchange] Président ↔ TDC : 2 cards exchanged");
            this.broadcast("chat_message", {
                sender: "🎮 Système",
                text: "Le Président et le Trou du Cul échangent 2 cartes.",
                timestamp: Date.now(),
            });
        }
        // Vice-Président ↔ Vice-TDC : 1 carte
        if (vpId && vtdcId) {
            const vpHand = this.playerHands.get(vpId);
            const vtdcHand = this.playerHands.get(vtdcId);
            // Vice-TDC gives their 1 best card to Vice-Président
            Rules_1.Rules.exchangeCards(vtdcHand, vpHand, 1, true, this.state.reversed);
            // Vice-Président gives their 1 worst card to Vice-TDC
            Rules_1.Rules.exchangeCards(vpHand, vtdcHand, 1, false, this.state.reversed);
            // Re-sort both hands
            Rules_1.Rules.sortHand(vpHand, this.state.reversed);
            Rules_1.Rules.sortHand(vtdcHand, this.state.reversed);
            console.log("[exchange] Vice-Président ↔ Vice-TDC : 1 card exchanged");
            this.broadcast("chat_message", {
                sender: "🎮 Système",
                text: "Le Vice-Président et le Vice-TDC échangent 1 carte.",
                timestamp: Date.now(),
            });
        }
        // Reset roles to NEUTRE for the new round
        this.state.players.forEach((p) => {
            p.role = "NEUTRE";
        });
    }
    findPlayerByRole(role) {
        for (const [id, prevRole] of this.previousRoles.entries()) {
            if (prevRole === role && this.state.players.has(id)) {
                return id;
            }
        }
        return null;
    }
    /* ================================================================
     *  TURN MANAGEMENT
     * ================================================================ */
    nextTurn(passed = false) {
        this.clearTurnTimer();
        if (passed) {
            this.consecutivePasses++;
            this.state.isForcedRank = "";
        }
        const activePlayers = Array.from(this.state.players.keys())
            .filter(id => !this.isPlayerFinished(id));
        // ── Trick cleared: everyone passed except last player ──
        if (this.consecutivePasses >= activePlayers.length - 1 && this.plainTrick.length > 0) {
            this.plainTrick = [];
            this.state.currentTrickType = "";
            this.state.activeConsecutiveCards = 0;
            this.state.isForcedRank = "";
            this.consecutivePasses = 0;
            // Winner starts next trick
            this.setCurrentPlayer(this.lastTrickWinnerId);
            this.startTurnTimer();
            return;
        }
        // ── Round over: 1 or fewer players remaining ──
        if (activePlayers.length <= 1) {
            if (activePlayers.length === 1) {
                this.plainFinished.push(activePlayers[0]);
            }
            this.endRound();
            return;
        }
        // ── Next active player ──
        const allKeys = Array.from(this.state.players.keys());
        let currentIndex = allKeys.indexOf(this.state.currentTurnPlayerId);
        let nextIndex = (currentIndex + 1) % allKeys.length;
        let attempts = 0;
        while (this.isPlayerFinished(allKeys[nextIndex]) && attempts < allKeys.length) {
            nextIndex = (nextIndex + 1) % allKeys.length;
            attempts++;
        }
        this.state.currentTurnPlayerId = allKeys[nextIndex];
        this.startTurnTimer();
    }
    /**
     * Set the current player, skipping to next active if the player has finished.
     */
    setCurrentPlayer(sessionId) {
        if (this.isPlayerFinished(sessionId)) {
            // This player has already finished; find the next active one
            const allKeys = Array.from(this.state.players.keys());
            let idx = allKeys.indexOf(sessionId);
            let attempts = 0;
            do {
                idx = (idx + 1) % allKeys.length;
                attempts++;
            } while (this.isPlayerFinished(allKeys[idx]) && attempts < allKeys.length);
            const activePlayers = allKeys.filter(id => !this.isPlayerFinished(id));
            if (activePlayers.length <= 1) {
                if (activePlayers.length === 1) {
                    this.plainFinished.push(activePlayers[0]);
                }
                this.endRound();
                return;
            }
            this.state.currentTurnPlayerId = allKeys[idx];
        }
        else {
            this.state.currentTurnPlayerId = sessionId;
        }
        this.startTurnTimer();
    }
    /* ================================================================
     *  TURN TIMER
     * ================================================================ */
    startTurnTimer() {
        this.clearTurnTimer();
        if (this.config.turnTimeoutMs <= 0)
            return;
        const currentPlayerId = this.state.currentTurnPlayerId;
        // Check if current player is a disconnected bot → auto-pass immediately
        const player = this.state.players.get(currentPlayerId);
        if (player && !player.connected) {
            // Bot auto-pass after a short delay for visual feedback
            this.turnTimer = setTimeout(() => {
                if (this.state.currentTurnPlayerId === currentPlayerId) {
                    console.log(`[bot] Auto-pass for ${player.username}`);
                    this.nextTurn(true);
                    this.broadcastState();
                }
            }, 2000);
            return;
        }
        this.turnTimer = setTimeout(() => {
            // Double-check it's still this player's turn
            if (this.state.currentTurnPlayerId === currentPlayerId && this.state.phase === GameState_1.GamePhase.PLAY) {
                console.log(`[timeout] Auto-pass for player ${currentPlayerId}`);
                // Notify the player
                const client = this.clients.find(c => c.sessionId === currentPlayerId);
                if (client) {
                    client.send("error", { message: "Temps écoulé ! Passe automatique." });
                }
                this.broadcast("chat_message", {
                    sender: "🎮 Système",
                    text: `⏱️ Temps écoulé pour ${player?.username || "un joueur"} — passe automatique.`,
                    timestamp: Date.now(),
                });
                this.nextTurn(true);
                this.broadcastState();
            }
        }, this.config.turnTimeoutMs);
    }
    clearTurnTimer() {
        if (this.turnTimer) {
            clearTimeout(this.turnTimer);
            this.turnTimer = null;
        }
    }
    /* ================================================================
     *  END ROUND / ROLES
     * ================================================================ */
    endRound() {
        this.clearTurnTimer();
        this.state.phase = GameState_1.GamePhase.RESULTS;
        this.assignRoles();
    }
    assignRoles() {
        const playerCount = this.state.players.size;
        const ranking = [...this.plainFinished, ...this.losers.slice().reverse()];
        ranking.forEach((sessionId, index) => {
            const player = this.state.players.get(sessionId);
            if (!player)
                return;
            if (index === 0)
                player.role = "PRESIDENT";
            else if (index === playerCount - 1)
                player.role = "TDC";
            else if (index === 1 && playerCount >= 4)
                player.role = "VICE_PRESIDENT";
            else if (index === playerCount - 2 && playerCount >= 4)
                player.role = "VICE_TDC";
            else
                player.role = "NEUTRE";
        });
        let summary = "🏆 **Classement de la manche** 🏆\n";
        ranking.forEach((sessionId, index) => {
            const p = this.state.players.get(sessionId);
            if (p) {
                const icon = p.role === "PRESIDENT" ? "👑" : p.role === "TDC" ? "💩" : "👤";
                summary += `${index + 1}. ${p.username} - ${p.role} ${icon}\n`;
            }
        });
        this.broadcast("chat_message", {
            sender: "🎮 Système",
            text: summary,
            timestamp: Date.now(),
        });
        this.broadcastState();
    }
    /* ================================================================
     *  UTILITY
     * ================================================================ */
    resortAllHands() {
        this.playerHands.forEach((hand, sessionId) => {
            Rules_1.Rules.sortHand(hand, this.state.reversed);
        });
    }
    /* ================================================================
     *  LIFECYCLE
     * ================================================================ */
    async onJoin(client, options) {
        console.log(client.sessionId, "joined!");
        const player = new GameState_1.Player(client.sessionId, options.username || "Anonymous");
        this.state.players.set(client.sessionId, player);
        const reg = MatchRoom.activeRooms.get(this.roomId);
        if (reg)
            reg.clients = this.clients.length;
        this.broadcast("chat_message", {
            sender: "🎮 Système",
            text: `${player.username} a rejoint la partie !`,
            timestamp: Date.now(),
        });
        this.broadcastState();
    }
    async onLeave(client, consented) {
        console.log(client.sessionId, "left!", consented ? "(consented)" : "(disconnected)");
        const player = this.state.players.get(client.sessionId);
        if (player)
            player.connected = false;
        this.broadcastState();
        if (!consented) {
            try {
                console.log(`[reconnect] waiting for ${client.sessionId}...`);
                await this.allowReconnection(client, 120);
                console.log(`[reconnect] ${client.sessionId} reconnected!`);
                if (player)
                    player.connected = true;
                this.broadcastState();
                return;
            }
            catch (e) {
                console.log(`[reconnect] ${client.sessionId} timed out`);
            }
        }
        // If in game, the disconnected player becomes a bot (auto-pass)
        if (this.state.phase === GameState_1.GamePhase.PLAY && player) {
            if (!player.username.startsWith("🤖")) {
                player.username = `🤖 ${player.username}`;
            }
            // If it's their turn, trigger auto-pass
            if (this.state.currentTurnPlayerId === client.sessionId) {
                this.startTurnTimer();
            }
            return; // Don't remove the player while in-game
        }
        // Remove player if in lobby
        this.state.players.delete(client.sessionId);
        this.playerHands.delete(client.sessionId);
        const reg = MatchRoom.activeRooms.get(this.roomId);
        if (reg)
            reg.clients = this.clients.length;
        this.broadcastState();
    }
    onDispose() {
        this.clearTurnTimer();
        console.log("room", this.roomId, "disposing...");
        MatchRoom.activeRooms.delete(this.roomId);
        console.log("[registry] room removed:", this.roomId);
    }
}
exports.MatchRoom = MatchRoom;
