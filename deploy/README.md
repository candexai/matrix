# Operations runbook — Matrix × CandexAI

Server: `root@37.60.249.35` (Ubuntu 24.04) · Domain: **https://edu.candexai.co.in** · Code: `/opt/matrix` (git clone of `candexai/matrix`, branch `main`)

| Component | How it runs | Port |
|-----------|-------------|------|
| Backend (Express) | pm2 app `matrix-backend` → `node dist/server.js` | 127.0.0.1:5001 |
| Frontend (Next.js) | pm2 app `matrix-frontend` → `next start` | 127.0.0.1:3000 |
| nginx | site `/etc/nginx/sites-available/matrix`, TLS via certbot | 80 / 443 |

Routing: `https://edu.candexai.co.in/api/*` → backend, everything else → frontend. Access is controlled by the app's own login (`/login`, `/signup`; sessions signed with `JWT_SECRET` in `backend/.env`). The nginx basic-auth gate used before accounts existed has been removed; re-enable it by adding `auth_basic` lines back to `/etc/nginx/sites-available/matrix` if you ever need a second layer.

## Everyday commands

```bash
# status of both apps
pm2 status

# logs (follow)
pm2 logs matrix-backend
pm2 logs matrix-frontend
pm2 logs --lines 200            # both, last 200 lines
tail -f /var/log/matrix/backend.out.log /var/log/matrix/backend.err.log

# restart / stop / start
pm2 restart matrix-backend
pm2 restart matrix-frontend
pm2 restart all
pm2 stop matrix-backend && pm2 start matrix-backend

# health
curl -s https://edu.candexai.co.in/health
curl -s -u <user>:<password> https://edu.candexai.co.in/api/v1/agents/providers
```

## Deploy an update

```bash
ssh root@37.60.249.35
bash /opt/matrix/deploy/deploy.sh        # git pull → npm ci → build backend + frontend → pm2 reload
```

`NO_PULL=1 bash /opt/matrix/deploy/deploy.sh` rebuilds what is on disk (after editing files on the server).

## Configuration

- Backend env: `/opt/matrix/backend/.env` (Mongo, ElevenLabs, Zoho, OpenAI, `PUBLIC_BACKEND_URL=https://edu.candexai.co.in`). After editing: `pm2 restart matrix-backend`.
- Frontend env: `/opt/matrix/frontend/.env.production` (`NEXT_PUBLIC_API_URL`). It is baked in at build time — after editing run `deploy.sh` again.
- Basic-auth users (only if you re-add the `auth_basic` gate): `htpasswd /etc/nginx/matrix.htpasswd <user>` (add/change), `htpasswd -D /etc/nginx/matrix.htpasswd <user>` (remove), then `systemctl reload nginx`.

## nginx

The site enables gzip for proxied responses and HTTP/2 (`listen 443 ssl http2;`). Both matter a lot for users far from the server (Frankfurt): the conversation list went from 128 KB to 18 KB on the wire.

```bash
nginx -t                          # validate config
systemctl reload nginx            # apply
systemctl status nginx
tail -f /var/log/nginx/error.log /var/log/nginx/access.log
```

## TLS (Let's Encrypt)

```bash
certbot certificates              # list + expiry
certbot renew --dry-run           # test renewal (auto-renewal timer is installed by certbot)
certbot --nginx -d edu.candexai.co.in   # (re)issue for the site
```

## pm2 housekeeping

```bash
pm2 save                          # persist the process list (done by deploy.sh)
pm2 startup                       # prints the systemd enable command (already configured)
pm2 flush                         # clear pm2's own log files
pm2 describe matrix-backend       # details, restarts, memory
pm2 monit                         # live CPU/memory
```

## What the backend does on boot

- Connects to MongoDB Atlas (`DB_NAME=matrix`). The server IP must be on the Atlas Network Access list.
- Registers/attaches the ElevenLabs post-call webhook for `PUBLIC_BACKEND_URL` to every agent (re-checked every minute). Do **not** run a local dev backend against the same database at the same time — it would re-point the webhook to its own URL. For local development use a different `DB_NAME`.
- Zoho tokens are read from the database; `ENCRYPTION_KEY` on the server must match the key that encrypted them.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| 502 from nginx | `pm2 status` — is the app online? `pm2 logs matrix-backend --lines 100` |
| Backend exits at boot: "Could not connect to MongoDB" | Add `37.60.249.35` in Atlas → Network Access |
| Calls finish but no transcript appears | `pm2 logs matrix-backend | grep webhook` — should show `processed post_call_transcription`; check the agent's webhook via `/api/v1/agents` (`postCallWebhook.url` must be the site URL) or `POST /api/v1/agents/webhooks/ensure` |
| Zoho **Connect** shows "Invalid Redirect Uri" | The Zoho client in use does not have this site's callback registered. Easiest: on the Integrations page open **Zoho CRM → App settings**, create your own *Server-based Application* at https://api-console.zoho.in with the callback URL shown there, paste Client ID + Secret, save, then Connect. (Or register `https://edu.candexai.co.in/api/v1/integrations/zoho/callback` on the existing client.) |
| Zoho "not connected" after deploy | `ENCRYPTION_KEY` differs from the one used when Zoho was connected, or the token was revoked — reconnect from Integrations (needs the site callback URL registered in the Zoho API console) |
| Frontend shows "Cannot reach the backend" | `NEXT_PUBLIC_API_URL` in `frontend/.env.production` must be `https://edu.candexai.co.in/api/v1`; rebuild with `deploy.sh` |
