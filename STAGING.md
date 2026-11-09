> Current deployment constraint: free infrastructure only. Firebase remains on Spark. Do not activate Blaze or provision paid services. The optional AI and awareness gateway is documented in gateway/README.md and targets Cloudflare Workers Free. Earlier Blaze/E2B deployment notes below are historical and are not the current deployment instructions.

# Staging release

The dedicated Firebase project is codecollab-rudra (project number 889266469859). The staging alias is recorded in .firebaserc. The default Firestore database is in us-central1, colocated with the callable Functions region. Hosting serves https://codecollab-rudra.web.app.

Build using the public web app configuration in client/.env.staging.local and npm run build --prefix client -- --mode staging. Obtain those values from the registered web app with firebase apps:sdkconfig WEB 1:889266469859:web:f076282435d30423287ed6 --project codecollab-rudra. Deploy with an explicit staging project. Production requires a separate approved target.

## Live checks

Hosting returned HTTP 200, rendered the landing page and opened login. Playwright captured landing screenshots at the five requested widths without horizontal overflow. A disposable staging identity registered, signed in with a password and was deleted. An unauthenticated Firestore document read returned 403 after deployment of the reviewed rules.

## Service setup still required

- In Firebase Authentication > Sign-in method > Google, enable the provider and configure the staging support email. Test Google consent with an authorized account. Live password recovery passed against a controlled test mailbox: the email arrived, the reset succeeded, sign-in with the new password succeeded and replay returned HTTP 400.
- Cloud Functions deployment was rejected because enabling Artifact Registry requires Blaze. Link billing to the staging project before backend deployment.
- In Storage > Get started, create a bucket and configure the actual bucket name. Deploy Storage rules and test membership-based reads and writes. Deploy the presence service separately to Cloud Run and supply its TLS WebSocket URL.
- For single-file execution, the callable runner uses E2B. Supply E2B_API_KEY through backend secret management and E2B_TEMPLATE with a provider-approved template. The template must enforce CPU and RAM quotas, include the selected language toolchains, use an unprivileged user with no sudo, and contain no secrets. Runtime internet access and public ingress are disabled at sandbox creation. Each request creates its own sandbox and kills it after completion; provider expiry bounds its lifetime after failure. Verify isolation, output limits, cancellations, quotas and all compiler paths against the actual provider before enabling VITE_EXECUTION_ENABLED. The hosted compiler service has no verified runtime. The public playground independently runs JavaScript and TypeScript inside browser-side QuickJS WebAssembly, with a dedicated Worker, a 24 MiB guest heap, deadline, cancellation and output cap.
- For coding assistance, provision a server-side GEMINI_API_KEY and GEMINI_MODEL. Review the selected-code disclosure and test a real model response before enabling VITE_AI_ENABLED. Suggestions are read-only.
- The editor supports a sanitized static HTML preview. Live project terminals and full-stack preview routing still require implementation. The GitHub App broker supports device authorization, encrypted token storage, repository browsing, individual file import and a SHA-checked commit against the reviewed remote file. It requires an installed GitHub App, device flow enabled, selected repository Contents permissions, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET and a private 32-byte base64 GITHUB_TOKEN_KEY. Verify the integration with a test installation before enabling VITE_GITHUB_ENABLED. The Git remote used for releasing CodeCollab is separate from end-user GitHub integration.

No production deployment was performed.

- Bind optional provider secrets via Firebase Secret Manager. For the corresponding Functions deployment, set CODECOLLAB_ENABLE_RUNNER, CODECOLLAB_ENABLE_AI or CODECOLLAB_ENABLE_GITHUB to true in the backend environment only after provisioning the named secrets. Keep browser feature switches disabled until the staging acceptance checks pass.


## Read-only infrastructure verification, 2026-11-09

Cloud Billing reports billingEnabled=false for codecollab-rudra. Enable Blaze through Firebase Console > Usage and billing when the owner is ready to authorize billing. Backend deployment has not been retried while billing is disabled. Default Firebase Storage bucket lookup returns HTTP 404. After billing setup, use Storage > Get started to provision the intended bucket, copy its actual name into VITE_FIREBASE_STORAGE_BUCKET, rebuild, deploy reviewed Storage rules and run upload/download authorization tests.

The Google sign-in provider reports enabled=true. Authorized domains include localhost, codecollab-rudra.firebaseapp.com and codecollab-rudra.web.app. A real interactive Google login is still unverified. Do not report Google production sign-in PASS from configuration alone.

Hosted execution requires server-side E2B_API_KEY, E2B_TEMPLATE and CODECOLLAB_ENABLE_RUNNER=true. The template build script is functions/sandbox/build.js. Review the template and test real isolation and all runtimes before enabling VITE_EXECUTION_ENABLED=true. This adapter currently handles single-file execution, not persistent interactive workspaces or authenticated full-stack preview routing.

AI requires GEMINI_API_KEY, GEMINI_MODEL and CODECOLLAB_ENABLE_AI=true on the trusted backend. The request includes an instruction to treat repository context as untrusted data. This instruction is a mitigation, not a security boundary. Suggestions remain read-only. Real provider responses are unverified.

GitHub uses device authorization. Enable device flow on the GitHub App and install it only on intended repositories with Contents read/write and Metadata read permissions. This implementation does not require an OAuth redirect callback or webhook. Supply GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET, a random 32-byte base64 GITHUB_TOKEN_KEY and CODECOLLAB_ENABLE_GITHUB=true through server-side configuration/secret management. Do not invent a callback URL for this device-flow implementation. The current broker handles individual file import and SHA-checked commits, not a complete multi-file Git working tree.
