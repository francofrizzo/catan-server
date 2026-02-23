import expressSession from "express-session";

export const session = expressSession({
  name: "CATANSESION",
  secret: "this is a very secret phrase",
  resave: false,
  saveUninitialized: true,
  cookie: {
    sameSite: "none",
    secure: true,
  },
});

export default session;
