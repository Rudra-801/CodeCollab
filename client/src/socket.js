import { io } from 'socket.io-client';
const url = import.meta.env.VITE_SOCKET_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:5000');
export const socket = io(url, { autoConnect:false, reconnection:true, reconnectionAttempts:Infinity, reconnectionDelay:500, reconnectionDelayMax:5000 });
