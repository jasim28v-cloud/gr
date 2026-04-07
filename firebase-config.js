const firebaseConfig = {
  apiKey: "AIzaSyC8u6Us6ZvnD4pjYxzRmK0UcwOJAvh1ZCU",
  authDomain: "mnsx-23109.firebaseapp.com",
  projectId: "mnsx-23109",
  storageBucket: "mnsx-23109.firebasestorage.app",
  messagingSenderId: "1035746353339",
  appId: "1:1035746353339:web:eec9d447b4379dfa1dc99e",
  measurementId: "G-6GW5W25MPZ"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
// إذا أردت الإشعارات الفورية، قم بإضافة Firebase Cloud Messaging
// لكن سنتركها حالياً لتجنب التعقيد
