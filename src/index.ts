#!/usr/bin/env node
import { decrypt } from "./handlers/decrypt.ts";
import { encrypt } from "./handlers/encrypt.ts";
import { keyProvider } from "./handlers/keyProvider.ts";
import { logger } from "./utils/defaultLogger.ts";

async function entrypoint() {
  logger.debug("Args:", process.argv);

  // if (!process.argv[2]) {
  //   logger.fatal("Missing option. One of [--]<encrypt|decrypt|key-provider>");
  // }

  switch (process.argv[2]) {
    case "--encrypt":
    case "encrypt":
      await encrypt();
      break;
    case "--decrypt":
    case "decrypt":
      await decrypt();
      break;
    case "--key-provider":
    case "key-provider":
    case "--key":
    case "key":
      await keyProvider();
      break;
    case "version":
    case "--version":
    case "-v":
      console.log(version());
      break;
    default:
      console.log(usage());
  }
}

function version() {
  const packageJson = require("../package.json");
  return `Version ${packageJson.version}`;
}

function usage() {
  const packageJson = require("../package.json");
  console.log(`Version ${packageJson.version}`);
  const bin = packageJson.bin;
  let command = process.argv[1];
  if (typeof bin === "string") {
    command = bin;
  } else if (typeof bin === "object") {
    command = Object.keys(bin).at(-1) ?? command;
  }

  const usage = `Usage:
  ${command} <encrypt|decrypt|key-provider> [options]
  ${command} --encrypt [options]
  ${command} --decrypt [options]
  ${command} --key-provider [options]
  ${command} --key [options]
  ${command} --help
  ${command} -h
`;

  return usage;
}

entrypoint();

export { entrypoint };
export * from "./types";
