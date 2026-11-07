CODECOLLAB — STEP 2

Implemented:
- Create Room with generated Room ID
- Join Room using Room ID + username
- Socket.IO room membership
- Live connected-users list
- Copy Room ID
- Leave Room
- Workspace shell

RUN
Terminal 1:
cd client
npm install
npm run dev

Terminal 2:
cd server
npm install
npm run dev

TEST
1. Open http://localhost:5173 in two browser tabs.
2. Tab 1: enter a name and Create Room.
3. Copy Room ID.
4. Tab 2: enter another name + same Room ID and Join Room.
5. Both tabs should show both users.

Next: Monaco Editor + real-time code synchronization.
