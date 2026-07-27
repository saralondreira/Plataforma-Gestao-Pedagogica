import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { showToast } from "./toast.js";

const firebaseConfig = {
  apiKey: "AIzaSyAcDx28vAbQ3HUBQq0fAKLQHtTVmcHolZA",
  authDomain: "plataforma-gestaopedagogica.firebaseapp.com",
  projectId: "plataforma-gestaopedagogica",
  storageBucket: "plataforma-gestaopedagogica.firebasestorage.app",
  messagingSenderId: "838874023714",
  appId: "1:838874023714:web:6b12a1e1466e67fe8a877b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);