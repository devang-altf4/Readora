# Readora deployment and Android distribution

## Render API

Create a Render Web Service from this repository with the API root directory set to `services/api`.

- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check path: `/api/v1/health`

Add these environment variables in Render. Keep the MongoDB URI and credentials as secrets:

```text
APP_ENV=production
MONGODB_URI=mongodb+srv://...
MONGODB_DATABASE=readora
AUTH_SESSION_DAYS=30
STORAGE_ROOT=/var/data/storage
CORS_ORIGINS=*
```

The API currently stores uploaded originals and processed HTML locally. Render's default filesystem is ephemeral. Attach a persistent disk mounted at `/var/data` for a friend-test deployment, or move `AbstractStorageService` to object storage before scaling to production. MongoDB Atlas must allow Render's outbound IP policy (for a quick test, allow `0.0.0.0/0` with a strong database password; tighten it later).

The three starter books live in `services/api/catalog_assets` and are seeded into
MongoDB automatically when the API starts. Keep that folder in the deployed
repository; users see the shared shelf and can add their own library copy.

After deploy, verify:

```text
https://<service>.onrender.com/api/v1/health
```

## Point the mobile app at Render

`apps/mobile/src/constants/config.ts` already prioritizes `EXPO_PUBLIC_API_BASE_URL`. Set it to:

```text
https://<service>.onrender.com/api/v1
```

Use that value in the EAS project environment for both the `preview` and `production` environments. Do not ship the current LAN URL in a friends/Play Store build.

## APK for friends

From `apps/mobile`:

```powershell
npm install
npx eas login
npx eas build --platform android --profile preview
```

The `preview` profile creates an installable APK. Download the artifact from the EAS build page and send the link/file to friends. They may need to allow installation from that browser/file manager.

## Google Play Store later

Use the `production` profile, which creates an Android App Bundle:

```powershell
npx eas build --platform android --profile production
npx eas submit --platform android --profile production
```

Before the first submission, choose a permanent unique `android.package` value in `app.json`, create the Play Console app, complete the store listing/privacy/data-safety forms, and keep the same signing key for every update. Increase `versionCode` for each release. Play Store builds should use HTTPS Render URLs and a durable object-storage plan rather than local ephemeral storage.
