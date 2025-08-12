import { createWriteStream } from "node:fs";
import type Stream from "node:stream";
import { Logger } from "./logger.ts";

const defaultTransforms: Stream.Writable[] = [process.stderr];

const isDebug = process.env.DEBUG === "true" || process.env.DEBUG === "1";

if (isDebug) {
  const file = createWriteStream("./taee-debug.log", { flags: "a" });
  defaultTransforms.push(file);
}

export const logger = Logger.create({
  level: isDebug ? "debug" : "info",
  transports: defaultTransforms,
});
