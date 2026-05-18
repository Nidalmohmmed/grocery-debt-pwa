const firebaseConfig = {
    apiKey: "AIzaSyByNwAryNIlD3R5c_5YbSCt8lP3jZ0hE_0",
    authDomain: "grocerydebrbook.firebaseapp.com",
    projectId: "grocerydebrbook",
    storageBucket: "grocerydebrbook.firebasestorage.app",
    messagingSenderId: "877346824604",
    appId: "1:877346824604:web:7d1059a2ee63157da9a859",
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentCustomers = [];

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('authContainer').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        loadCustomers();
    } else {
        currentUser = null;
        document.getElementById('authContainer').style.display = 'block';
        document.getElementById('appContainer').style.display = 'none';
    }
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        document.getElementById('loginError').innerText = error.message;
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
        showToast('تم إنشاء الحساب بنجاح','success');
    } catch (error) {
        document.getElementById('registerError').innerText = error.message;
    }
});

document.getElementById('logoutBtn').onclick = () => signOut(auth);

async function isCustomerNameExists(name, excludeId = null) {
    const q = query(collection(db, 'customers'), where('userId', '==', currentUser.uid));
    const snapshot = await getDocs(q);
    let exists = false;
    snapshot.forEach(doc => {
        if (doc.data().name.toLowerCase() === name.toLowerCase() && doc.id != excludeId) {
            exists = true;
        }
    });
    return exists;
}

async function loadCustomers() {
    if (!currentUser) return;
    try {
        const q = query(collection(db, 'customers'), where('userId', '==', currentUser.uid));
        const snapshot = await getDocs(q);
        currentCustomers = [];
        snapshot.forEach(doc => {
            currentCustomers.push({ id: doc.id, ...doc.data() });
        });
        await displayCustomers(currentCustomers);
        updateStats();
    } catch (err) {
        console.error(err);
    }
}

async function displayCustomers(customers) {
    const container = document.getElementById('customersList');
    if (customers.length === 0) {
        container.innerHTML = '<div class="text-center p-5 text-muted"><i class="fas fa-users fa-3x"></i><p class="mt-2">لا يوجد عملاء، أضف عميلاً جديداً</p></div>';
        return;
    }
    container.innerHTML = '';
    let totalDebt = 0;
    for (const customer of customers) {
        const balance = await getCustomerBalance(customer.id);
        if (balance > 0) totalDebt += balance;
        const balanceClass = balance > 0 ? 'balance-positive' : 'balance-zero';
        const balanceText = balance > 0 ? `${balance.toFixed(2)} ر.ي (مدين)` : '0 ر.ي';
       
        const card = document.createElement('div');
        card.className = 'customer-card card';
        card.onclick = () => showCustomerDetails(customer);
        card.innerHTML = `
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong><i class="fas fa-user-circle"></i> ${escapeHtml(customer.name)}</strong>
                        ${customer.phone ? `<br><small class="text-muted">📞 ${customer.phone}</small>` : ''}
                    </div>
                    <div class="${balanceClass}">${balanceText}</div>
                </div>
            </div>
        `;
        container.appendChild(card);
    }
    document.getElementById('totalDebt').innerHTML = `${totalDebt.toFixed(2)} <small>ر.ي</small>`;
}

async function getCustomerBalance(customerId) {
    if (!currentUser) return 0;
    try {
        const q = query(collection(db, 'transactions'), where('customerId', '==', customerId), where('userId', '==', currentUser.uid));
        const snapshot = await getDocs(q);
        let balance = 0;
        snapshot.forEach(doc => {
            const t = doc.data();
            if (t.type === 'debt') balance += t.amount;
            else if (t.type === 'payment') balance -= t.amount;
        });
        return balance;
    } catch (error) {
        return 0;
    }
}

async function updateStats() {
    let debtors = 0, zeroBalance = 0;
    for (const customer of currentCustomers) {
        const balance = await getCustomerBalance(customer.id);
        if (balance > 0) debtors++;
        else if (balance === 0) zeroBalance++;
    }
    document.getElementById('statCustomers').innerText = currentCustomers.length;
    document.getElementById('statDebtors').innerText = debtors;
    document.getElementById('statZero').innerText = zeroBalance;
}

document.getElementById('saveCustomerBtn').onclick = async () => {
    const name = document.getElementById('customerName').value.trim();
    if (!name) { showToast("الاسم مطلوب",'warning'); return; }
   
    const customerId = document.getElementById('customerId').value;
    const exists = await isCustomerNameExists(name, customerId);
    if (exists) { showToast("⚠️ هذا الاسم موجود بالفعل!",'warning'); return; }
   
    try {
        if (customerId) {
            await updateDoc(doc(db, 'customers', customerId), {
                name, phone: document.getElementById('customerPhone').value || '',
                notes: document.getElementById('customerNotes').value || ''
            });
        } else {
            await addDoc(collection(db, 'customers'), {
                userId: currentUser.uid, name,
                phone: document.getElementById('customerPhone').value || '',
                notes: document.getElementById('customerNotes').value || '',
                createdAt: new Date().toISOString()
            });
        }
        bootstrap.Modal.getInstance(document.getElementById('customerModal')).hide();
        await loadCustomers();
    } catch (error) { showToast("حدث خطأ",'error'); }
};

document.getElementById('addCustomerBtn').onclick = () => {
    document.getElementById('customerId').value = '';
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';
    document.getElementById('customerNotes').value = '';
    new bootstrap.Modal(document.getElementById('customerModal')).show();
};

document.getElementById('saveTransactionBtn').onclick = async () => {
    const customerId = document.getElementById('transactionCustomerId').value;
    const type = document.getElementById('transactionType').value;
    const amount = parseFloat(document.getElementById('transactionAmount').value);
    if (!amount || amount <= 0) { showToast("المبلغ مطلوب",'warning'); return; }
   
    try {
        await addDoc(collection(db, 'transactions'), {
            userId: currentUser.uid, customerId, type, amount,
            note: document.getElementById('transactionNote').value || '',
            date: new Date().toISOString().split('T')[0]
        });
        bootstrap.Modal.getInstance(document.getElementById('transactionModal')).hide();
        await loadCustomers();
    } catch (error) { showToast("حدث خطأ",'error'); }
};

document.getElementById('deleteCustomerBtn').onclick = async () => {
    const customerId = window.currentCustomerId;
    const customer = currentCustomers.find(c => c.id === customerId);
    if (!confirm(`⚠️ حذف "${customer.name}"؟`)) return;
   
    try {
        const transactionsQuery = query(collection(db, 'transactions'), where('customerId', '==', customerId));
        const transactionsSnapshot = await getDocs(transactionsQuery);
        for (const trans of transactionsSnapshot.docs) await deleteDoc(doc(db, 'transactions', trans.id));
        await deleteDoc(doc(db, 'customers', customerId));
        bootstrap.Modal.getInstance(document.getElementById('detailsModal')).hide();
        await loadCustomers();
    } catch (error) { showToast("حدث خطأ",'error'); }
};

async function showCustomerDetails(customer) {
    const balance = await getCustomerBalance(customer.id);
    document.getElementById('detailsCustomerName').innerHTML = `<i class="fas fa-user-circle"></i> ${customer.name}`;
    document.getElementById('detailsBalance').innerHTML = `${balance.toFixed(2)} ر.ي`;
   
    const q = query(collection(db, 'transactions'), where('customerId', '==', customer.id));
    const snapshot = await getDocs(q);
    const transactions = [];
    snapshot.forEach(doc => transactions.push(doc.data()));
   
    const transactionsDiv = document.getElementById('transactionsList');
    if (transactions.length === 0) {
        transactionsDiv.innerHTML = '<div class="text-center p-3 text-muted">لا توجد معاملات</div>';
    } else {
        transactionsDiv.innerHTML = '';
        for (const t of transactions.reverse()) {
            transactionsDiv.innerHTML += `
                <div class="border-bottom p-2">
                    <span class="badge bg-${t.type === 'debt' ? 'danger' : 'success'}">
                        ${t.type === 'debt' ? '💰 دين' : '✅ سداد'}
                    </span>
                    <strong>${t.amount.toFixed(2)} ر.ي</strong> - ${t.date}
                    ${t.note ? `<br><small>📝 ${t.note}</small>` : ''}
                </div>
            `;
        }
    }
    window.currentCustomerId = customer.id;
    new bootstrap.Modal(document.getElementById('detailsModal')).show();
}

document.getElementById('showStatsBtn').onclick = async () => {
    const balances = [], names = [];
    for (const customer of currentCustomers) {
        const balance = await getCustomerBalance(customer.id);
        if (balance > 0) { balances.push(balance); names.push(customer.name); }
    }
    const statsWindow = window.open('', '_blank', 'width=600,height=500');
    statsWindow.document.write(`
        <!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
        <title>إحصائيات الديون</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css" rel="stylesheet">
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
        </head><body style="padding:20px"><div class="container">
        <h2 class="text-center mb-4">📊 إحصائيات ديون البقالة</h2>
        <div class="card mb-4"><div class="card-body"><canvas id="debtChart"></canvas></div></div>
        <div class="card"><div class="card-body">
        <table class="table table-bordered">
        <tr><td>إجمالي العملاء:</td><td><strong>${currentCustomers.length}</strong></td></tr>
        <tr><td>العملاء المدينون:</td><td><strong>${balances.length}</strong></td></tr>
        <tr><td>إجمالي الديون:</td><td><strong>${balances.reduce((a,b)=>a+b,0).toFixed(2)} ر.ي</strong></td></tr>
        </table></div></div></div>
        <script>new Chart(document.getElementById('debtChart'),{type:'bar',data:{labels:${JSON.stringify(names)},datasets:[{label:'المبلغ المستحق (ر.ي)',data:${JSON.stringify(balances)},backgroundColor:'#e74c3c'}]}});<\/script>
        </body></html>
    `);
};

document.getElementById('printReportBtn').onclick = async () => {
    document.getElementById('printDate').innerText = new Date().toLocaleDateString('ar-EG');
    const container = document.getElementById('printCustomersList');
    container.innerHTML = '';
    let total = 0;
    for (const customer of currentCustomers) {
        const balance = await getCustomerBalance(customer.id);
        if (balance > 0) total += balance;
        container.innerHTML += `<div style="border-bottom:1px solid #ddd; padding:10px;"><strong>${customer.name}</strong><br>الرصيد: ${balance > 0 ? balance.toFixed(2) + ' ر.ي (مدين)' : '0 ر.ي'}</div>`;
    }
    document.getElementById('printSummary').innerHTML = `<hr><div style="text-align:center;"><strong>إجمالي الديون: ${total.toFixed(2)} ر.ي</strong></div>`;
    window.print();
};

document.getElementById('addDebtBtn').onclick = () => {
    document.getElementById('transactionCustomerId').value = window.currentCustomerId;
    document.getElementById('transactionType').value = 'debt';
    document.getElementById('transactionModalTitle').innerHTML = '💰 إضافة دين جديد';
    document.getElementById('transactionAmount').value = '';
    document.getElementById('transactionNote').value = '';
    bootstrap.Modal.getInstance(document.getElementById('detailsModal')).hide();
    new bootstrap.Modal(document.getElementById('transactionModal')).show();
};

document.getElementById('addPaymentBtn').onclick = () => {
    document.getElementById('transactionCustomerId').value = window.currentCustomerId;
    document.getElementById('transactionType').value = 'payment';
    document.getElementById('transactionModalTitle').innerHTML = '✅ إضافة سداد';
    document.getElementById('transactionAmount').value = '';
    document.getElementById('transactionNote').value = '';
    bootstrap.Modal.getInstance(document.getElementById('detailsModal')).hide();
    new bootstrap.Modal(document.getElementById('transactionModal')).show();
};

document.getElementById('searchInput').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = currentCustomers.filter(c => c.name.toLowerCase().includes(term) || (c.phone && c.phone.includes(term)));
    displayCustomers(filtered);
});

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
// طباعة كشف حساب العميل
document.getElementById('printCustomerStatementBtn').onclick = async () => {
    const customerId = window.currentCustomerId;
    const customer = currentCustomers.find(c => c.id === customerId);
    if (!customer) return;
   
    const balance = await getCustomerBalance(customerId);
    const transactions = [];
    const q = query(collection(db, 'transactions'), where('customerId', '==', customerId), where('userId', '==', currentUser.uid));
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => transactions.push(doc.data()));
   
    // ترتيب المعاملات من الأقدم إلى الأحدث
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
   
    // إنشاء نافذة الطباعة
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>كشف حساب ${customer.name}</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    padding: 20px;
                    margin: 0;
                    background: white;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 2px solid #333;
                    padding-bottom: 15px;
                }
                .header h1 {
                    margin: 0;
                    color: #2c3e50;
                }
                .header p {
                    margin: 5px 0;
                    color: #666;
                }
                .customer-info {
                    background: #f5f5f5;
                    padding: 15px;
                    border-radius: 10px;
                    margin-bottom: 20px;
                }
                .customer-info table {
                    width: 100%;
                }
                .customer-info td {
                    padding: 5px;
                }
                .balance {
                    text-align: center;
                    font-size: 1.5rem;
                    margin: 20px 0;
                    padding: 15px;
                    background: ${balance > 0 ? '#fee' : '#efe'};
                    border-radius: 10px;
                    color: ${balance > 0 ? '#e74c3c' : '#27ae60'};
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 10px;
                    text-align: center;
                }
                th {
                    background: #2c3e50;
                    color: white;
                }
                tr:nth-child(even) {
                    background: #f9f9f9;
                }
                .footer {
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 15px;
                    border-top: 1px solid #ddd;
                    font-size: 12px;
                    color: #999;
                }
                @media print {
                    body { margin: 0; padding: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📒 دفتر ديون البقالة</h1>
                    <p>كشف حساب العميل</p>
                </div>
               
                <div class="customer-info">
                    <table>
                        <tr><td style="width:120px"><strong>اسم العميل:</strong></td><td>${customer.name}</td></tr>
                        <tr><td><strong>رقم الهاتف:</strong></td><td>${customer.phone || 'غير مسجل'}</td></tr>
                        <tr><td><strong>العنوان:</strong></td><td>${customer.notes || 'غير مسجل'}</td></tr>
                        <tr><td><strong>تاريخ التقرير:</strong></td><td>${new Date().toLocaleDateString('ar-EG')}</td></tr>
                    </table>
                </div>
               
                <div class="balance">
                    الرصيد الحالي: ${balance > 0 ? balance.toFixed(2) + ' ر.ي (مدين)' : balance === 0 ? '0 ر.ي' : Math.abs(balance).toFixed(2) + ' ر.ي (دائن)'}
                </div>
               
                <h3>📋 سجل المعاملات</h3>
                <table>
                    <thead>
                        <tr>
                            <th>التاريخ</th>
                            <th>نوع المعاملة</th>
                            <th>المبلغ (ر.ي)</th>
                            <th>الملاحظات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transactions.map(t => `
                            <tr>
                                <td>${t.date}</td>
                                <td>${t.type === 'debt' ? '💰 دين' : '✅ سداد'}</td>
                                <td style="color: ${t.type === 'debt' ? '#e74c3c' : '#27ae60'}">${t.amount.toFixed(2)}</td>
                                <td>${t.note || '-'}</td>
                            </tr>
                        `).join('')}
                        ${transactions.length === 0 ? '<tr><td colspan="4" style="text-align:center">لا توجد معاملات</td></tr>' : ''}
                    </tbody>
                </table>
               
                <div class="footer">
                    <p>هذا كشف حساب تلقائي - يرجى مراجعة البيانات مع الدفتر اليدوي إن وجد</p>
                    <p>تم الإنشاء بواسطة نظام دفتر ديون البقالة</p>
                </div>
            </div>
            <script>
                window.onload = () => window.print();
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
};
// دالة عرض رسائل منبثقة جميلة
function showToast(message, type = 'success') {
    // إزالة أي توست موجود مسبقاً
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }
   
    // إنشاء عنصر التوست
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
   
    // اختيار الأيقونة حسب نوع الرسالة
    let icon = '';
    switch (type) {
        case 'success':
            icon = '<i class="fas fa-check-circle"></i>';
            break;
        case 'error':
            icon = '<i class="fas fa-exclamation-circle"></i>';
            break;
        case 'warning':
            icon = '<i class="fas fa-exclamation-triangle"></i>';
            break;
        default:
            icon = '<i class="fas fa-info-circle"></i>';
    }
   
    toast.innerHTML = `${icon} ${message}`;
    document.body.appendChild(toast);
   
    // إظهار التوست
    setTimeout(() => toast.classList.add('show'), 10);
   
    // إخفاء وإزالة التوست بعد 3 ثوانٍ
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 300);
    }, 3000);
}
// حفظ كشف حساب العميل (نسخة نصية)
document.getElementById('saveCustomerStatementBtn').onclick = async () => {
    const customerId = window.currentCustomerId;
    const customer = currentCustomers.find(c => c.id === customerId);
    if (!customer) return;
   
    showToast('⏳ جاري إنشاء كشف الحساب...', 'warning');
   
    const balance = await getCustomerBalance(customerId);
    const transactions = [];
    const q = query(collection(db, 'transactions'), where('customerId', '==', customerId), where('userId', '==', currentUser.uid));
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => transactions.push(doc.data()));
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
   
    let content = `📒 دفتر ديون البقالة\n`;
    content += `===========================================\n`;
    content += `كشف حساب العميل\n`;
    content += `===========================================\n\n`;
    content += `📌 معلومات العميل:\n`;
    content += `   الاسم: ${customer.name}\n`;
    content += `   الهاتف: ${customer.phone || 'غير مسجل'}\n`;
    content += `   العنوان: ${customer.notes || 'غير مسجل'}\n`;
    content += `   تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}\n\n`;
    content += `💰 الرصيد الحالي: ${balance > 0 ? balance.toFixed(2) + ' ر.ي (مدين)' : balance === 0 ? '0 ر.ي' : Math.abs(balance).toFixed(2) + ' ر.ي (دائن)'}\n\n`;
    content += `===========================================\n`;
    content += `📋 سجل المعاملات:\n`;
    content += `===========================================\n`;
   
    for (const t of transactions) {
        content += `${t.date} | ${t.type === 'debt' ? 'دين' : 'سداد'} | ${t.amount.toFixed(2)} ر.ي | ملاحظة: ${t.note || '-'}\n`;
    }
   
    if (transactions.length === 0) {
        content += `لا توجد معاملات مسجلة\n`;
    }
   
    content += `\n===========================================\n`;
    content += `تم الإنشاء بواسطة نظام دفتر ديون البقالة\n`;
    content += `===========================================\n`;
   
    try {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        link.download = `كشف_حساب_${customer.name}_${timestamp}.txt`;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
       
        showToast('✅ تم حفظ كشف الحساب كملف نصي بنجاح', 'success');
    } catch (error) {
        console.error(error);
        showToast('❌ حدث خطأ في حفظ الملف', 'error');
    }
};
// نظام اكتشاف التحديث التلقائي
let newWorker = null;

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log('✅ Service Worker مسجل');
       
        // التحقق من وجود تحديث كل 60 ثانية
        setInterval(() => {
            reg.update();
        }, 60000);
       
        // عند اكتشاف تحديث جديد
        reg.addEventListener('updatefound', () => {
            newWorker = reg.installing;
            console.log('🔄 تم اكتشاف تحديث جديد!');
           
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // إظهار رسالة التحديث للمستخدم
                    showUpdateToast();
                }
            });
        });
    }).catch(err => console.log('❌ Service Worker error:', err));
   
    // تحديث الصفحة عند التحكم الجديد
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            refreshing = true;
            window.location.reload();
        }
    });
}

// إظهار رسالة التحديث
function showUpdateToast() {
    const toast = document.getElementById('updateToast');
    if (toast) {
        toast.classList.add('show');
       
        document.getElementById('updateBtn').onclick = () => {
            if (newWorker) {
                newWorker.postMessage('skipWaiting');
                toast.classList.remove('show');
            }
        };
       
        // إخفاء تلقائي بعد 30 ثانية
        setTimeout(() => {
            toast.classList.remove('show');
        }, 30000);
    }
}