# Laptop-independent cloud deployment

Status (2026-10-30): the cloud site is live at https://hapsaydalan.onrender.com. The existing database was transferred and verified: 53 reports, 3 users, 4 officers, and 22 case activities. All 54 referenced evidence files were copied and verified by SHA-256. User password hashes and permission flags were preserved. Private snapshot and evidence backups are retained under `deploy/runtime/`; do not publish them.

Live checks passed for the homepage, admin authorization, report listing, photo/video evidence links, and protected additional evidence downloads. The old laptop origin redirects to Render and rejects writes through `backend/.cloud-migration.json`; keep that ignored marker in place to prevent the old database receiving new reports. Do not treat the laptop database as the current cloud database. The Render site does not depend on the laptop or Tailscale.

Email API verification passed after authorizing Render's outbound ranges (`74.220.52.0/24` and `74.220.60.0/24`) in Brevo. The cloud verification request returned HTTP 200, confirming provider acceptance of one test email to the existing main administrator. Actual inbox receipt remains for the recipient to confirm. No passwords were reset by this verification-code test.

## Services

- Render Free: one Docker web service builds React and runs Django/Gunicorn. React and `/api/` share one HTTPS origin, avoiding cross-site login cookies. Render supplies an `https://<available-service-name>.onrender.com` address; no domain purchase or Tailscale installation is required.
- Supabase Free: PostgreSQL using the IPv4-compatible **Session pooler** and one **private** Storage bucket named `evidence`. The same bucket has separate `media/` and `private-evidence/` prefixes. Django returns temporary signed URLs for original evidence. Follow-up attachments still require the existing owner/staff API authorization and have no direct public URL in the app.
- Brevo Free: transactional email via HTTPS. Render Free blocks outbound SMTP, including Gmail ports 465/587. A verified sender and an activated transactional account are required. Provider acceptance does not guarantee inbox delivery; verify actual arrival before switching users.

Free limits matter: Render sleeps after 15 idle minutes and may take about a minute to wake. Supabase can pause an inactive free project. Storage, upload-size, database, bandwidth and email quotas apply. This removes the dependency on the laptop; it does not guarantee uninterrupted availability. Do not use Render's expiring free PostgreSQL service or its ephemeral filesystem for reports/evidence.

Sources: [Render Free](https://render.com/docs/free), [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supabase Storage S3](https://supabase.com/docs/guides/storage/s3/authentication), [Supabase pricing](https://supabase.com/pricing), [Brevo senders](https://developers.brevo.com/docs/getting-started-with-senders-and-domains).

## 1. Create the accounts and clean source repository

Create Render, Supabase, and Brevo accounts on their free plans. Stop if a service requires a payment method; do not select a paid upgrade. The provider can require account verification before granting service.

Generate a clean source ZIP from the repository root:

```powershell
python scripts/package-cloud.py
```

Extract `deploy/runtime/hapsaydalan-cloud-source.zip` into a **new private GitHub repository**. Keep `render.yaml` at its root. Use the clean package: the existing working repository has tracked evidence and old history that do not belong in a deployment source upload. The package excludes `.env` files, certificates, local databases, reports/evidence, virtual environments, `node_modules`, builds, and Git history. Data moves separately through the private steps below.

## 2. Prepare Supabase

1. Create a Free project, ideally near Render's Singapore region. Save the database password privately.
2. Open **Connect**, choose **Session pooler**, port **5432**, and copy the PostgreSQL connection URI. Use the exact pooler host and username shown there; the username usually includes the project reference. URL-encode special password characters. Use this as `DATABASE_URL`. TLS is required by cloud settings.
3. Create a Storage bucket named `evidence` with **Public bucket disabled**. Do not add public read/list policies. Configure the allowed upload size to cover the app's photo/video limit, within the free-plan limit.
4. Enable the S3 protocol and generate server-side S3 access credentials. Copy the **S3 Access Key ID**, **Secret Access Key**, **region**, and HTTPS **endpoint** from the S3 configuration. These are not the browser anon/publishable key or the database password. Keep them server-side.
5. Disable the Supabase Data API if unused. Django connects through PostgreSQL; do not expose its app tables using anonymous Data API policies.

## 3. Prepare email and CAPTCHA

In Brevo, verify the sender email and activate transactional sending. Follow any required sender-domain verification steps. Create an API key and keep it private. Use a sender accepted by Brevo; delivery from a personal email domain can be subject to provider restrictions. Do not switch the app until verification codes actually arrive.

Keep the existing Google reCAPTCHA v2 checkbox key pair, or create a separate cloud key pair. Register the final Render hostname with Google before testing submissions. The server verifies that the CAPTCHA hostname matches its own cloud hostname. API keys for routing/SMS remain optional; leaving them blank does not enable those external services.

## 4. Deploy Render

Connect the new private repository to Render. Choose **New → Blueprint**, select the repository and its root `render.yaml`. Confirm the service compute plan is **Free**. The Blueprint does not create a Render database or paid disk.

Enter the prompted secret values using the dashboard:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase Session pooler URI |
| `EVIDENCE_S3_ACCESS_KEY_ID` | Supabase S3 Access Key ID |
| `EVIDENCE_S3_SECRET_ACCESS_KEY` | Supabase S3 Secret Access Key |
| `EVIDENCE_S3_BUCKET` | `evidence` (already set) |
| `EVIDENCE_S3_ENDPOINT_URL` | S3 HTTPS endpoint from Supabase |
| `EVIDENCE_S3_REGION` | S3 region from Supabase |
| `BREVO_API_KEY` | Brevo transactional API key |
| `DEFAULT_FROM_EMAIL` | `HapsayDalan <verified-sender@example.com>` |
| `RECAPTCHA_SITE_KEY` | Public Google checkbox site key |
| `RECAPTCHA_SECRET_KEY` | Google secret key |
| `OPENROUTESERVICE_API_KEY` | Existing routing key, if configured |

Render generates `DJANGO_SECRET_KEY` and supplies `RENDER_EXTERNAL_HOSTNAME` automatically. Keep the cloud secret stable across redeploys. Do not copy laptop `.env` wholesale. Cloud settings use `DEBUG=False`, disable automatic LAN hosts, and derive the frontend/email link origin from the Render hostname.

The container startup checks deployment settings, collects static assets, applies migrations and starts Gunicorn on Render's `PORT`. `/healthz` checks database availability without disclosing connection details. It is exempt from HTTPS redirection for infrastructure probes; the public site uses Render HTTPS. No default admin password or public registration endpoint is created.

## 5. Transfer existing users, cases and evidence

Do this from the laptop before directing real users to the new link. The source ZIP does **not** contain case data. Avoid creating users or reports in the destination before import.

1. Arrange a short submission pause on the old site while taking the final snapshot and copying files; otherwise new reports received during the transfer will be missing from the new site. Keep the old data intact for rollback.
2. Export from the repository root to an ignored private local file. Choose a new filename for each backup; export refuses to replace an existing file:

   ```powershell
   & backend/venv/Scripts/python.exe backend/manage.py cloud_snapshot export deploy/runtime/cloud-final-snapshot.json
   ```

   The snapshot includes auth users/groups and all `reports` models, including officer records and case activity. Password hashes are preserved. Django browser sessions and Django's separate admin-site log are not copied. Users should sign in again and request fresh verification links/codes on the cloud site.

3. Copy `deploy/cloud.env.example` to `deploy/.env.cloud`. Fill it locally with the same cloud values from the Render/Supabase/Brevo dashboards. Set the actual `RENDER_EXTERNAL_HOSTNAME` and cloud `DJANGO_SECRET_KEY` there. Do not paste these values into chat or GitHub. Install the cloud tools if needed:

   ```powershell
   & backend/venv/Scripts/python.exe -m pip install -r backend/requirements-cloud.txt
   ```

4. Check the target and import into the **new** cloud app database:

   ```powershell
   & backend/venv/Scripts/python.exe scripts/cloud-manage.py check --deploy --fail-level WARNING
   & backend/venv/Scripts/python.exe scripts/cloud-manage.py migrate --noinput
   & backend/venv/Scripts/python.exe scripts/cloud-manage.py cloud_snapshot import deploy/runtime/cloud-final-snapshot.json
   ```

   Import refuses a destination containing users or report data and refuses a modified officer directory. The migration's four default officers are replaced atomically by the snapshot's directory. No database reset or overwrite is performed.

5. Upload the files referenced by the imported reports:

   ```powershell
   & backend/venv/Scripts/python.exe scripts/cloud-manage.py upload_cloud_evidence --media-root backend/media --private-root backend/private_evidence
   ```

   This preserves filenames and verifies every copied file by SHA-256. It refuses missing files, paths outside the supplied folders and conflicting cloud objects. Original laptop files are retained. If the laptop uses custom evidence paths in `.env`, pass those paths instead. Transfer can resume after an interruption; it verifies existing matching files instead of overwriting them.

6. Compare cloud/local report counts and references, user permissions, officer assignments and activity. Verify photo and video playback, additional evidence authorization, staff login, email code delivery, invitations, password reset, and a complete test submission on the new HTTPS link. Keep test submissions clearly identified. Do not disable the old site until these pass.

After migration, laptops and phones can use the Render URL without Tailscale. Update bookmarks and resend invitations; old emails still point to the laptop hostname. Keep separate backups of the cloud database and both evidence prefixes. Durable storage is not a backup.

## Local validation boundary

The cloud Django settings, email/storage adapters and migration tools can be tested locally. A Linux Docker build, actual provider credentials, cloud storage uploads and access while the laptop is shut down must still be verified against the created accounts before calling the migration complete.
