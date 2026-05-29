---
name: age
description: >
  Use this skill whenever the user wants to encrypt or decrypt files using the `age`
  CLI tool (github.com/FiloSottile/age). Triggers include: any mention of "age encryption",
  "age-keygen", "encrypt a file with age", "decrypt with age", ".age files", "age public key",
  "age identity", "age recipients", "age passphrase", "age armor", or requests to use age
  as an alternative to GPG/PGP for file encryption. Also use when the user wants to generate
  age key pairs, encrypt to multiple recipients, use SSH keys with age, protect backups with
  age, or pipe data through age. Always use this skill before running any age CLI commands —
  it covers key generation, encryption modes, decryption, armored output, post-quantum keys,
  and common pitfalls.
---

# age Encryption CLI Skill

`age` is a simple, modern, and secure file encryption tool. It uses small explicit keys, has
no config options, and is designed for UNIX-style composability (pipes, stdin/stdout).

**Three binaries:**
- `age` — encrypt and decrypt files
- `age-keygen` — generate key pairs
- `age-inspect` — display metadata about encrypted files (without decrypting)

---

## Installation

```bash
# macOS
brew install age

# Linux (Debian/Ubuntu)
sudo apt install age

# Go (from source)
go install filippo.io/age/cmd/...@latest

# Download pre-built binary
# https://github.com/FiloSottile/age/releases
```

---

## Key Generation

```bash
# Generate a key pair, save to file (prints public key to stderr)
age-keygen -o key.txt
# Public key: age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p

# Generate and print to stdout (pipe-friendly)
age-keygen

# Generate post-quantum hybrid key (resistant to future quantum attacks)
age-keygen -pq -o key.txt

# Generate a passphrase-protected identity file
age-keygen | age -p > key.age
# (age will prompt for a passphrase, or auto-generate one)

# Extract just the public key (recipient) from an identity file
age-keygen -y key.txt
```

**Key file format:**
```
# created: 2024-01-01T00:00:00Z
# public key: age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p
AGE-SECRET-KEY-1QJEPAXHE0QG34QFTTNL9Z5JU2CKPMW8ZG7R28LGZAQT87MTQNZS4T5X09
```

---

## Encrypting Files

### Passphrase encryption (symmetric)
```bash
# Encrypt with passphrase (age prompts interactively)
age -p secrets.txt > secrets.txt.age

# Auto-generate a secure passphrase
age -p secrets.txt > secrets.txt.age   # leave passphrase blank when prompted

# Armored output (ASCII/PEM — easier to copy/paste or embed in text)
age -p -a secrets.txt > secrets.txt.age
```

### Public key (recipient) encryption
```bash
# Encrypt to a single recipient
age -r age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p \
    secrets.txt > secrets.txt.age

# Encrypt to multiple recipients (all can decrypt independently)
age -r age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p \
    -r age1lggyhqrw2nlhcxprm67z43rta597azn8gknawjehu9d9dl0jq3yqqvfafg \
    example.jpg -o example.jpg.age

# Encrypt using a recipients file (one public key per line, # = comment)
age -R recipients.txt example.jpg > example.jpg.age

# Encrypt to SSH public keys
age -r "ssh-ed25519 AAAA..." secrets.txt > secrets.txt.age
age -r "ssh-rsa AAAA..." secrets.txt > secrets.txt.age

# Encrypt to GitHub user's SSH keys (fetched from GitHub API)
curl https://github.com/USERNAME.keys | age -R - secrets.txt > secrets.txt.age

# Encrypt using an identity file as recipient (uses its public key)
age --encrypt -i key.txt secrets.txt > secrets.txt.age
```

### Pipes and stdin/stdout
```bash
# Encrypt stdin → stdout
echo "my secret" | age -r age1... > secret.age

# Encrypt a tar archive in one pipeline
tar cvz ~/data | age -r age1... > data.tar.gz.age

# Armored output piped to clipboard (macOS)
echo "secret" | age -a -r age1... | pbcopy
```

---

## Decrypting Files

```bash
# Decrypt with identity (key) file
age -d -i key.txt secrets.txt.age > secrets.txt

# Decrypt with multiple identity files (age tries each; unused keys are ignored)
age -d -i key1.txt -i key2.txt secrets.txt.age > secrets.txt

# Decrypt a passphrase-encrypted file (age prompts interactively)
age -d secrets.txt.age > secrets.txt

# Decrypt with a passphrase-protected identity file (age prompts for passphrase)
age -d -i key.age secrets.txt.age > secrets.txt

# Decrypt with SSH private key
age -d -i ~/.ssh/id_ed25519 secrets.txt.age > secrets.txt

# Decrypt to stdout (pipe to another command)
age -d -i key.txt data.tar.gz.age | tar xz
```

---

## Inspecting Encrypted Files

> **Note**: `age-inspect` is available in age v1.1.0+. It may not be present in older
> distro packages. Check with `age --version`.

```bash
# Show metadata without decrypting
age-inspect secrets.age
# Displays: recipient types, post-quantum status, header/payload sizes
```

---

## Common Patterns & Recipes

### Secure backups
```bash
# Compress and encrypt a directory
tar czf - ~/documents | age -r age1... > documents_backup.age

# Restore
age -d -i key.txt documents_backup.age | tar xzf - -C ~/restored/
```

### Passphrase-protected key storage
```bash
# Generate key, protect it with a passphrase for remote/shared storage
age-keygen | age -p > key.age

# Distribute only the public key; keep key.age somewhere (e.g. cloud storage)
# Decrypt as needed:
age -d -i key.age secrets.txt.age > secrets.txt
```

### Rotate recipients on a file
```bash
# Re-encrypt for a new set of recipients
age -d -i oldkey.txt data.age | age -r age1NEW... > data_new.age
```

### Text/string encryption (quick share)
```bash
# Encrypt a string with armor to easily copy/paste
echo "API_KEY=hunter2" | age -a -r age1... 

# Decrypt from clipboard (macOS)
pbpaste | age -d -i key.txt
```

---

## Flags Reference

| Flag | Short | Description |
|------|-------|-------------|
| `--encrypt` | `-e` | Encrypt (default when `-r`/`-R`/`-p`/`-i` used in encrypt mode) |
| `--decrypt` | `-d` | Decrypt |
| `--recipient RECIPIENT` | `-r` | Recipient public key (repeatable) |
| `--recipients-file PATH` | `-R` | File with one recipient per line (repeatable; `-` = stdin) |
| `--identity PATH` | `-i` | Identity (private key) file for decryption (repeatable; `-` = stdin) |
| `--passphrase` | `-p` | Encrypt with passphrase |
| `--armor` | `-a` | Output ASCII/PEM armored text instead of binary |
| `--output PATH` | `-o` | Output file path |

**`age-keygen` flags:**
| Flag | Description |
|------|-------------|
| `-o PATH` | Write identity to file (public key printed to stderr) |
| `-y` | Convert identity file → recipient (public key only) |
| `-pq` | Generate post-quantum hybrid key (X25519 + ML-KEM-768) |

---

## Key Concepts

- **Recipient** — a public key (`age1...`, `ssh-ed25519 ...`, `ssh-rsa ...`). Used to encrypt.
- **Identity** — a private key file (`AGE-SECRET-KEY-1...`). Used to decrypt.
- **Armor** (`-a`) — base64/PEM text encoding of binary age output. Larger but text-safe.
- **Passphrase files** — any passphrase-encrypted `.age` file can be passed with `-i`; age
  will prompt for the passphrase and use the decrypted content as an identity file.
- **Multiple recipients** — encrypts one random file key once, wrapped per recipient.
  All recipients can decrypt; they cannot see each other's wrapped keys.
- **Post-quantum keys** — hybrid X25519 + ML-KEM-768 keys, generated with `age-keygen -pq`.
  Protect against future quantum computer attacks.
- **No key servers, no config files** — keys are small text strings; pass them on the
  command line or in files. There is no default key path.

---

## Common Pitfalls

- **Binary vs armored**: `age` outputs binary by default. Use `-a` for text-safe output
  (email, config files, clipboard). Binary output will look garbled if opened in a text editor.
- **`-i` vs `-r`**: `-i` is for **identity** (decrypt / or encrypt-to-self). `-r` is for
  **recipient** (encrypt only). Don't mix them up.
- **SSH key limitations**: SSH keys on YubiKeys cannot decrypt age files. People may rotate
  SSH keys over time — prefer native `age1...` keys for long-term storage.
- **Passphrase-encrypted identity files**: Passing a passphrase-protected `.age` file via
  `-i` prompts for the passphrase interactively. This won't work in non-interactive scripts.
- **`-i` with `--encrypt`**: When `--encrypt` is explicitly passed, `-i` encrypts *to* the
  identity's public key (not decryption mode). This is the one exception to `-i` = decrypt.
- **Multiple `-i` flags**: age silently ignores identity files that don't match. This is
  intentional — you can pass many keys and only the matching one is used.
