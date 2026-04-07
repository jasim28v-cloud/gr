// ==================== XSPHERE - CONFIG ====================
const firebaseConfig = {
    apiKey: "AIzaSyC8u6Us6ZvnD4pjYxzRmK0UcwOJAvh1ZCU",
    authDomain: "mnsx-23109.firebaseapp.com",
    databaseURL: "https://mnsx-23109-default-rtdb.firebaseio.com/",
    projectId: "mnsx-23109",
    storageBucket: "mnsx-23109.firebasestorage.app",
    appId: "1:1035746353339:web:eec9d447b4379dfa1dc99e"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.database();
const CLOUD_NAME = 'da457cqma';
const UPLOAD_PRESET = 'do33_x';
const ADMIN_EMAIL = 'jasim88v@gmail.com';
const ADMIN_PASSWORD = 'kk2314kk';

console.log('✅ Firebase ready');
