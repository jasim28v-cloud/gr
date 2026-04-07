// ==================== XSphere - Firebase Configuration ====================
const firebaseConfig = {
    apiKey: "AIzaSyC8u6Us6ZvnD4pjYxzRmK0UcwOJAvh1ZCU",
    authDomain: "mnsx-23109.firebaseapp.com",
    databaseURL: "https://mnsx-23109-default-rtdb.firebaseio.com/",
    projectId: "mnsx-23109",
    storageBucket: "mnsx-23109.firebasestorage.app",
    appId: "1:1035746353339:web:eec9d447b4379dfa1dc99e"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Services
const auth = firebase.auth();
const db = firebase.database();
const storage = firebase.storage();

// Cloudinary
const CLOUD_NAME = 'da457cqma';
const UPLOAD_PRESET = 'do33_x';

// Agora
const AGORA_APP_ID = '929646610d814d529a06c4081c81325f';

// Admin Account
const ADMIN_EMAIL = 'jasim88v@gmail.com';
const ADMIN_PASSWORD = 'kk2314kk';

// Site Name
const SITE_NAME = 'XSphere';

console.log('✅ XSphere - Firebase, Cloudinary & Agora Ready');
