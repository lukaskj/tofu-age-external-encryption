# OpenTofu age External Encryption

[OpenTofu external encryption](https://opentofu.org/docs/language/state/encryption/#external-experimental-1) (currently experimental) using [age](https://github.com/FiloSottile/age)/[typage](https://github.com/FiloSottile/typage) to encrypt and decrypt local Terraform state.

## Usage

### Instalation

```bash
npm install -g @lukaskj/tofu-age-external-encryption
# OR
bun install -g @lukaskj/tofu-age-external-encryption
# OR
pnpm install -g @lukaskj/tofu-age-external-encryption
# OR
yarn install -g @lukaskj/tofu-age-external-encryption
```

### Edit your Terraform file

```terraform
terraform {
  encryption {
    method "external" "age" {
      encrypt_command = ["taee", "--encrypt"]
      decrypt_command = ["taee", "--decrypt"]
    }

    state {
      method   = method.external.age
      enforced = true
    }

    plan {
      method   = method.external.age
      enforced = true
    }
  }
}
```

### Set environment variable with age keys

Currently only working with local keys.

- `AGE_KEY_FILE` or `SOPS_AGE_KEY_FILE`: point to key file. It can have multiple keys.
  ```bash
  # PS: Set file permissions to 600 for increased security
  export AGE_KEY_FILE="~/.age/keys/key.txt"
  ```
- `AGE_KEY` OR `SOPS_AGE_KEY`: Private key value. Comma separated if multiple.
  ```bash
  export AGE_KEY="AGE-SECRET-KEY-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX,AGE-SECRET-KEY-YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY"
  ```

## Migrate from unencrypted to age encryption

1. In your Terraform file, add the following configuration:

   ```terraform
   terraform {
     // ...
     encryption {
       method "external" "age" {
         encrypt_command = ["taee", "--encrypt"]
         decrypt_command = ["taee", "--decrypt"]
       }

       method "unencrypted" "old_method" {}  // <- migrating from unencrypted state

       state {
         method   = method.external.age
         enforced = false // <- Disable enforcement

         fallback {
           method = method.unencrypted.old_method // <- Add fallback to unencrypted method
         }
       }

       plan {
         method   = method.external.age
         enforced = false
       }
     }
   }
   ```

2. Run `tofu apply` to save the encrypted state
3. Remove unencrypted method, remove fallback method and set back `enforced = true`
