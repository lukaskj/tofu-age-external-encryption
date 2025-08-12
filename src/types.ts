export type KeyProviderInput = {
  external_data: Record<string, string> | null;
};

export type KeyProviderOutput = {
  keys: {
    encryption_key: string;
    decryption_key?: string;
  };
  meta?: KeyProviderInput;
};

export type EncryptionInput = {
  payload: string;
  key?: string;
};

export type EncryptionOutput = {
  payload: string;
};

export type AgePrivateKey = {
  recipient: string;
  key: string;
};
