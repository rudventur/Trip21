// Shared Firebase settings for the Trip21 apps (the trip21-25f36 project).
//
// These values are the web settings of the project. Firebase designs them to be
// public: they only say which project to talk to. What keeps data safe is the
// set of rules in database.rules.json, not the secrecy of these values.
//
// This is an ES module file, so it is loaded with:
//   import { firebaseConfig } from "../../firebase-config.js";
//
// Note: map-merger-venti has its own, older settings file (a different project)
// and is not affected by this one.

export const firebaseConfig = {
  apiKey: "AIzaSyDrhA6znmL01fevbYF2fZ1Cp939NpAzkog",
  authDomain: "trip21-25f36.firebaseapp.com",
  databaseURL: "https://trip21-25f36-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "trip21-25f36",
  storageBucket: "trip21-25f36.firebasestorage.app",
  messagingSenderId: "986257862303",
  appId: "1:986257862303:web:be9cc81e895d38f1077caa"
};

// Version of the Firebase web library loaded from the Google content network.
export const firebaseSdkVersion = "10.14.1";
