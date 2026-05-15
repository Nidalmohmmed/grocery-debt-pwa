// sync.js - نظام المزامنة بين IndexedDB و Firebase

import {
    getCustomersLocal,
    saveCustomerLocal,
    updateCustomerLocal,
    deleteCustomerLocal,
    saveTransactionLocal,
    getUnsyncedItems,
    markAsSynced
} from './db.js';

import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db as firestoreDb } from './app.js';

let currentUserId = null;
let isOnline = navigator.onLine;
let syncInProgress = false;

// مراقبة حالة الاتصال
window.addEventListener('online', () => {
    isOnline = true;
    updateConnectionStatus(true);
    syncWithCloud();
});

window.addEventListener('offline', () => {
    isOnline = false;
    updateConnectionStatus(false);
});

function updateConnectionStatus(online) {
    const statusDiv = document.getElementById('connectionStatus');
    if (statusDiv) {
        if (online) {
            statusDiv.className = 'connection-badge online';
            statusDiv.innerHTML = '<i class="fas fa-wifi"></i> متصل';
        } else {
            statusDiv.className = 'connection-badge offline';
            statusDiv.innerHTML = '<i class="fas fa-wifi-slash"></i> غير متصل - يعمل محلياً';
        }
    }
}

// تحميل البيانات من السحابة (للمستخدم الحالي)
export async function loadFromCloud(userId) {
    if (!isOnline) {
        console.log('📱 لا يوجد إنترنت - جارٍ التحميل من التخزين المحلي');
        return await getCustomersLocal(userId);
    }
   
    currentUserId = userId;
   
    try {
        // تحميل العملاء من Firebase
        const customersQuery = query(collection(firestoreDb, 'customers'), where('userId', '==', userId));
        const customersSnapshot = await getDocs(customersQuery);
       
        const customers = [];
        customersSnapshot.forEach(doc => {
            customers.push({ id: doc.id, ...doc.data(), synced: true });
        });
       
        // تخزين العملاء محلياً
        for (const customer of customers) {
            await saveCustomerLocal(customer);
        }
       
        // تحميل المعاملات (يمكن إضافة نفس المنطق)
       
        updatePendingSyncCount();
        return customers;
       
    } catch (error) {
        console.error('❌ فشل التحميل من السحابة:', error);
        return await getCustomersLocal(userId);
    }
}

// المزامنة مع السحابة
export async function syncWithCloud() {
    if (!isOnline || syncInProgress || !currentUserId) {
        return;
    }
   
    syncInProgress = true;
    console.log('🔄 بدء المزامنة مع السحابة...');
   
    try {
        const { customers, transactions } = await getUnsyncedItems();
       
        let syncedCount = 0;
       
        // مزامنة العملاء
        for (const customer of customers) {
            try {
                if (customer.firebaseId) {
                    // تحديث
                    await updateDoc(doc(firestoreDb, 'customers', customer.firebaseId), customer);
                } else {
                    // إضافة جديدة
                    const docRef = await addDoc(collection(firestoreDb, 'customers'), customer);
                    customer.firebaseId = docRef.id;
                    await updateCustomerLocal(customer);
                }
                await markAsSynced('customers', customer.id);
                syncedCount++;
            } catch (err) {
                console.error('فشل مزامنة العميل:', err);
            }
        }
       
        // مزامنة المعاملات
        for (const transaction of transactions) {
            try {
                await addDoc(collection(firestoreDb, 'transactions'), transaction);
                await markAsSynced('transactions', transaction.id);
                syncedCount++;
            } catch (err) {
                console.error('فشل مزامنة المعاملة:', err);
            }
        }
       
        if (syncedCount > 0) {
            console.log(`✅ تمت مزامنة ${syncedCount} عنصر`);
            updatePendingSyncCount();
           
            // تحديث الواجهة
            const syncEvent = new CustomEvent('syncCompleted');
            window.dispatchEvent(syncEvent);
        }
       
    } catch (error) {
        console.error('❌ خطأ في المزامنة:', error);
    } finally {
        syncInProgress = false;
    }
}

// تحديث عدد العناصر بانتظار المزامنة
async function updatePendingSyncCount() {
    const { customers, transactions } = await getUnsyncedItems();
    const total = customers.length + transactions.length;
   
    const pendingSpan = document.getElementById('pendingSync');
    if (pendingSpan) {
        pendingSpan.textContent = total;
        if (total > 0) {
            pendingSpan.style.color = '#e74c3c';
        } else {
            pendingSpan.style.color = '#27ae60';
        }
    }
}

// مزامنة دورية (كل 30 ثانية)
setInterval(() => {
    if (isOnline) {
        syncWithCloud();
    }
}, 30000);

// تصدير الدوال
export { isOnline, syncInProgress, updatePendingSyncCount };