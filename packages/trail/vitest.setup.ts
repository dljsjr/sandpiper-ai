import { devNull } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Trail's integration tests spawn real `git`/`jj` processes that inherit the
// full process environment. On a machine with commit signing configured
// globally (e.g. SSH signing via a 1Password agent), those spawned
// `git commit` calls would try to sign and either hang on a credential
// prompt or fail with an agent-connection error. Point git's global/system
// config resolution at /dev/null so every spawned git process in this
// package sees no signing config, regardless of the host machine's real
// gitconfig. Local repo config (`git config user.email`/`user.name`, no
// --global flag) set up by individual tests is unaffected and keeps working.
process.env.GIT_CONFIG_GLOBAL = devNull;
process.env.GIT_CONFIG_SYSTEM = devNull;

// Same isolation for jj's config resolution (the jj-backend integration
// tests spawn real `jj` processes too) — point at the checked-in throwaway
// identity fixture instead of the host machine's real ~/.config/jj/config.toml.
process.env.JJ_CONFIG = join(dirname(fileURLToPath(import.meta.url)), 'test-fixtures', 'jj-test-config.toml');
