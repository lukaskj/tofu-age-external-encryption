import { createWriteStream } from "node:fs";
import { Logger } from "./logger.ts";

const file = createWriteStream("./logs.log", { flags: "a" });

export const logger = Logger.create({
  transports: [file, process.stderr],
});
