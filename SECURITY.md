# Security and private data

Do **not** expose the demo Compose stack directly to the internet. The Mosquitto broker deliberately allows anonymous messages for localhost-only teaching/demo use. All published demo device IDs, geometry and observations are synthetic. No raw building measurements are required.

Do not commit `.env`, broker passwords, JWT signing keys, API tokens, SQL backups or actual building floor plans. Any credentials used previously with the original project should be rotated, regardless of whether the new repository excludes them; hiding a credential from a new Git history does not revoke an old exposed credential.

For vulnerability reports, use private communication with the maintainers rather than a public GitHub issue containing exploitation details, credentials or private sensor readings. Before public-facing deployment implement TLS, hardened authentication/authorization, secure MQTT credentials, API rate limiting, audit logging and proper secret storage.
