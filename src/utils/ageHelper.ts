import * as age from "age-encryption";
import { err, errAsync, fromAsyncThrowable, fromPromise, ok, okAsync, ResultAsync } from "neverthrow";
import { readFile } from "node:fs/promises";
import { removeHashComments } from "./removeHashComments.ts";
import type { AgePrivateKey } from "../types.ts";

const AGE_PK_ENVS = ["AGE_KEY_FILE", "SOPS_AGE_KEY_FILE", "AGE_KEY", "SOPS_AGE_KEY"] as const;
const AGE_RECIPIENT_ENVS = ["AGE_RECIPIENTS", "SOPS_AGE_RECIPIENTS", "AGE_RECIPIENTS", "SOPS_AGE_RECIPIENTS"] as const;

export function getPrivateKeys(): ResultAsync<AgePrivateKey[], unknown> {
  for (const envKey of ["AGE_KEY_FILE", "SOPS_AGE_KEY_FILE"] as const) {
    const keyFilePath = process.env[envKey];
    if (!keyFilePath || !keyFilePath.trim()) {
      continue;
    }

    const identityToRecipientRA = fromAsyncThrowable(age.identityToRecipient);

    return fromPromise(readFile(keyFilePath), (err) => err)
      .map((bf) => bf.toString("utf-8"))
      .map((contents) => removeHashComments(contents))
      .map((contents) =>
        contents
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length),
      )
      .andThen((privateKeys) => {
        const recipientResults = privateKeys.map((key) =>
          identityToRecipientRA(key)
            .map((recipient) => ({ recipient, key }))
            .mapErr(() => new Error("Failed to extract recipient from private key.")),
        );

        return ResultAsync.combine(recipientResults).andThen((recipients) => {
          if (recipients.length > 0) {
            return okAsync(recipients);
          }
          return okAsync([]);
        });
      })
      .andThen((lines) =>
        lines.length ? ok(lines) : err(`Private key not present in '${keyFilePath}' (env var: '${envKey}')`),
      );
  }

  for (const envKey of ["AGE_KEY", "SOPS_AGE_KEY"] as const) {
    const privateKeyContentsFromEnv = process.env[envKey];
    if (!privateKeyContentsFromEnv || !privateKeyContentsFromEnv.trim()) {
      continue;
    }

    const identityToRecipientRA = fromAsyncThrowable(age.identityToRecipient);

    const contents = removeHashComments(privateKeyContentsFromEnv)
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length)
      .map((key) =>
        identityToRecipientRA(key)
          .map((recipient) => ({ recipient, key }))
          .mapErr(() => new Error("Failed to extract recipient from private key.")),
      );
    if (contents.length) {
      return ResultAsync.combine(contents).andThen((recipients) => {
        if (recipients.length > 0) {
          return okAsync(recipients);
        }
        return okAsync([]);
        // return errAsync(new Error("No recipients found"));
      });
    }

    return errAsync(`Private key not present in env var: '${envKey}'`);
  }

  return errAsync(
    `Private key not found in any of these environment variables (in order): ${AGE_PK_ENVS.map((k) => `'${k}'`).join(",")}`,
  );
}

export function getRecipients(): ResultAsync<string[], unknown> {
  return getPrivateKeys()
    .andThen((privateKeys) =>
      privateKeys.length ? okAsync(privateKeys) : errAsync("No recipients found from private keys."),
    )
    .map((privateKeys) => privateKeys.map((pk) => pk.recipient))
    .orElse(() => {
      for (const envKey of ["AGE_RECIPIENTS_FILE", "SOPS_AGE_RECIPIENTS_FILE"] as const) {
        const recipientsFilePath = process.env[envKey];
        if (!recipientsFilePath || !recipientsFilePath.trim()) {
          continue;
        }

        return fromPromise(readFile(recipientsFilePath), (err) => err)
          .map((bf) => bf.toString("utf-8"))
          .map((contents) => removeHashComments(contents))
          .map((contents) => contents.split("\n").map((l) => l.trim()))
          .map((lines) => lines.flatMap((l) => l.split(",")))
          .andThen((contents) =>
            contents.length
              ? ok(contents)
              : err(`Recipients not present in '${recipientsFilePath}' (env var: '${envKey}')`),
          );
      }

      for (const envKey of ["AGE_RECIPIENTS", "SOPS_AGE_RECIPIENTS"] as const) {
        const recipientListFromEnv = process.env[envKey];
        if (!recipientListFromEnv || !recipientListFromEnv.trim()) {
          continue;
        }

        const contents = removeHashComments(recipientListFromEnv)
          .split("\n")
          .map((l) => l.trim())
          .flatMap((r) => r.split(","));

        return okAsync(contents);
      }

      return errAsync(
        `Recipients not found in any of these environment variables (in order): ${AGE_PK_ENVS.map((k) => `'${k}'`).join(",")},${AGE_RECIPIENT_ENVS.map((k) => `'${k}'`).join(",")}`,
      );
    });
}
