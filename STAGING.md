# Staging release

The dedicated Firebase project is codecollab-rudra (project number 889266469859). The staging alias is recorded in .firebaserc. The default Firestore database is in us-central1, colocated with the callable Functions region. Hosting serves https://codecollab-rudra.web.app.

Build using the public web app configuration in client/.env.staging.local and npm run build --prefix client -- --mode staging. Obtain those values from the registered web app with firebase apps:sdkconfig WEB 1:889266469859:web:f076282435d30423287ed6 --project codecollab-rudra. Deploy with an explicit staging project. Production requires a separate approved target.

## Live checks

Hosting returned HTTP 200, rendered the landing page and opened login. Playwright captured landing screenshots at the five requested widths without horizontal overflow. A disposable staging identity registered, signed in with a password and was deleted. An unauthenticated Firestore document read returned 403 after deployment of the reviewed rules.

## Service setup still required

- In Firebase Authentication > Sign-in method > Google, enable the provider and configure the staging support email. Test consent and recovery email delivery against a controlled test mailbox.
- Cloud Functions deployment was rejected because enabling Artifact Registry requires Blaze. Link billing to the staging project before backend deployment.
- In Storage > Get started, create a bucket and configure the actual bucket name. Deploy Storage rules and test membership-based reads and writes. Deploy the presence service separately to Cloud Run and supply its TLS WebSocket URL.
- For single-file execution, the callable runner uses E2B. Supply E2B_API_KEY through backend secret management and E2B_TEMPLATE with a provider-approved template. The template must enforce CPU and RAM quotas, include the selected language toolchains, use an unprivileged user with no sudo, and contain no secrets. Runtime internet access and public ingress are disabled at sandbox creation. Each request creates its own sandbox and kills it after completion; provider expiry bounds its lifetime after failure. Verify isolation, output limits, cancellations, quotas and all compiler paths against the actual provider before enabling VITE_EXECUTION_ENABLED. The current deployment has no verified runtime.
- For coding assistance, provision a server-side GEMINI_API_KEY and GEMINI_MODEL. Review the selected-code disclosure and test a real model response before enabling VITE_AI_ENABLED. Suggestions are read-only.
- Live project terminals, preview routing and in-product GitHub App synchronization still require implementation. The Git remote used for releasing CodeCollab is separate from end-user GitHub integration.

No production deployment was performed.
