import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBcN5_z7hz8P2sGe2gQtH9FE8ARqBWYuOg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mockmate-pro-f2f13.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mockmate-pro-f2f13",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mockmate-pro-f2f13.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "661737376926",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:661737376926:web:d46e2698747a23f9ecbf8f",
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
export const auth = getAuth(app)
export default app
