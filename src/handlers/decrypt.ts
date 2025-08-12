import { Decrypter } from "age-encryption";
import { fromPromise } from "neverthrow";
import { HEADERS } from "../constants.ts";
import type { EncryptionInput, EncryptionOutput } from "../types.ts";
import { logger } from "../utils/defaultLogger.ts";
import { readStdinAsync } from "../utils/readStdinAsync.ts";
import { safeJsonParse } from "../utils/safeJsonParse.ts";

export async function decrypt() {
  process.stdout.write(`${HEADERS.Encryption}\n`);
  const rawInput = await readStdinAsync();
  logger.debug("Decrypt input");

  const input = safeJsonParse<EncryptionInput>(rawInput);
  if (input.isErr() || !input.value.key) {
    logger.fatal("Failed to parse decrypt input.");
    return;
  }

  const privateKeys = Buffer.from(input.value.key, "base64").toString("utf-8").split(",");

  if (!privateKeys || !privateKeys.length) {
    logger.fatal("Private keys not sent.");
    return;
  }

  const decrypter = new Decrypter();
  for (const pk of privateKeys) {
    decrypter.addIdentity(pk);
  }

  const decryptResult = await fromPromise(
    decrypter.decrypt(Buffer.from(input.value.payload, "base64")),
    (error) => `Failed to decrypt data: ${error}`,
  );

  if (decryptResult.isErr()) {
    logger.fatal(decryptResult.error);

    return;
  }

  const output: EncryptionOutput = {
    payload: Buffer.from(decryptResult.value).toString("utf-8"),
  };

  logger.debug("Decrypt output:", output);
  process.stdout.write(`${JSON.stringify(output)}\n`);
}
