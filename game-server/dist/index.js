"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const colyseus_1 = require("colyseus");
const ws_transport_1 = require("@colyseus/ws-transport");
const monitor_1 = require("@colyseus/monitor");
const MatchRoom_1 = require("./rooms/MatchRoom");
const PORT = Number(process.env.PORT || 2567);
const app = (0, express_1.default)();
// ✅ CORS registered FIRST — before Colyseus attaches its matchmake routes
app.use((0, cors_1.default)({
    origin: true, // Reflect the request origin
    credentials: true, // Allow withCredentials requests from Colyseus.js
}));
app.use(express_1.default.json());
const httpServer = http_1.default.createServer(app);
const gameServer = new colyseus_1.Server({
    transport: new ws_transport_1.WebSocketTransport({
        server: httpServer,
        express: app, // ← Colyseus uses OUR Express app (with cors already registered)
    }),
});
gameServer.define("lobby", colyseus_1.LobbyRoom);
gameServer.define("match", MatchRoom_1.MatchRoom);
// Custom REST endpoints for room listing
app.get("/rooms", (req, res) => {
    res.json([...MatchRoom_1.MatchRoom.activeRooms.values()]);
});
app.get("/roomByCode/:code", (req, res) => {
    const found = [...MatchRoom_1.MatchRoom.activeRooms.values()].find((r) => r.code === req.params.code.toUpperCase());
    if (found) {
        res.json({ roomId: found.roomId, found: true });
    }
    else {
        res.status(404).json({ found: false });
    }
});
app.use("/colyseus", (0, monitor_1.monitor)());
gameServer.listen(PORT).then(() => {
    console.log(`✅ Game server listening on http://localhost:${PORT}`);
}).catch((err) => {
    console.error("Failed to start game server:", err);
    process.exit(1);
});
