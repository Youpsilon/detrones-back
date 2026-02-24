import { LobbyRoom } from "colyseus";
import { MatchRoom } from "./rooms/MatchRoom";
import { monitor } from "@colyseus/monitor";
import config from "@colyseus/tools";
export default config({
    initializeGameServer: (gameServer) => {
        gameServer.define('lobby', LobbyRoom);
        gameServer.define('match', MatchRoom);
    },
    initializeExpress: (app) => {
        app.use("/colyseus", monitor());
    },
});
