# CodeCollab final verification

## Local
1. `npm install`
2. `npm run install:all`
3. `npm run dev`
4. Open `http://localhost:5173` (do not use Live Server / Go Live).

## Two-user acceptance test
- Register two accounts in normal + incognito windows.
- Owner creates project and copies Editor invite.
- Second account opens invite and joins.
- Both edit the same file simultaneously; both converge to the same content.
- Create, rename and delete a file; verify both clients update.
- Send chat from both clients.
- Disconnect one client, reconnect, and verify it rejoins.
- Create a snapshot, edit files, restore snapshot as owner.
- Create a Viewer invite and verify the viewer cannot modify files.

## Production
- Create MongoDB Atlas database.
- Set `MONGODB_URI` and `MONGODB_DB` in the hosting environment.
- Deploy using `render.yaml` or equivalent Node host.
- Confirm `/api/health` reports `persistence: mongodb` and `collaboration: yjs-crdt`.
- Repeat the two-user acceptance test using two separate devices/networks.

## Security boundary
Code execution is intentionally not included. Never execute arbitrary collaborator code directly on the application server. Add a sandbox/container service before adding a Run button.
