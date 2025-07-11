import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDgCcVikT0zwkegkjubW2mcTzYnnRTAY_E",
  authDomain: "loomaproj.firebaseapp.com",
  projectId: "loomaproj",
  storageBucket: "loomaproj.firebasestorage.app",
  messagingSenderId: "302903917290",
  appId: "1:302903917290:web:17197006283525c1627593"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
