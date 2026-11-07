# Firebase schema

- users/{uid} stores the display name, editor theme, minimap and notification preference. Firebase Authentication owns identity.
- users/{uid}/{projects|teams}/{id} is a transactionally updated membership index for listing. The workspace member document is the authority.
- projects/{id} and teams/{id} store owner, name, archive status and server timestamps. Their members/{uid} records hold owner, admin, editor or viewer. Their activity/{event} records identify server-side operations.
- invitations/{sha256} is server-only and contains one workspace path, role and expiration. A transaction redeems and deletes the invitation. Workspace deletion invalidates outstanding links.
- projects/{id}/files/{file} stores a stable ID, display path and creation time. Its updates/{update} records contain Yjs bytes, author UID and server creation time. Deletes create server-only ID tombstones. File renames preserve update history.
- File presence/{connection} records are server-only and expire. Cursor coordinates are Yjs relative positions.
- projects/{id}/messages/{message} stores author UID, text and timestamp. Clients page newest-first by createdAt. Notification delivery uses deterministic IDs and retry-safe transactions.
- users/{uid}/notifications/{notification} stores a message event, workspace ID, read flag and timestamp. Message text stays inside the project permission boundary.
- projects/{id}/versions/{version} holds timestamp, file count and creator. Its server-only backup/files contains merged binary CRDT states and filenames. Restoring creates a separate private project. Transactional inline backups currently support 64 files, 700 KB merged data and 1000 updates per file.
- accountClosures/{uid} blocks membership creation during account deletion. Account deletion requires recent authentication and departure from every workspace.
- Storage paths are avatars/{uid}/profile and projects/{id}/assets/{filename}. Account images are private. Project asset reads require current membership. Creation requires an editing role in an active project.
- Queries use document IDs and single-field ordering. No custom composite index is currently required. Collection listeners and snapshots are bounded except for file CRDT replay. Load-test compaction and replay for long-lived documents before large deployments.
- Team project links reference projects with teamId. Team membership and project role indexes are updated together. Teams support up to 20 linked projects; project initialization supports up to 200 team members. Folders have stable parent IDs. Snapshots preserve folder hierarchy. A background trigger archives compressed snapshots in private Storage and another periodically merges batches of CRDT updates transactionally.

