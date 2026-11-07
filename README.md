# CodeCollab

CodeCollab is a React development workspace with Firebase Authentication, Firestore, Cloud Storage, callable Cloud Functions, Monaco and Yjs. A separate WebSocket service delivers cursor awareness. This release has passed local emulator and browser checks. The staging frontend is live at https://codecollab-rudra.web.app. See STAGING.md for verified services and outstanding backend requirements.

## Run locally

Use Node 22, Java 21, Firebase CLI, and Chrome for browser testing. Install each package from its lockfile.

    npm ci --prefix client
    npm ci --prefix functions
    npm ci --prefix presence
    firebase emulators:start --project demo-codecollab --only auth,firestore,functions,storage

In another terminal, copy the root .env.example to client/.env.local and set VITE_EMULATORS=true. Set VITE_PRESENCE_URL=ws://127.0.0.1:8081 for live cursors. Run npm start. Vite prints the local address. To start the presence server against the emulators, use a separate PowerShell terminal.

    $env:GCLOUD_PROJECT='demo-codecollab'
    $env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
    $env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
    npm start --prefix presence

The editor batches local Yjs mutations for 200 ms. Firestore stores immutable binary updates and listeners apply them idempotently across instances. Client models never initialize from a stale plain-text copy. The presence service verifies Firebase tokens and monitors membership. It shares ephemeral selections through a server-only collection. Configure a Firestore TTL policy for the presence collection group on expiresAt. Presence writes incur costs; measure expected concurrent editing traffic before rollout.

## Test

    npm test
    npm run test:security

The first command checks the preserved local application. The second targets demo-codecollab emulators. For browser tests run the client with emulation enabled on port 5178 or set TEST_URL to its local URL, then run npm run test:browser. CHECK_PRESENCE=1 also requires two live cursor sessions. Tests create synthetic accounts in the local emulators. npm run build emits client/dist. Firebase variables are embedded during the build.

## Deployment checklist

1. Select the intended Firebase project ID explicitly. Enable email/password and Google in Authentication > Sign-in method, configure the support email and authorized domains, and register a web app in Project settings.
2. Create the default Firestore database in the intended region. In Storage > Get started, provision a bucket, select its location and verify the required billing plan. Enter the actual bucket name in the frontend environment. Review bucket CORS for authenticated browser downloads on the intended origin.
3. Review firestore.rules, storage.rules and firestore.indexes.json with the emulator suite. Cloud Storage project access looks up Firestore memberships and requires the cross-service permission during setup. Enable TTL for presence.
4. Review and deploy the Cloud Functions source on a supported Node runtime using application default credentials. The backend requires access to Firebase Auth, Firestore and Storage. Use managed service identity. Keep private credentials out of client variables.
5. Deploy the presence directory to Cloud Run using its Dockerfile and a scoped service account. Set GCLOUD_PROJECT and configure its timeout for WebSocket sessions. Clients reconnect after expiry. Route WebSocket traffic directly to the service over TLS. Set VITE_PRESENCE_URL to its wss address.
6. Set all public Firebase variables in client/.env.production.local and set VITE_EMULATORS=false. In Authentication > Templates, customize verification and reset action URLs to the frontend origin. Rebuild with npm run build. After reviewing the release and its target run firebase deploy --project YOUR_PROJECT_ID --only firestore,storage,functions,hosting.
7. Verify public Hosting, Google OAuth, real email delivery, bucket access, membership revocation, snapshots and two browsers editing across instances. No production deployment is recorded for this release.

## Existing data

The root server.js and public directory preserve the independent JSON application. Use npm run legacy for that application only. The older Socket.IO server and React screen are retained for reference. Their authentication and local storage are separate from the Firebase entry point. Keep both data directories private. The old Render descriptor targets the legacy architecture and must not be used for Firebase deployment.

For migration, make an encrypted offline backup, establish a verified owner-to-Firebase-UID mapping and dry-run a separate import into a nonproduction project. Generate each file’s initial Yjs update once and save a stable ID map for retries. Reconcile member roles, content hashes and counts before cutover. The new code performs no automatic data import. Do not migrate password hashes, sessions or old reset codes.

See SCHEMA.md and CHANGELOG.md for data layout and release scope.

