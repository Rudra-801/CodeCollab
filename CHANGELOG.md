# Release changes

- Preserved both original implementations and excluded local databases, credential files and build products from Git.
- Made the Firebase React application the default entry point. Added local Monaco imports, a clean dependency lock and Yjs binding.
- Added Firebase authentication, recovery, profile preferences, project and team memberships, invitations, archive and soft deletion, asset access, durable editing, chat and notification delivery.
- Added recoverable project snapshots, a dedicated WebSocket awareness service, Firebase rules and emulator configuration, CI and two-session Chrome testing.
- Known gaps include scalable CRDT compaction, large Storage-backed snapshots, team-to-project inheritance, first-class folder management, comprehensive mobile interaction tests and production verification.
