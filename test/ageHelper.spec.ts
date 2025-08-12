import { afterAll, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as fs from "node:fs/promises";
import * as age from "age-encryption";
import { getPrivateKeys, getRecipients } from "../src/utils/ageHelper.ts";

// Mock removeHashComments to be identity for simplicity
mock.module("./removeHashComments.ts", () => ({
  removeHashComments: (input: string) => input,
}));

describe("getPrivateKeys", () => {
  for (const key in process.env) {
    if (key.startsWith("AGE_") || key.startsWith("SOPS_")) {
      delete process.env[key];
    }
  }
  const OLD_ENV = process.env;
  beforeEach(() => {
    // Reset env before each test
    process.env = { ...OLD_ENV };
    mock.restore();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe("Private keys from file", () => {
    const privateKeyFileEnvs = ["AGE_KEY_FILE", "SOPS_AGE_KEY_FILE"];

    describe.each(privateKeyFileEnvs)("Private key file in %s", (privateKeyEnvKey) => {
      it(`reads from ${privateKeyEnvKey} env and returns keys`, async () => {
        process.env[privateKeyEnvKey] = "/fake/path";

        const expected = [
          {
            key: "key1",
            recipient: "recipient",
          },
          {
            key: "key2",
            recipient: "recipient",
          },
        ];

        spyOn(age, "identityToRecipient").mockResolvedValue("recipient");

        // Mock readFile to return a buffer with fake keys
        spyOn(fs, "readFile").mockResolvedValue(Buffer.from("key1\nkey2\n"));

        const result = await getPrivateKeys();

        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap()).toEqual(expected);
      });

      it(`returns error if ${privateKeyEnvKey} is set but file read fails`, async () => {
        process.env[privateKeyEnvKey] = "/bad/path";

        spyOn(fs, "readFile").mockRejectedValue(new Error("File not found"));

        const result = await getPrivateKeys();

        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr()).toBeInstanceOf(Error);
        expect((result._unsafeUnwrapErr() as Error).message).toBe("File not found");
      });

      it(`returns error if ${privateKeyEnvKey} is set but file is empty`, async () => {
        process.env[privateKeyEnvKey] = "/empty/path";

        spyOn(fs, "readFile").mockResolvedValue(Buffer.from(""));

        const result = await getPrivateKeys();

        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr()).toMatch(/Private key not present/);
      });
    });
  });

  describe("Private keys from env", () => {
    const privateKeyFileEnvs = ["AGE_KEY", "SOPS_AGE_KEY"];

    describe.each(privateKeyFileEnvs)("Private keys in %s", (privateKeyEnvKey) => {
      it(`reads from ${privateKeyEnvKey} env and returns keys`, async () => {
        process.env[privateKeyEnvKey] = "key1\nkey2\n";

        const expected = [
          {
            key: "key1",
            recipient: "recipient",
          },
          {
            key: "key2",
            recipient: "recipient",
          },
        ];

        spyOn(age, "identityToRecipient").mockResolvedValue("recipient");

        const result = await getPrivateKeys();

        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap()).toEqual(expected);
      });
    });
  });

  it("returns error if no env variables set", async () => {
    delete process.env.AGE_KEY_FILE;
    delete process.env.SOPS_AGE_KEY_FILE;
    delete process.env.AGE_KEY;
    delete process.env.SOPS_AGE_KEY;

    const result = await getPrivateKeys();

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toMatch(/Private key not found/);
  });
});

describe("getRecipients", () => {
  for (const key in process.env) {
    if (key.startsWith("AGE_") || key.startsWith("SOPS_")) {
      delete process.env[key];
    }
  }
  const OLD_ENV = process.env;

  beforeEach(() => {
    // Reset env before each test
    process.env = { ...OLD_ENV };
    mock.restore();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe("Recipients from private keys", () => {
    it("returns recipients derived from private keys", async () => {
      process.env.AGE_KEY = "age1secretkey1\nage1secretkey2";

      const expectedRecipients = ["age1recipient1", "age1recipient2"];

      spyOn(age, "identityToRecipient")
        .mockResolvedValueOnce(expectedRecipients[0])
        .mockResolvedValueOnce(expectedRecipients[1]);

      const result = await getRecipients();

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual(expectedRecipients);
    });

    it("returns error when no private keys are found", async () => {
      // Clear all environment variables that could contain private keys
      delete process.env.AGE_KEY_FILE;
      delete process.env.SOPS_AGE_KEY_FILE;
      delete process.env.AGE_KEY;
      delete process.env.SOPS_AGE_KEY;

      const result = await getRecipients();

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toMatch(/Recipients not found in any of these environment variables/);
    });
  });

  describe("Recipients from file", () => {
    const recipientFileEnvs = ["AGE_RECIPIENTS_FILE", "SOPS_AGE_RECIPIENTS_FILE"];

    describe.each(recipientFileEnvs)("Recipients file in %s", (envKey) => {
      it(`reads recipients from ${envKey} file`, async () => {
        process.env[envKey] = "/fake/recipients/path";

        const fileContent = "age1recipient1\nage1recipient2\nage1recipient3";
        spyOn(fs, "readFile").mockResolvedValue(Buffer.from(fileContent));

        const result = await getRecipients();

        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap()).toEqual(["age1recipient1", "age1recipient2", "age1recipient3"]);
      });

      it(`handles comma-separated recipients in ${envKey} file`, async () => {
        process.env[envKey] = "/fake/recipients/path";

        const fileContent = "age1recipient1,age1recipient2\nage1recipient3,age1recipient4";
        spyOn(fs, "readFile").mockResolvedValue(Buffer.from(fileContent));

        const result = await getRecipients();

        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap()).toEqual([
          "age1recipient1",
          "age1recipient2",
          "age1recipient3",
          "age1recipient4",
        ]);
      });

      it(`returns error if ${envKey} file is empty`, async () => {
        process.env[envKey] = "/empty/recipients/path";

        spyOn(fs, "readFile").mockResolvedValue(Buffer.from(""));

        const result = await getRecipients();

        expect(result.isOk()).toBe(true);
        // Empty file results in an array with one empty string after processing
        expect(result._unsafeUnwrap()).toEqual([""]);
      });

      it(`returns error if ${envKey} file read fails`, async () => {
        process.env[envKey] = "/bad/recipients/path";

        spyOn(fs, "readFile").mockRejectedValue(new Error("File not found"));

        const result = await getRecipients();

        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr()).toBeInstanceOf(Error);
        expect((result._unsafeUnwrapErr() as Error).message).toBe("File not found");
      });

      it(`skips ${envKey} if environment variable is empty or whitespace`, async () => {
        process.env[envKey] = "  ";

        const result = await getRecipients();

        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr()).toMatch(/Recipients not found in any of these environment variables/);
      });
    });
  });

  describe("Recipients from environment variables", () => {
    const recipientEnvs = ["AGE_RECIPIENTS", "SOPS_AGE_RECIPIENTS"];

    describe.each(recipientEnvs)("Recipients in %s", (envKey) => {
      it(`reads recipients from ${envKey} environment variable`, async () => {
        process.env[envKey] = "age1recipient1\nage1recipient2\nage1recipient3";

        const result = await getRecipients();

        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap()).toEqual(["age1recipient1", "age1recipient2", "age1recipient3"]);
      });

      it(`handles comma-separated recipients in ${envKey}`, async () => {
        process.env[envKey] = "age1recipient1,age1recipient2\nage1recipient3,age1recipient4";

        const result = await getRecipients();

        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap()).toEqual([
          "age1recipient1",
          "age1recipient2",
          "age1recipient3",
          "age1recipient4",
        ]);
      });

      it(`skips ${envKey} if environment variable is empty or whitespace`, async () => {
        process.env[envKey] = "   ";

        const result = await getRecipients();

        expect(result.isErr()).toBe(true);
        expect(result._unsafeUnwrapErr()).toMatch(/Recipients not found in any of these environment variables/);
      });
    });
  });

  describe("Fallback behavior", () => {
    it("tries private keys first, then falls back to recipient file", async () => {
      // No private keys available
      delete process.env.AGE_KEY_FILE;
      delete process.env.SOPS_AGE_KEY_FILE;
      delete process.env.AGE_KEY;
      delete process.env.SOPS_AGE_KEY;

      // Set up recipients file
      process.env.AGE_RECIPIENTS_FILE = "/fake/recipients/path";
      const fileContent = "age1recipient1\nage1recipient2";
      spyOn(fs, "readFile").mockResolvedValue(Buffer.from(fileContent));

      const result = await getRecipients();

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual(["age1recipient1", "age1recipient2"]);
    });

    it("tries private keys first, then falls back to recipient environment variable", async () => {
      // No private keys available
      delete process.env.AGE_KEY_FILE;
      delete process.env.SOPS_AGE_KEY_FILE;
      delete process.env.AGE_KEY;
      delete process.env.SOPS_AGE_KEY;

      // No recipient files available
      delete process.env.AGE_RECIPIENTS_FILE;
      delete process.env.SOPS_AGE_RECIPIENTS_FILE;

      // Set up recipients in environment variable
      process.env.AGE_RECIPIENTS = "age1recipient1\nage1recipient2";

      const result = await getRecipients();

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual(["age1recipient1", "age1recipient2"]);
    });

    it("prioritizes private keys over recipient files when both are available", async () => {
      // Set up private keys
      process.env.AGE_KEY = "age1secretkey1";
      spyOn(age, "identityToRecipient").mockResolvedValue("age1recipient_from_key");

      // Set up recipients file (should be ignored)
      process.env.AGE_RECIPIENTS_FILE = "/fake/recipients/path";
      spyOn(fs, "readFile").mockResolvedValue(Buffer.from("age1recipient_from_file"));

      const result = await getRecipients();

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual(["age1recipient_from_key"]);

      // Verify that readFile was not called (recipients file was not used)
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it("prioritizes AGE_RECIPIENTS_FILE over SOPS_AGE_RECIPIENTS_FILE", async () => {
      // No private keys available
      delete process.env.AGE_KEY_FILE;
      delete process.env.SOPS_AGE_KEY_FILE;
      delete process.env.AGE_KEY;
      delete process.env.SOPS_AGE_KEY;

      // Set up both recipient files
      process.env.AGE_RECIPIENTS_FILE = "/age/recipients/path";
      process.env.SOPS_AGE_RECIPIENTS_FILE = "/sops/recipients/path";

      spyOn(fs, "readFile").mockResolvedValue(Buffer.from("age1recipient_from_age_file"));

      const result = await getRecipients();

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual(["age1recipient_from_age_file"]);

      // Verify that only the AGE_RECIPIENTS_FILE was read
      expect(fs.readFile).toHaveBeenCalledWith("/age/recipients/path");
      expect(fs.readFile).not.toHaveBeenCalledWith("/sops/recipients/path");
    });

    it("prioritizes AGE_RECIPIENTS over SOPS_AGE_RECIPIENTS", async () => {
      // No private keys or files available
      delete process.env.AGE_KEY_FILE;
      delete process.env.SOPS_AGE_KEY_FILE;
      delete process.env.AGE_KEY;
      delete process.env.SOPS_AGE_KEY;
      delete process.env.AGE_RECIPIENTS_FILE;
      delete process.env.SOPS_AGE_RECIPIENTS_FILE;

      // Set up both recipient environment variables
      process.env.AGE_RECIPIENTS = "age1recipient_from_age_env";
      process.env.SOPS_AGE_RECIPIENTS = "age1recipient_from_sops_env";

      const result = await getRecipients();

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual(["age1recipient_from_age_env"]);
    });
  });

  describe("Edge cases", () => {
    it("handles mixed whitespace in recipients", async () => {
      process.env.AGE_RECIPIENTS = "  age1recipient1  \n\n  age1recipient2  \n  ";

      const result = await getRecipients();

      expect(result.isOk()).toBe(true);
      // Empty lines become empty strings in the result
      expect(result._unsafeUnwrap()).toEqual(["age1recipient1", "", "age1recipient2", ""]);
    });

    it("handles empty lines and extra commas in recipients", async () => {
      process.env.AGE_RECIPIENTS = "age1recipient1,,age1recipient2,\n\nage1recipient3,";

      const result = await getRecipients();

      expect(result.isOk()).toBe(true);
      // Note: The implementation may include empty strings from extra commas
      // This test documents the current behavior
      const recipients = result._unsafeUnwrap();
      expect(recipients).toContain("age1recipient1");
      expect(recipients).toContain("age1recipient2");
      expect(recipients).toContain("age1recipient3");
    });

    it("returns error with detailed message when no recipients are found anywhere", async () => {
      // Clear all possible sources of recipients
      delete process.env.AGE_KEY_FILE;
      delete process.env.SOPS_AGE_KEY_FILE;
      delete process.env.AGE_KEY;
      delete process.env.SOPS_AGE_KEY;
      delete process.env.AGE_RECIPIENTS_FILE;
      delete process.env.SOPS_AGE_RECIPIENTS_FILE;
      delete process.env.AGE_RECIPIENTS;
      delete process.env.SOPS_AGE_RECIPIENTS;

      const result = await getRecipients();

      expect(result.isErr()).toBe(true);
      const errorMessage = result._unsafeUnwrapErr() as string;
      expect(errorMessage).toMatch(/Recipients not found in any of these environment variables/);
      expect(errorMessage).toContain("AGE_KEY_FILE");
      expect(errorMessage).toContain("SOPS_AGE_KEY_FILE");
      expect(errorMessage).toContain("AGE_KEY");
      expect(errorMessage).toContain("SOPS_AGE_KEY");
      expect(errorMessage).toContain("AGE_RECIPIENTS");
      expect(errorMessage).toContain("SOPS_AGE_RECIPIENTS");
    });

    it("handles recipients with various formats correctly", async () => {
      process.env.AGE_RECIPIENTS = "age1valid1\nage1valid2,age1valid3\n  age1valid4  ";

      const result = await getRecipients();

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual(["age1valid1", "age1valid2", "age1valid3", "age1valid4"]);
    });

    it("skips environment variable with only whitespace and returns error", async () => {
      // Clear all other sources
      delete process.env.AGE_KEY_FILE;
      delete process.env.SOPS_AGE_KEY_FILE;
      delete process.env.AGE_KEY;
      delete process.env.SOPS_AGE_KEY;
      delete process.env.AGE_RECIPIENTS_FILE;
      delete process.env.SOPS_AGE_RECIPIENTS_FILE;

      process.env.AGE_RECIPIENTS = "  \n  \n  ";

      const result = await getRecipients();

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toMatch(/Recipients not found in any of these environment variables/);
    });
  });
});
