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
