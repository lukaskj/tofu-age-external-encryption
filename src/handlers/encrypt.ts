import * as age from "age-encryption";
import { fromPromise } from "neverthrow";
import { HEADERS } from "../constants.ts";
import type { EncryptionInput, EncryptionOutput } from "../types.ts";
import { logger } from "../utils/defaultLogger.ts";
import { readStdinAsync } from "../utils/readStdinAsync.ts";
import { safeJsonParse } from "../utils/safeJsonParse.ts";
import { getRecipients } from "../utils/ageHelper.ts";

export async function encrypt() {
  process.stdout.write(`${HEADERS.Encryption}\n`);
  const rawInput = await readStdinAsync();
  logger.debug("Encrypt input:", rawInput);

  const input = safeJsonParse<EncryptionInput>(rawInput);
  if (input.isErr()) {
    logger.fatal("Failed to parse encrypt input.", rawInput);
    return;
  }

  const recipients = Buffer.from(input.value.key ?? "", "base64")
    .toString("utf-8")
    .split(",")
    .filter((key) => key.length);

  if (!recipients.length) {
    const recipientsFromEnvs = await getRecipients();
    if (recipientsFromEnvs.isOk()) {
      recipients.push(...recipientsFromEnvs.value);
    }
  }

  if (!recipients.length) {
    logger.fatal("Recipients or private keys not found.");
    return;
  }

  const encrypt = new age.Encrypter();
  for (const recipient of recipients) {
    encrypt.addRecipient(recipient);
  }

  const encryptResult = await fromPromise(
    encrypt.encrypt(input.value.payload),
    (error) => `Failed to encrypt data: ${error}`,
  );

  if (encryptResult.isErr()) {
    logger.error("Encryption failed", encryptResult.error);

    return;
  }

  const output: EncryptionOutput = {
    payload: encryptResult.value.toBase64(),
  };

  logger.debug("Encrypt output:", output);

  process.stdout.write(`${JSON.stringify(output)}\n`);
}
