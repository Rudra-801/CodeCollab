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

2026-11-09 Node 22 follow-up: Node 22.23.4 production build, root smoke test and complete emulator security suite passed. Added execution/AI cross-project denial checks and explicit missing-provider contract checks, including GitHub. Runner rejects unknown actions and malformed provider exit results. Google provider is enabled and staging domain authorized, but real Google login remains unverified. Cloud billing remains disabled and default Storage bucket lookup returned 404. Hosted terminal, persistent workspace execution, authenticated React/Node previews and complete Git operations remain incomplete implementation work in addition to infrastructure setup.


## Provider contract regression coverage

tests/provider-contracts.test.js loads the actual callable runner and assistant modules with mocked provider and Firestore dependencies. Node 22 reports 20 passing root tests including the existing server smoke test. Contract coverage includes all eleven language command/filename mappings, stdin delivery, non-root provider calls, disabled network/public ingress configuration, startup cancellation, authorization failure, provider exceptions, malformed exit status, output truncation and cleanup, plus AI request construction and provider errors. These tests use mock output and do not establish actual runtime availability, isolation, terminal support or live AI responses.

The runner now also truncates stdout and stderr in the returned API response, independently of the sandbox head command. Real resource exhaustion and sandbox escape tests remain blocked on a configured provider. Interactive terminal, multi-file workspace execution, authenticated preview routing and full Git working-tree operations remain incomplete engineering work, beyond the missing credentials.


## Free-only AI and presence gateway, 2026-11-09

The gateway package adds Groq, OpenRouter and Gemini streaming adapters, configurable fallback, live model-catalog validation, free OpenRouter model filtering, Firebase REST identity/membership checks and Durable Object quotas. A separate awareness room implements the existing client protocol with authenticated recipient checks. No provider keys or Cloudflare account authentication are available in this environment. Wrangler whoami reports unauthenticated; deploy --dry-run succeeds. No gateway was publicly deployed and no paid infrastructure was created.

Node 22.23.4 runs 34 root tests successfully. New gateway tests use mocked upstream API streams and authorization responses. Mocked browser QA verifies provider/model selection, streaming text, a diff shown before any mutation, user-approved replacement and Monaco undo. The frontend keeps AI disabled until VITE_AI_GATEWAY_URL is configured. Existing QuickJS/Skulpt runtime flows remain separate from hosted native execution. Native-language execution, a real terminal, full React/Node preview and complete Git working-tree operations remain unsupported. The new awareness adapter has no real public two-user test yet.
