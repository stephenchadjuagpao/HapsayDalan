# Free public HTTPS link for a laptop-hosted pilot

Tailscale Funnel gives this project a stable `https://<device>.<tailnet>.ts.net` link that opens from other networks. The laptop, PostgreSQL, backend, frontend, and Tailscale must remain running. The address is public; keep staff passwords private. Tailscale's Personal plan is for individual, non-commercial use, so check the plan terms before using it as an official CTMO service.

1. Install [Tailscale for Windows](https://tailscale.com/docs/install/windows), sign in, and choose a plan. Do not send anyone your Tailscale login or auth key.
2. The connected device's hostname is `chad.tailcc89e3.ts.net`. This hostname alone does not make the app public.
3. Update `backend/.env` with the exact hostname (no trailing slash):

   ```dotenv
   DJANGO_ALLOWED_HOSTS=<device>.<tailnet>.ts.net
   DJANGO_CORS_ALLOWED_ORIGINS=https://<device>.<tailnet>.ts.net
   DJANGO_CSRF_TRUSTED_ORIGINS=https://<device>.<tailnet>.ts.net
   FRONTEND_URL=https://<device>.<tailnet>.ts.net
   RECAPTCHA_ALLOWED_HOSTNAMES=<device>.<tailnet>.ts.net
   DJANGO_TRUST_HTTPS_PROXY=True
   ```

   Use a long random `DJANGO_SECRET_KEY`. For a public service, use `DJANGO_DEBUG=False` with a production frontend/backend server and persistent database/media storage. Register the new hostname in the Google reCAPTCHA site key settings, too. Restart both application processes after changing configuration.

4. The user explicitly approved publishing the whole site, including report media. Tailscale Funnel runs in background mode for device `chad` and proxies `https://chad.tailcc89e3.ts.net/` to the local frontend on `127.0.0.1:3100`; Waitress serves Django on `127.0.0.1:8100`. `backend/.env` points invitation links at the public hostname. Windows Task Scheduler runs `HapsayDalan Public Server` when `CHAD\User` signs in. It starts the frontend and backend without VS Code and checks them every 60 seconds. To reinstall the task from that Windows account, run `scripts/install-public-autostart.ps1`. The laptop must remain on and signed in; PostgreSQL and Tailscale are configured as automatic Windows services. Verify the public URL after a Windows restart before relying on it for reports.

5. The `/admin-ctmo` page was confirmed to open on a phone using mobile data after public DNS propagated. Home, CTMO, frontend JavaScript, and API returned HTTP 200 through the public HTTPS address. Resend old invitations: existing emails still contain the old LAN URL, and their tokens may have expired. Test login and report submission in the browser before relying on the public site for normal operations.

The existing development server on port 3000 must not be exposed. The production container setup in this directory is for a future server and has not been launched on this laptop.

## Recovering an HTTP 502

Check `tailscale funnel status`. The `/` proxy must target `http://127.0.0.1:3100`, not port 3000 (the HTTPS development server). If the mapping was changed, restore it from PowerShell on this laptop:

```powershell
& .\scripts\start-public.ps1
& 'C:\Program Files\Tailscale\tailscale.exe' funnel --bg --yes http://127.0.0.1:3100
& 'C:\Program Files\Tailscale\tailscale.exe' funnel status
```

The background Funnel setting persists independently of the terminal. Verify `/`, `/admin-ctmo`, and `/api/csrf/` through the public HTTPS hostname after recovery. The scheduled task checks the application processes; it does not change the Funnel configuration.
