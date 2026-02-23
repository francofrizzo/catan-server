import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

import router from "./rest-routes";
import session from "./session";
import { setupWebsockets } from "./websockets";

const app = express();
const port = 7123;

app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());
app.use(session);

app.use(router);

const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

setupWebsockets(server);
