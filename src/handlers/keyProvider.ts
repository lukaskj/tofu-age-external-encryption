import { HEADERS } from "../constants.ts";
import type { KeyProviderInput, KeyProviderOutput } from "../types.ts";
import { getPrivateKeys, getRecipients } from "../utils/ageHelper.ts";
import { logger } from "../utils/defaultLogger.ts";
import { readStdinAsync } from "../utils/readStdinAsync.ts";
import { safeJsonParse } from "../utils/safeJsonParse.ts";

export async function keyProvider() {
  process.stdout.write(`${HEADERS.KeyProvider}\n`);
  const rawInput = await readStdinAsync();
  logger.debug("Key provider input:", rawInput);

  const input = safeJsonParse<KeyProviderInput>(rawInput);
  if (input.isErr()) {
    logger.fatal("Failed to parse input.", rawInput);
    return;
  }

  const keys = await getPrivateKeys();
  if (keys.isErr()) {
    logger.fatal("Failed to get age private keys.", keys.error);
    return;
  }

  const recipients = await getRecipients();
  if (recipients.isErr()) {
    logger.fatal("Failed to get recipients", recipients.error);
    return;
  }

  const output: KeyProviderOutput = {
    keys: {
      encryption_key: Buffer.from(recipients.value.join(",")).toString("base64"),
    },
  };

  if (input.value.external_data) {
    const privateKeyList = keys.value.map((key) => key.key).join(",");
    output.keys.decryption_key = Buffer.from(privateKeyList).toString("base64");
  }

  if (!output.meta) {
    output.meta = {
      external_data: {},
    };

    for (let i = 0; i < recipients.value.length; i++) {
      const recipientKey = `recipient-${i}`;
      const recipient = recipients.value[i];
      output.meta.external_data![recipientKey] = recipient;
    }
  }

  logger.debug("Key provider output:", output);
  process.stdout.write(`${JSON.stringify(output)}\n`);
}
