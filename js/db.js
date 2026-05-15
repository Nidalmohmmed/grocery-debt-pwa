// db.js - إدارة IndexedDB المحلية

const DB_NAME = 'GroceryDebtOfflineDB';
const DB_VERSION = 2;

let dbInstance = null;

// فتح قاعدة البيانات
export async function openDB() {
    if (dbInstance) return dbInstance;
   
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
       
        request.onerror = () => reject(request.error);
       
        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };
       
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
           
            // جدول العملاء
            if (!db.objectStoreNames.contains('customers')) {
                const customerStore = db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
                customerStore.createIndex('userId', 'userId', { unique: false });
                customerStore.createIndex('name', 'name', { unique: false });
            }
           
            // جدول المعاملات
            if (!db.objectStoreNames.contains('transactions')) {
                const transactionStore = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
                transactionStore.createIndex('customerId', 'customerId', { unique: false });
                transactionStore.createIndex('userId', 'userId', { unique: false });
                transactionStore.createIndex('synced', 'synced', { unique: false });
            }
           
            // جدول قائمة انتظار المزامنة
            if (!db.objectStoreNames.contains('syncQueue')) {
                db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// حفظ عميل محلياً
export async function saveCustomerLocal(customer) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['customers'], 'readwrite');
        const store = transaction.objectStore('customers');
        customer.synced = false;
        customer.createdAt = new Date().toISOString();
       
        const request = store.add(customer);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// الحصول على جميع العملاء لمستخدم معين
export async function getCustomersLocal(userId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['customers'], 'readonly');
        const store = transaction.objectStore('customers');
        const index = store.index('userId');
        const request = index.getAll(userId);
       
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// تحديث عميل محلياً
export async function updateCustomerLocal(customer) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['customers'], 'readwrite');
        const store = transaction.objectStore('customers');
        customer.synced = false;
        customer.updatedAt = new Date().toISOString();
       
        const request = store.put(customer);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// حذف عميل محلياً
export async function deleteCustomerLocal(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['customers'], 'readwrite');
        const store = transaction.objectStore('customers');
        const request = store.delete(id);
       
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// حفظ معاملة محلياً
export async function saveTransactionLocal(transaction) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const trans = db.transaction(['transactions'], 'readwrite');
        const store = trans.objectStore('transactions');
        transaction.synced = false;
        transaction.date = new Date().toISOString().split('T')[0];
        transaction.createdAt = new Date().toISOString();
       
        const request = store.add(transaction);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// الحصول على معاملات عميل محلياً
export async function getCustomerTransactionsLocal(customerId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['transactions'], 'readonly');
        const store = transaction.objectStore('transactions');
        const index = store.index('customerId');
        const request = index.getAll(customerId);
       
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// الحصول على العناصر غير المتزامنة
export async function getUnsyncedItems() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['customers', 'transactions'], 'readonly');
       
        const customerStore = transaction.objectStore('customers');
        const customerIndex = customerStore.index('synced');
        const customersRequest = customerIndex.getAll(false);
       
        const transStore = transaction.objectStore('transactions');
        const transIndex = transStore.index('synced');
        const transactionsRequest = transIndex.getAll(false);
       
        Promise.all([
            new Promise(resolve => customersRequest.onsuccess = () => resolve(customersRequest.result)),
            new Promise(resolve => transactionsRequest.onsuccess = () => resolve(transactionsRequest.result))
        ]).then(([customers, transactions]) => {
            resolve({ customers, transactions });
        }).catch(reject);
    });
}

// تحديث حالة المزامنة
export async function markAsSynced(collection, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([collection], 'readwrite');
        const store = transaction.objectStore(collection);
        const request = store.get(id);
       
        request.onsuccess = () => {
            const item = request.result;
            if (item) {
                item.synced = true;
                store.put(item);
            }
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
}