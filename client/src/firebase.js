import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import {
  getFunctions,
  connectFunctionsEmulator,
  httpsCallable,
} from "firebase/functions";
import { getStorage, connectStorageEmulator } from "firebase/storage";
const env = import.meta.env;
const emulator = env.VITE_EMULATORS === "true";
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || (emulator ? "demo-key" : undefined),
  projectId:
    env.VITE_FIREBASE_PROJECT_ID || (emulator ? "demo-codecollab" : undefined),
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || (emulator ? "demo-codecollab.firebaseapp.com" : undefined),
  storageBucket:
    env.VITE_FIREBASE_STORAGE_BUCKET ||
    (emulator ? "demo-codecollab.appspot.com" : undefined),
  appId: env.VITE_FIREBASE_APP_ID,
};
export const configured = Boolean(config.apiKey && config.projectId);
const app = configured ? initializeApp(config) : null;
export const auth = app && getAuth(app),
  db = app && getFirestore(app);
const functions = app && getFunctions(app);
export const storage = app && config.storageBucket ? getStorage(app) : null;
if (emulator && app) {
  if (storage) connectStorageEmulator(storage, "127.0.0.1", 9199);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
export const command = async (data) =>
  (await httpsCallable(functions, "workspace")(data)).data;

