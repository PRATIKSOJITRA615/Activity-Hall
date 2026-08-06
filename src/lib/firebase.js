import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD7YceGNA0_m9RdF8E1CyIYzhdtqnLQ3Hw",
  authDomain: "activity-hall.firebaseapp.com",
  projectId: "activity-hall",
  storageBucket: "activity-hall.firebasestorage.app",
  messagingSenderId: "524010948158",
  appId: "1:524010948158:web:04a363b5c0ecdd869ff36f",
  measurementId: "G-JYTJTVQJY6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
