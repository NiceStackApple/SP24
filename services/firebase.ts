
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAy8baUawnRURK37hxzDDmnlGlEOMVQ248",
  authDomain: "survival-protocol-24.firebaseapp.com",
  projectId: "survival-protocol-24",
  storageBucket: "survival-protocol-24.firebasestorage.app",
  messagingSenderId: "780463820336",
  appId: "1:780463820336:web:eb0b428cf5e5413fa667f5",
  measurementId: "G-SR8WT3K828"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app); // For presence/disconnect handling
export const analytics = getAnalytics(app);
