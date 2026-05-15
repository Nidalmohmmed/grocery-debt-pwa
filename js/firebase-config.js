// firebase-config.js
// ضع هنا بيانات مشروعك من Firebase Console

const firebaseConfig = {
    apiKey: "AIzaSyByNwAryNIlD3R5c_5YbSCt8lP3jZ0hE_0",
    authDomain: "grocerydebrbook.firebaseapp.com",
    projectId: "grocerydebrbook",
    storageBucket: "grocerydebrbook.firebasestorage.app",
    messagingSenderId: "877346824604",
    appId: "1:877346824604:web:7d1059a2ee63157da9a859",
    measurementId: "G-D0Z58BP0VC"
  };

// قاعدة بيانات Firestore collections
export const COLLECTIONS = {
    CUSTOMERS: 'customers',
    TRANSACTIONS: 'transactions',
    SYNC_QUEUE: 'syncQueue'
};