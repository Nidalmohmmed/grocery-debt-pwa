// app.js - التطبيق الرئيسي

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';
import {
    saveCustomerLocal,
    getCustomersLocal,
    getCustomerTransactionsLocal,
    saveTransactionLocal
} from './db.js';
import { loadFromCloud, syncWithCloud, isOnline, updatePendingSyncCount } from './sync.js';

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
export const db = getFirestore(app);
import { enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

enableIndexedDbPersistence(db)
  .catch((err) => {
      console.log("Persistence Error:", err);
  });
_________________
self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
let isOnline=navigator.onLine;
let currentUser = null;
let currentCustomers = [];
// أضف مراقبة حالة الإنترنت
window.addEventListener('online', () => {
    isOnline = true;
    if (currentUser) syncWithCloud();
});

window.addEventListener('offline', () => {
    isOnline = false;
    showOfflineMessage();
});

// مراقبة حالة تسجيل الدخول
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('authContainer').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        document.getElementById('userName').innerText = user.displayName || user.email;
       
        // تحميل البيانات (من محلي أولاً ثم سحابة)
        await loadData();
       
        // محاولة المزامنة
        if (isOnline) {
            await syncWithCloud();
        }
       
        // تحديث عدد العملاء
        updateStats();
       
    } else {
        currentUser = null;
        document.getElementById('authContainer').style.display = 'block';
        document.getElementById('appContainer').style.display = 'none';
    }
});

// تحميل البيانات
async function loadData() {
    // أولاً: اعرض من المحلي
    const localCustomers = await getCustomersLocal(currentUser.uid);
    if (localCustomers.length > 0) {
        currentCustomers = localCustomers;
        displayCustomers(currentCustomers);
    }
   
    // ثانياً: إذا كان هناك نت، حمّل من السحابة
    if (isOnline) {
        const cloudCustomers = await loadFromCloud(currentUser.uid);
        if (cloudCustomers.length > 0) {
            currentCustomers = cloudCustomers;
            displayCustomers(currentCustomers);
        }
    }
}

// عرض العملاء
async function displayCustomers(customers) {
    const container = document.getElementById('customersList');
   
    if (customers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h5>لا يوجد عملاء</h5>
                <p>أضف عميلاً جديداً للبدء</p>
            </div>
        `;
        return;
    }
   
    container.innerHTML = '';
   
    for (const customer of customers) {
        const balance = await calculateBalance(customer.id);
        const balanceClass = balance > 0 ? 'balance-positive' : 'balance-zero';
       
        const card = document.createElement('div');
        card.className = 'customer-card card';
        card.onclick = () => showCustomerDetails(customer);
        card.innerHTML = `
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-0"><i class="fas fa-user-circle"></i> ${escapeHtml(customer.name)}</h6>
                        ${customer.phone ? `<small class="text-muted">📞 ${customer.phone}</small>` : ''}
                    </div>
                    <div class="${balanceClass}">
                        ${balance.toFixed(2)} ج.م
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    }
}

// حساب رصيد عميل
async function calculateBalance(customerId) {
    const transactions = await getCustomerTransactionsLocal(customerId);
    let balance = 0;
    for (const trans of transactions) {
        if (trans.type === 'debt') balance += trans.amount;
        else if (trans.type === 'payment') balance -= trans.amount;
    }
    return balance;
}

// تحديث إجمالي الديون
async function updateTotalDebt() {
    let total = 0;
    for (const customer of currentCustomers) {
        const balance = await calculateBalance(customer.id);
        if (balance > 0) total += balance;
    }
    document.getElementById('totalDebt').innerHTML = `${total.toFixed(2)} <small>ج.م</small>`;
}

// تحديث الإحصائيات
async function updateStats() {
    document.getElementById('customerCount').innerText = currentCustomers.length;
    document.getElementById('statsRow').style.display = 'flex';
    await updatePendingSyncCount();
}

// إضافة عميل
async function addCustomer(customerData) {
    const customer = {
        userId: currentUser.uid,
        name: customerData.name,
        phone: customerData.phone || '',
        notes: customerData.notes || '',
        createdAt: new Date().toISOString()
    };
   
    const localId = await saveCustomerLocal(customer);
   
    // عرض رسالة حسب حالة الاتصال
    if (!isOnline) {
        alert('📱 تم حفظ العميل محلياً. سيتم المزامنة تلقائياً عند توفر الإنترنت.');
    }
   
    await loadData();
    return localId;
}

// إضافة معاملة
async function addTransaction(transactionData) {
    const transaction = {
        userId: currentUser.uid,
        customerId: transactionData.customerId,
        type: transactionData.type,
        amount: transactionData.amount,
        note: transactionData.note || '',
        date: new Date().toISOString().split('T')[0]
    };
   
    await saveTransactionLocal(transaction);
   
    if (!isOnline) {
        alert('📱 تم حفظ المعاملة محلياً. سيتم المزامنة لاحقاً.');
    }
   
    await loadData();
}

// عرض تفاصيل العميل
async function showCustomerDetails(customer) {
    const balance = await calculateBalance(customer.id);
    const transactions = await getCustomerTransactionsLocal(customer.id);
   
    document.getElementById('detailsCustomerName').innerHTML = `<i class="fas fa-user-circle"></i> ${customer.name}`;
   
    const balanceSpan = document.getElementById('detailsBalance');
    balanceSpan.className = balance > 0 ? 'balance-positive' : 'balance-zero';
    balanceSpan.innerHTML = `${balance.toFixed(2)} ج.م ${balance > 0 ? '(مدين)' : '(رصيد صفر)'}`;
   
    // عرض المعاملات
    const transactionsDiv = document.getElementById('transactionsList');
    if (transactions.length === 0) {
        transactionsDiv.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><p>لا توجد معاملات</p></div>';
    } else {
        transactionsDiv.innerHTML = '';
        for (const trans of transactions.reverse()) {
            const typeClass = trans.type === 'debt' ? 'btn-debt' : 'btn-payment';
            const typeIcon = trans.type === 'debt' ? 'fa-arrow-down' : 'fa-arrow-up';
            const typeText = trans.type === 'debt' ? 'دين' : 'سداد';
           
            const transDiv = document.createElement('div');
            transDiv.className = 'transaction-item';
            transDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <span class="badge ${typeClass}">${typeIcon} ${typeText}</span>
                        <div class="mt-1"><strong>${trans.amount.toFixed(2)} ج.م</strong></div>
                        ${trans.note ? `<small class="text-muted">📝 ${trans.note}</small>` : ''}
                    </div>
                    <div class="text-muted small">
                        <i class="fas fa-calendar"></i> ${trans.date}
                    </div>
                </div>
            `;
            transactionsDiv.appendChild(transDiv);
        }
    }
   
    // تخزين customerId مؤقتاً
    window.currentCustomerId = customer.id;
   
    const modal = new bootstrap.Modal(document.getElementById('detailsModal'));
    modal.show();
}

// أحداث الأزرار
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert('خطأ: ' + error.message);
    }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        alert('تم إنشاء الحساب بنجاح');
    } catch (error) {
        alert('خطأ: ' + error.message);
    }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await signOut(auth);
});

document.getElementById('addCustomerBtn').addEventListener('click', () => {
    document.getElementById('customerId').value = '';
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';
    document.getElementById('customerNotes').value = '';
    new bootstrap.Modal(document.getElementById('customerModal')).show();
});

document.getElementById('customerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addCustomer({
        name: document.getElementById('customerName').value,
        phone: document.getElementById('customerPhone').value,
        notes: document.getElementById('customerNotes').value
    });
    bootstrap.Modal.getInstance(document.getElementById('customerModal')).hide();
});

document.getElementById('transactionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addTransaction({
        customerId: document.getElementById('transactionCustomerId').value,
        type: document.getElementById('transactionType').value,
        amount: parseFloat(document.getElementById('transactionAmount').value),
        note: document.getElementById('transactionNote').value
    });
    bootstrap.Modal.getInstance(document.getElementById('transactionModal')).hide();
});

document.getElementById('addDebtBtn').addEventListener('click', () => {
    document.getElementById('transactionCustomerId').value = window.currentCustomerId;
    document.getElementById('transactionType').value = 'debt';
    document.getElementById('transactionModalTitle').innerHTML = '💰 إضافة دين جديد';
    document.getElementById('transactionAmount').value = '';
    document.getElementById('transactionNote').value = '';
    bootstrap.Modal.getInstance(document.getElementById('detailsModal')).hide();
    new bootstrap.Modal(document.getElementById('transactionModal')).show();
});

document.getElementById('addPaymentBtn').addEventListener('click', () => {
    document.getElementById('transactionCustomerId').value = window.currentCustomerId;
    document.getElementById('transactionType').value = 'payment';
    document.getElementById('transactionModalTitle').innerHTML = '✅ إضافة سداد';
    document.getElementById('transactionAmount').value = '';
    document.getElementById('transactionNote').value = '';
    bootstrap.Modal.getInstance(document.getElementById('detailsModal')).hide();
    new bootstrap.Modal(document.getElementById('transactionModal')).show();
});

document.getElementById('searchInput').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = currentCustomers.filter(c =>
        c.name.toLowerCase().includes(term) ||
        (c.phone && c.phone.includes(term))
    );
    displayCustomers(filtered);
});

// استماع لأحداث المزامنة
window.addEventListener('syncCompleted', async () => {
    await loadData();
});

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}