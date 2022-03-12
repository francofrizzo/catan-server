import "express-session";

declare module "express-session" {
  interface SessionData {
    /**
     * The player id for each game in which the user is involved.
     */
    games: Record<string, number>;
  }
}
