import { CheckFailedReason, GameplayErrorReason } from "catan-engine";

export enum GameErrorReason {
  NotAPlayer = "NOT_A_PLAYER",
  GameNotFound = "GAME_NOT_FOUND",
  GameNotStarted = "GAME_NOT_STARTED",
  GameAlreadyStarted = "GAME_ALREADY_STARTED",
  NotEnoughPlayers = "NOT_ENOUGH_PLAYERS",
  TooManyPlayers = "TOO_MANY_PLAYERS",
  InvalidArgument = "INVALID_ARGUMENT",
  GameIsNotDebug = "GAME_IS_NOT_DEBUG",
  UnknownReason = "UNKNOWN_REASON",
}

export function isGameError(error: unknown): error is GameError {
  return typeof error === "object" && error instanceof GameError;
}

export class GameError extends Error {
  constructor(
    public reason: GameErrorReason | GameplayErrorReason | CheckFailedReason
  ) {
    super(`Game Error: ${reason}`);
  }

  getHttpStatus(): number {
    switch (this.reason) {
      case GameErrorReason.NotAPlayer: {
        return 401;
      }
      case GameErrorReason.GameNotFound: {
        return 404;
      }
      case GameErrorReason.UnknownReason: {
        return 500;
      }
      default: {
        return 400;
      }
    }
  }

  toJson(): {
    reason: GameErrorReason | GameplayErrorReason | CheckFailedReason;
  } {
    return { reason: this.reason };
  }
}
