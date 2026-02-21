import { generateSlug } from "random-word-slugs";
import {
  isCatanError,
  Action,
  ActionJsonArguments,
  GameInterface,
} from "catan-engine";

import { GameError, GameErrorReason } from "./GameError";

enum GameEvent {
  PlayerAdded = "PLAYER_ADDED",
  PlayerRemoved = "PLAYER_REMOVED",
  GameStarted = "GAME_STARTED",
  ActionExecuted = "ACTION_EXECUTED",
}

type GameEventRegistry = {
  [GameEvent.PlayerAdded]: { id: number; name: string };
  [GameEvent.PlayerRemoved]: { id: number; name: string };
  [GameEvent.GameStarted]: Record<string, never>;
  [GameEvent.ActionExecuted]: {
    action: Action;
    player: { id: number; name: string };
    args: ActionJsonArguments<Action>;
  };
};

type GameEventPayload<E extends GameEvent> = GameEventRegistry[E];

type GameEventCallback = <E extends GameEvent>(
  event: E,
  payload: GameEventPayload<E>
) => void;

export const games: Record<
  string,
  {
    playerNames: string[];
    gameInterface?: GameInterface;
    observers: Array<{ id: number; callback: GameEventCallback }>;
    nextObserverId: number;
    debug: boolean;
  }
> = {};

export function createGame(debug = false): string {
  let gameId: string;
  do {
    gameId = generateSlug();
  } while (Object.keys(games).some((id) => id === gameId));
  const gameEntry = {
    playerNames: [],
    observers: [],
    nextObserverId: 0,
    debug,
  };
  games[gameId] = gameEntry;
  return gameId;
}

export function gameExists(gameId: string): boolean {
  return games[gameId] !== undefined;
}

export function gameIsDebug(gameId: string): boolean {
  return games[gameId] !== undefined && games[gameId].debug;
}

export async function addPlayer(
  gameId: string,
  name: string,
  beforeNotifyingCallback?: (playerId: number) => PromiseLike<void>
): Promise<number> {
  const game = games[gameId];
  if (game) {
    if (game.gameInterface !== undefined) {
      throw new GameError(GameErrorReason.GameAlreadyStarted);
    } else {
      if (game.playerNames.length >= 4) {
        throw new GameError(GameErrorReason.TooManyPlayers);
      } else {
        game.playerNames.push(name);
        const playerId = game.playerNames.length - 1;
        if (beforeNotifyingCallback !== undefined) {
          await beforeNotifyingCallback(playerId);
        }
        notifyListeners(gameId, GameEvent.PlayerAdded, { id: playerId, name });
        return playerId;
      }
    }
  } else {
    throw new GameError(GameErrorReason.GameNotFound);
  }
}

export function removePlayer(gameId: string, playerId: number): void {
  const game = games[gameId];
  if (game) {
    if (game.gameInterface !== undefined) {
      throw new GameError(GameErrorReason.GameAlreadyStarted);
    }
    if (playerId < 0 || playerId >= game.playerNames.length) {
      throw new GameError(GameErrorReason.InvalidArgument);
    }
    const name = game.playerNames[playerId];
    game.playerNames.splice(playerId, 1);
    notifyListeners(gameId, GameEvent.PlayerRemoved, { id: playerId, name });
  } else {
    throw new GameError(GameErrorReason.GameNotFound);
  }
}

export function startGame(gameId: string, autoCollect?: boolean): void {
  const game = games[gameId];
  if (game) {
    if (game.playerNames.length === 3 || game.playerNames.length === 4) {
      const gameInterface = new GameInterface({
        playerNames: game.playerNames as
          | [string, string, string]
          | [string, string, string, string],
        autoCollect: autoCollect !== undefined ? autoCollect : game.debug,
      });
      gameInterface.afterAction((_, action, player, args) => {
        notifyListeners(gameId, GameEvent.ActionExecuted, {
          action,
          player: { id: player.getId(), name: player.getName() },
          args,
        });
      });
      game.gameInterface = gameInterface;
      notifyListeners(gameId, GameEvent.GameStarted, {});
    } else {
      throw new GameError(GameErrorReason.NotEnoughPlayers);
    }
  } else {
    throw new GameError(GameErrorReason.GameNotFound);
  }
}

export function executeAction<A extends Action>(
  gameId: string,
  playerId: number,
  action: A,
  args: ActionJsonArguments<A>
): void {
  const game = games[gameId];
  if (game) {
    if (game.gameInterface !== undefined) {
      try {
        game.gameInterface.executeAction(playerId, action, args);
      } catch (err: unknown) {
        if (isCatanError(err)) {
          throw new GameError(err.reason);
        } else {
          throw new GameError(GameErrorReason.UnknownReason);
        }
      }
    } else {
      throw new GameError(GameErrorReason.GameNotStarted);
    }
  } else {
    throw new GameError(GameErrorReason.GameNotFound);
  }
}

export function getPublicState(gameId: string) {
  const game = games[gameId];
  if (game) {
    if (game.gameInterface === undefined) {
      // Game has not started
      return {
        started: false as const,
        players: game.playerNames.map((name, id) => ({
          id,
          name,
        })),
      };
    } else {
      return {
        started: true as const,
        isDebug: game.debug ?? undefined,
        ...game.gameInterface.getPublicState(),
      };
    }
  } else {
    throw new GameError(GameErrorReason.GameNotFound);
  }
}

export function getPrivateState(gameId: string, playerId: number) {
  const publicState = getPublicState(gameId);
  if (!publicState.started) {
    return {
      ...publicState,
      currentPlayer: { id: playerId },
    };
  } else {
    const game = games[gameId]!;
    return {
      ...publicState,
      currentPlayer: game.gameInterface!.getPrivateState(playerId),
      availableActions: game.gameInterface!.getAvailableActions(playerId),
    };
  }
}

export function registerUpdateListener(
  gameId: string,
  callback: GameEventCallback
): { unregister(): void } {
  const game = games[gameId];
  if (game) {
    const observerId = game.nextObserverId;
    game.nextObserverId++;
    game.observers.push({
      id: observerId,
      callback,
    });
    return {
      unregister() {
        const observerIndex = game.observers.findIndex(
          ({ id }) => id === observerId
        );
        game.observers.splice(observerIndex, 1);
      },
    };
  } else {
    throw new GameError(GameErrorReason.GameNotFound);
  }
}

export function createDebugGame() {
  const gameId = createGame(true);
  addPlayer(gameId, "Player 1");
  addPlayer(gameId, "Player 2");
  addPlayer(gameId, "Player 3");
  addPlayer(gameId, "Player 4");
  startGame(gameId);
  return gameId;
}

function notifyListeners<E extends GameEvent>(
  gameId: string,
  event: E,
  payload: GameEventPayload<E>
) {
  games[gameId].observers.forEach(({ callback }) => callback(event, payload));
}
