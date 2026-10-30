# Production deployment preparation

`compose.yml` builds the React app, runs Django with Gunicorn, PostgreSQL, and Caddy HTTPS. PostgreSQL, public media, private evidence, Django static files, and Caddy certificates use persistent Docker volumes. The stack is prepared for a future public server; it has not been launched because this computer does not have Docker or a hosting account.

Copy `.env.example` to `.env`, replace every placeholder, and keep `.env` out of Git. Point `SITE_DOMAIN` to the server's public IP through DNS. From this directory, run `docker compose up -d --build`, then check `docker compose ps` and `docker compose logs --tail=100`. Open ports 80 and 443 on the server. The backend reads the database, SMTP, captcha, and frontend URL settings from `.env`.

The existing local database and uploaded files do not migrate automatically. Before using this for real reports, back up PostgreSQL plus both media directories and move those backups to the server. Test login, staff invitation emails, report creation, evidence uploads, and restoration of a backup. Do not publish the repository's tracked `backend/media` files as part of the image; the Docker build excludes them.

For a no-card, laptop-hosted public preview, see [TAILSCALE_FUNNEL.md](TAILSCALE_FUNNEL.md). That option depends on the laptop staying online.
