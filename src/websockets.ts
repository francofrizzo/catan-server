import { Server } from "http";
import { Request, Response } from "express";
import WebSocket from "ws";

import * as games from "./games";
import session from "./session";
import { GameErrorReason } from "./GameError";

const websocketServer = new WebSocket.Server({
  noServer: true,
});

const parseUrl = (url: string): string | null => {
  const expectedUrl = /^\/game\/([a-z0-9-]+)\/updates$/;

  const match = expectedUrl.exec(url);
  if (match !== null) {
    return match[1];
  }

  return null;
};

websocketServer.on("connection", function connection(connection, req: Request) {
  const gameId = parseUrl(req.url)!; // we checked this is valid before connecting
  if (games.gameExists(gameId)) {
    const playerId = req.session.games?.[gameId] ?? null;
    const state =
      playerId !== null
        ? games.getPrivateState(gameId, playerId)
        : games.getPublicState(gameId);
    connection.send(JSON.stringify({ event: "SUBSCRIBED", state }));

    const handler = games.registerUpdateListener(gameId, (event, payload) => {
      req.session.reload(() => {
        const playerId = req.session.games?.[gameId] ?? null;
        const state =
          playerId !== null
            ? games.getPrivateState(gameId, playerId)
            : games.getPublicState(gameId);
        connection.send(
          JSON.stringify({
            event,
            eventData: payload,
            state,
          })
        );
      });
    });
    connection.on("close", () => handler.unregister());
  } else {
    connection.close(
      1003,
      JSON.stringify({ reason: GameErrorReason.GameNotFound })
    );
  }
});

export const setupWebsockets = (server: Server) => {
  server.on("upgrade", (req: Request, socket, head) => {
    session(req, {} as Response, () => {
      const gameId = parseUrl(req.url);
      if (gameId) {
        websocketServer.handleUpgrade(req, socket, head, (websocket) => {
          websocketServer.emit("connection", websocket, req);
        });
      } else {
        console.error(`Couldn't respond to websockets request on: ${req.url}`);
        socket.end();
      }
    });
  });
};
