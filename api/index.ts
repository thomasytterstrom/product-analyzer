import { buildServer } from "../apps/api/src/server.js";

const app = buildServer();

export default async (req: any, res: any) => {
  await app.ready();
  app.server.emit("request", req, res);
};
