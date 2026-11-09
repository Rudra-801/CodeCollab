# Verification record — 7 November 2026

- Clean client installation and production Vite build succeeded. Monaco and y-monaco resolve locally. The lazy IDE bundle is approximately 610 KB gzip.
- The legacy smoke test passed.
- The Firebase emulator integration script passed email registration, verification, password reset and replay rejection, logout/login, private project access, viewer write rejection, invite replay denial, membership removal, private Storage reads/writes, snapshots, duplication and team ownership transfer.
- Two independent Chrome contexts passed concurrent Monaco editing, reconnection after offline editing, WebSocket peer visibility, project chat, persistent content after refresh, and snapshot restoration into a new project.
- The editor remained visible without horizontal document overflow at 1920×1080, 1440×900, 1366×768, 768×900 and 390×844. These checks cover layout bounds, not a full touch-device accessibility audit.
- Client production dependency audit reported zero findings. Functions and presence each reported six moderate findings and zero high or critical findings.
- Live OAuth, actual email delivery, deployed Rules, production Storage, Hosting, Cloud Run scaling and load testing remain unverified.
- Additional emulator checks verified folder rename, rejection of nonempty folder deletion, file tombstones, inherited team-project access and removal. The two-browser run also verified notification delivery.
- Staging Hosting, live email/password registration and sign-in, and Firestore read denial were verified. Project rename, archive, archived file write denial, restore and deletion passed in the emulator. See STAGING.md for public deployment scope.
- Public staging passed real reset email delivery, password reset, replay rejection, sign-in, personal project creation, file creation, Monaco editing and persistence after refresh. JavaScript and TypeScript playgrounds passed public browser tests for input, output, runtime errors, interruption, cancellation, absent host globals and output bounds. Static HTML rendering and preview stop passed in the two-browser emulator suite.


## 2026-11-09 execution and release checks

The Cloud Billing API reports billingEnabled=false for codecollab-rudra. No backend deployment retry was made after this read-only check. Hosting remains independently deployable.

The IDE workspace panel now separates Output, Tests, Source Control and AI Assistant. Tests execute the selected document with the existing disposable browser runtime. The public acceptance script checks a real expected-output verdict and switching back to Output.

Local checks passed for the guest draft, registration, atomic save, workspace content, Simple/Pro switching, toolbar execution and refresh. Firebase Emulator Suite passed authentication, password reset, replay denial, cross-user access, viewer permissions, Storage rules, snapshots, duplication and team ownership. The client production dependency audit reported zero vulnerabilities. These security results do not establish hosted sandbox safety.

Remaining hosted runtime capabilities require E2B_API_KEY and a built E2B_TEMPLATE. Full CPython and Java, C, C++, C#, Go, Rust, PHP and Ruby have no successful hosted test recorded. Existing QuickJS JavaScript/TypeScript and Skulpt Python browser execution remains available. Interactive workspaces and authenticated full-stack preview routing remain incomplete. No terminal isolation claim is made.

Owner actions remain billing activation in Firebase Usage and billing, default Storage bucket provisioning, Google sign-in provider configuration, GitHub App client configuration and server-side credentials, and AI provider credentials. Do not supply secrets through the browser client configuration.

Dependency maintenance follow-up: compatible npm audit fixes in functions and presence removed the six moderate transitive findings in each dependency tree. Both production audits now report zero vulnerabilities. Emulator security regression passed after the lockfile updates. Local emulators used Node 24, while the deployment runtime remains Node 22. Public browser tests passed workspace panel Tests with a real expected-output verdict, mode switching, persistence and all three browser runtimes.
