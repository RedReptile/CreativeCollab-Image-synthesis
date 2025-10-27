// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAAfHwt3DPDpKvo05Ybr3_mJZf0LHfrjQU",
  authDomain: "creative-collab-fdc5e.firebaseapp.com",
  projectId: "creative-collab-fdc5e",
  storageBucket: "creative-collab-fdc5e.firebasestorage.app",
  messagingSenderId: "3349521153",
  appId: "1:3349521153:web:699ecd8fb152fe454d3100",
  measurementId: "G-ZF6XZG839D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);