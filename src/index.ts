#!/usr/bin/env node
import { decrypt } from "./handlers/decrypt.ts";
import { encrypt } from "./handlers/encrypt.ts";
import { keyProvider } from "./handlers/keyProvider.ts";
import { logger } from "./utils/defaultLogger.ts";

async function entrypoint() {
  logger.debug("Args:", process.argv);

  if (!process.argv[2]) {
    logger.fatal("Missing option. One of [--]<encrypt|decrypt|key-provider>");
  }

  switch (process.argv[2]) {
    case "--encrypt":
    case "encrypt":
      encrypt();
      break;
    case "--decrypt":
    case "decrypt":
      decrypt();
      break;
    case "--key-provider":
    case "key-provider":
    case "--key":
    case "key":
      keyProvider();
      break;
    default:
      logger.fatal("Option not regcognized:", process.argv[2]);
  }
}

entrypoint();

export { entrypoint };
export * from "./types";
