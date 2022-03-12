import { Router, Response } from "express";

import * as games from "./games";
import { GameErrorReason, isGameError } from "./GameError";

const router = Router();

const handleError = (err: unknown, res: Response) => {
  if (isGameError(err)) {
    res.status(err.getHttpStatus()).json(err.toJson());
  } else {
    res.sendStatus(500);
  }
};

router.post("/game", (req, res) => {
  const gameId = games.createGame();
  res.status(201).json({ gameId }).end();
});

router.post("/game/:gameId/player", async (req, res) => {
  const gameId = req.params.gameId;
  const playerName = req.body.name;
  if (typeof playerName === "string") {
    try {
      const playerId = await games.addPlayer(
        gameId,
        playerName,
        async (playerId) => {
          if (!req.session.games) {
            req.session.games = {};
          }
          req.session.games[gameId] = playerId;
          await req.session.save();
        }
      );
      res.json(games.getPrivateState(gameId, playerId));
    } catch (err: unknown) {
      handleError(err, res);
    }
  }
});

router.post("/game/:gameId/start", (req, res) => {
  const gameId = req.params.gameId;
  try {
    const playerId = games.startGame(gameId);
    res.sendStatus(200);
  } catch (err: unknown) {
    handleError(err, res);
  }
});

router.get("/game/:gameId", (req, res) => {
  const gameId = req.params.gameId;
  const playerId = req.session.games?.[gameId] ?? null;
  try {
    if (playerId !== null) {
      const state = games.getPrivateState(gameId, playerId);
      res.json(state);
    } else {
      const state = games.getPublicState(gameId);
      res.json(state);
    }
  } catch (err: unknown) {
    handleError(err, res);
  }
});

router.post("/game/:gameId/action", (req, res) => {
  const gameId = req.params.gameId;
  const playerId = req.session.games?.[gameId] ?? null;
  const action = req.body.action;
  const args = req.body.args;
  if (playerId !== null) {
    try {
      games.executeAction(gameId, playerId, action, args);
      res.sendStatus(200);
    } catch (err: unknown) {
      handleError(err, res);
    }
  } else {
    res.status(400).json({ reason: GameErrorReason.NotAPlayer });
  }
});

export default router;
