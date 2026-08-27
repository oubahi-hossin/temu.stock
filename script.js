// مفاتيح التخزين المحلي (LocalStorage)
const STORAGE_KEYS = {
  saved: "savedProducts",
  working: "workingProducts"
};

// --- دوال مساعدة عامة لإدارة البيانات ---

// تحميل القائمة الآمن
function loadList(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// حفظ القائمة
function saveList(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// تحميل المنتجات المحفوظة نهائياً
function getSavedProducts() {
  return loadList(STORAGE_KEYS.saved);
}

// حفظ المنتجات المحفوظة نهائياً
function saveSavedProducts(list) {
  saveList(STORAGE_KEYS.saved, list);
}

// تحميل المنتجات في مسودة العمل الحالية
function getWorkingProducts() {
  const working = localStorage.getItem(STORAGE_KEYS.working);
  if (working === null) {
    const saved = getSavedProducts();
    saveList(STORAGE_KEYS.working, saved);
    return saved;
  }
  return loadList(STORAGE_KEYS.working);
}

// حفظ المنتجات في مسودة العمل الحالية
function saveWorkingProducts(list) {
  saveList(STORAGE_KEYS.working, list);
}

// التحقق مما إذا كانت هناك تغييرات غير محفوظة
function isModified() {
  const savedStr = localStorage.getItem(STORAGE_KEYS.saved) || "[]";
  const workingStr = localStorage.getItem(STORAGE_KEYS.working) || "[]";
  return savedStr !== workingStr;
}

// تنسيق الأرقام
function formatNumber(value) {
  return Number(value || 0).toFixed(2);
}

// الهروب من وسوم HTML لمنع ثغرات XSS
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// الحصول على تسمية التصنيف باللغة العربية
function getCategoryLabel(cat) {
  if (cat === "electronics") return "📱 الإلكترونيات";
  if (cat === "perfumes") return "🌸 العطور";
  if (cat === "clothing") return "👕 الملابس";
  if (cat === "pack-3-perfume") return "🎁 باك 3 عطر ومبخرة";
  if (cat === "pack-5-perfume") return "🎁 باك 5 عطر ومبخرة";
  return cat || "-";
}

// الحصول على التاريخ والوقت الحالي بتوقيت المغرب/الدار البيضاء بصيغة عربية مقروءة
function getCurrentDateTimeString() {
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };
  return new Date().toLocaleString('ar-MA', options);
}

// --- نظام الإشعارات (Toast Notification) ---

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : '❌'}</span>
    <div>${escapeHtml(message)}</div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 50);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.remove();
    }, 400);
  }, 3500);
}

// --- إدارة النوافذ المنبثقة (Modals) المشتركة ---

let currentDeleteIndex = null;
let onDeleteConfirmCallback = null;

function setupModals({ onSaveForm, onDeleteConfirm }) {
  const productModal = document.getElementById("product-modal");
  const deleteModal = document.getElementById("delete-modal");
  const productForm = document.getElementById("product-form");
  const deliveryStatus = document.getElementById("prod-delivery-status");
  const deliveryPrice = document.getElementById("prod-delivery-price");
  const modalError = document.getElementById("modal-error");
  
  // تفعيل/تعطيل سعر التوصيل بناءً على الحالة
  deliveryStatus?.addEventListener("change", () => {
    if (deliveryStatus.value === "active") {
      deliveryPrice.disabled = false;
      deliveryPrice.required = true;
      if (Number(deliveryPrice.value) === 0) deliveryPrice.value = "";
    } else {
      deliveryPrice.disabled = true;
      deliveryPrice.required = false;
      deliveryPrice.value = "0";
    }
  });

  // إغلاق النوافذ المنبثقة عند الضغط على أزرار الإلغاء أو علامة X
  document.querySelectorAll(".close-modal-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      productModal?.classList.add("hidden");
      modalError?.classList.add("hidden");
    });
  });

  document.querySelectorAll(".close-delete-btn, #cancel-delete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      deleteModal?.classList.add("hidden");
      currentDeleteIndex = null;
    });
  });

  // معالجة تقديم نموذج المنتج (إضافة / تعديل)
  productForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    modalError?.classList.add("hidden");

    const index = document.getElementById("edit-index").value;
    const code = document.getElementById("prod-code").value.trim();
    const name = document.getElementById("prod-name").value.trim();
    const category = document.getElementById("prod-category").value;
    const purchasePrice = parseFloat(document.getElementById("prod-purchase-price").value);
    const initialQty = parseInt(document.getElementById("prod-initial-qty").value, 10);
    const sellingPrice = parseFloat(document.getElementById("prod-selling-price").value);
    const qtySold = parseInt(document.getElementById("prod-qty-sold").value, 10);
    const delivery = deliveryStatus.value;
    const deliveryPr = delivery === "active" ? parseFloat(deliveryPrice.value) : 0;

    // --- التحقق من صحة البيانات (Validation) ---
    if (!code) {
      showError("رمز المنتج (SKU) مطلوب.");
      return;
    }

    if (!name) {
      showError("اسم المنتج مطلوب.");
      return;
    }

    if (!category) {
      showError("يرجى اختيار تصنيف المنتج.");
      return;
    }

    if (isNaN(purchasePrice) || purchasePrice < 0) {
      showError("سعر الشراء يجب أن يكون رقماً موجباً.");
      return;
    }

    if (isNaN(initialQty) || initialQty < 0) {
      showError("الكمية الأولية يجب أن تكون صفراً أو أكثر.");
      return;
    }

    if (isNaN(sellingPrice) || sellingPrice < 0) {
      showError("سعر البيع يجب أن يكون رقماً موجباً.");
      return;
    }

    if (isNaN(qtySold) || qtySold < 0) {
      showError("الكمية المباعة يجب أن تكون صفراً أو أكثر.");
      return;
    }

    if (qtySold > initialQty) {
      showError("الكمية المباعة لا يمكن أن تتجاوز الكمية الأولية المتوفرة في المخزون.");
      return;
    }

    if (delivery === "active" && (isNaN(deliveryPr) || deliveryPr < 0)) {
      showError("يرجى إدخال سعر توصيل صحيح وموجب.");
      return;
    }

    // إنشاء كائن المنتج مع إعداد التواريخ
    const product = {
      code,
      name,
      category,
      purchasePrice,
      initialQty,
      sellingPrice,
      qtySold,
      deliveryStatus: delivery,
      deliveryPrice: deliveryPr
    };

    onSaveForm(product, index);
  });

  // تأكيد الحذف
  onDeleteConfirmCallback = onDeleteConfirm;
  document.getElementById("confirm-delete-btn")?.addEventListener("click", () => {
    if (currentDeleteIndex !== null && onDeleteConfirmCallback) {
      onDeleteConfirmCallback(currentDeleteIndex);
    }
    deleteModal?.classList.add("hidden");
    currentDeleteIndex = null;
  });

  function showError(msg) {
    if (modalError) {
      modalError.textContent = "⚠️ " + msg;
      modalError.classList.remove("hidden");
      productModal.scrollTop = productModal.scrollHeight;
    } else {
      alert(msg);
    }
  }
}

// فتح نموذج المنتج للإضافة
function openAddModal() {
  document.getElementById("product-form")?.reset();
  document.getElementById("edit-index").value = "";
  document.getElementById("modal-title").textContent = "➕ إضافة منتج جديد";
  
  const deliveryPrice = document.getElementById("prod-delivery-price");
  if (deliveryPrice) {
    deliveryPrice.disabled = true;
    deliveryPrice.value = "0";
  }

  // إخفاء تواريخ المنتج
  document.getElementById("date-info-container")?.classList.add("hidden");
  
  document.getElementById("modal-error")?.classList.add("hidden");
  document.getElementById("product-modal")?.classList.remove("hidden");
  document.getElementById("prod-code")?.focus();
}

// فتح نموذج المنتج للتعديل
function openEditModal(product, index) {
  document.getElementById("edit-index").value = index;
  document.getElementById("modal-title").textContent = "✏️ تعديل بيانات المنتج";
  
  document.getElementById("prod-code").value = product.code;
  document.getElementById("prod-name").value = product.name;
  document.getElementById("prod-category").value = product.category || "";
  document.getElementById("prod-purchase-price").value = product.purchasePrice;
  document.getElementById("prod-initial-qty").value = product.initialQty;
  document.getElementById("prod-selling-price").value = product.sellingPrice;
  document.getElementById("prod-qty-sold").value = product.qtySold;
  
  const deliveryStatus = document.getElementById("prod-delivery-status");
  const deliveryPrice = document.getElementById("prod-delivery-price");
  
  if (deliveryStatus && deliveryPrice) {
    deliveryStatus.value = product.deliveryStatus || "inactive";
    deliveryPrice.value = product.deliveryPrice || 0;
    
    if (product.deliveryStatus === "active") {
      deliveryPrice.disabled = false;
      deliveryPrice.required = true;
    } else {
      deliveryPrice.disabled = true;
      deliveryPrice.required = false;
    }
  }

  // عرض معلومات التواريخ
  const dateContainer = document.getElementById("date-info-container");
  const createdEl = document.getElementById("info-created-at");
  const updatedEl = document.getElementById("info-updated-at");
  
  if (dateContainer && createdEl && updatedEl) {
    createdEl.textContent = product.createdAt || "-";
    updatedEl.textContent = product.updatedAt || "-";
    dateContainer.classList.remove("hidden");
  }

  document.getElementById("modal-error")?.classList.add("hidden");
  document.getElementById("product-modal")?.classList.remove("hidden");
  document.getElementById("prod-name")?.focus();
}

// فتح نافذة تأكيد الحذف
function triggerDeleteModal(index) {
  currentDeleteIndex = index;
  document.getElementById("delete-modal")?.classList.remove("hidden");
}

// --- 1. إدارة صفحة لوحة الحساب (index.html) ---

function initCalculatorPage() {
  const table = document.getElementById("product-table");
  if (!table) return false;

  const saveStatusBadge = document.getElementById("save-status-badge");
  const addButton = document.getElementById("add-product-btn");
  const saveButton = document.getElementById("save-btn");
  const clearButton = document.getElementById("clear-all-btn");
  const navSavedLink = document.getElementById("nav-saved-products");

  // معالجة استمارات المودال لصفحة الحساب
  setupModals({
    onSaveForm: (product, index) => {
      const working = getWorkingProducts();
      
      // التحقق من تكرار رمز SKU
      const duplicateIndex = working.findIndex(p => p.code.toLowerCase() === product.code.toLowerCase());
      if (duplicateIndex !== -1 && duplicateIndex !== parseInt(index, 10)) {
        const modalError = document.getElementById("modal-error");
        if (modalError) {
          modalError.textContent = "⚠️ رمز المنتج (SKU) مستخدم بالفعل لمنتج آخر.";
          modalError.classList.remove("hidden");
          return;
        }
      }

      const dateStr = getCurrentDateTimeString();

      if (index === "") {
        // إضافة منتج جديد
        product.createdAt = dateStr;
        product.updatedAt = dateStr;
        working.push(product);
        showToast("تم إضافة المنتج للمسودة بنجاح");
      } else {
        // تعديل منتج قائم
        const originalProduct = working[parseInt(index, 10)];
        product.createdAt = originalProduct.createdAt || dateStr;
        product.updatedAt = dateStr;
        working[parseInt(index, 10)] = product;
        showToast("تم تعديل المنتج في المسودة");
      }

      saveWorkingProducts(working);
      document.getElementById("product-modal").classList.add("hidden");
      render();
    },
    onDeleteConfirm: (index) => {
      const working = getWorkingProducts();
      working.splice(index, 1);
      saveWorkingProducts(working);
      showToast("تم حذف المنتج من المسودة");
      render();
    }
  });

  // تحديث حالة إشعار الحفظ
  function updateSaveStatus() {
    if (!saveStatusBadge) return;
    if (isModified()) {
      saveStatusBadge.textContent = "⚠️ تغييرات غير محفوظة";
      saveStatusBadge.className = "badge warning-badge";
    } else {
      saveStatusBadge.textContent = "✅ تم حفظ جميع التغييرات";
      saveStatusBadge.className = "badge success-badge";
    }
  }

  // حساب الإحصائيات وعرض جدول البيانات
  function render() {
    const products = getWorkingProducts();
    table.innerHTML = "";

    let totalQty = 0;
    let totalSold = 0;
    let remainingStock = 0;
    let totalPurchaseVal = 0;
    let totalSalesVal = 0;
    let totalDeliveryCost = 0;
    let totalProfit = 0;

    products.forEach((product, index) => {
      const remQty = product.initialQty - product.qtySold;
      const rowTotal = product.sellingPrice * product.qtySold;
      const rowPurchaseVal = product.purchasePrice * product.initialQty;
      const rowDeliveryCost = product.deliveryStatus === "active" ? (product.deliveryPrice * product.qtySold) : 0;
      const rowProfit = ((product.sellingPrice - product.purchasePrice) * product.qtySold) - rowDeliveryCost;

      totalQty += product.initialQty;
      totalSold += product.qtySold;
      remainingStock += remQty;
      totalPurchaseVal += rowPurchaseVal;
      totalSalesVal += rowTotal;
      totalDeliveryCost += rowDeliveryCost;
      totalProfit += rowProfit;

      const row = document.createElement("tr");
      
      let stockBadgeClass = "stock-ok";
      if (remQty === 0) stockBadgeClass = "stock-empty";
      else if (remQty < 5) stockBadgeClass = "stock-warning";

      row.innerHTML = `
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(product.code)}</strong></td>
        <td>${escapeHtml(product.name)}</td>
        <td><span style="font-size:0.9rem; font-weight:600;">${getCategoryLabel(product.category)}</span></td>
        <td>${formatNumber(product.purchasePrice)}</td>
        <td>${product.initialQty}</td>
        <td>${formatNumber(product.sellingPrice)}</td>
        <td>${product.qtySold}</td>
        <td><span class="stock-badge ${stockBadgeClass}">${remQty}</span></td>
        <td>${product.deliveryStatus === "active" ? "🚚 مع توصيل" : "❌ بدون توصيل"}</td>
        <td>${product.deliveryStatus === "active" ? formatNumber(product.deliveryPrice) : '<span class="muted">-</span>'}</td>
        <td><strong>${formatNumber(rowTotal)}</strong></td>
        <td>
          <button type="button" class="action-edit-btn" data-index="${index}" style="background:none; border:none; cursor:pointer; font-size:1.1rem;" title="تعديل">✏️</button>
        </td>
        <td>
          <button type="button" class="action-delete-btn" data-index="${index}" style="background:none; border:none; cursor:pointer; font-size:1.1rem;" title="حذف">🗑️</button>
        </td>
      `;
      table.appendChild(row);
    });

    document.getElementById("stat-count").textContent = products.length;
    document.getElementById("stat-total-qty").textContent = totalQty;
    document.getElementById("stat-total-sold").textContent = totalSold;
    document.getElementById("stat-remaining-stock").textContent = remainingStock;
    
    document.getElementById("stat-purchase-val").textContent = formatNumber(totalPurchaseVal);
    document.getElementById("stat-sales-val").textContent = formatNumber(totalSalesVal);
    document.getElementById("stat-delivery-cost").textContent = formatNumber(totalDeliveryCost);
    
    const profitEl = document.getElementById("stat-profit");
    profitEl.textContent = formatNumber(totalProfit);
    
    if (totalProfit < 0) {
      profitEl.style.color = "var(--danger)";
    } else {
      profitEl.style.color = "var(--accent-3)";
    }

    updateSaveStatus();
  }

  // ربط الأزرار
  addButton?.addEventListener("click", openAddModal);

  saveButton?.addEventListener("click", () => {
    const working = getWorkingProducts();
    if (working.length === 0) {
      if (!confirm("⚠️ هل تريد حفظ قائمة مسودة فارغة؟")) {
        return;
      }
    }
    // حفظ البيانات بشكل نهائي في الذاكرة
    saveSavedProducts(working);
    
    // إشعار بالنجاح وتوجيه فوري لصفحة المنتجات المحفوظة
    showToast("تم حفظ المنتجات بنجاح", "success");
    localStorage.setItem("showSavedToast", "true");
    
    setTimeout(() => {
      window.location.href = "products.html";
    }, 600);
  });

  clearButton?.addEventListener("click", () => {
    triggerDeleteModal("all");
  });

  const originalOnDeleteConfirm = onDeleteConfirmCallback;
  onDeleteConfirmCallback = (index) => {
    if (index === "all") {
      saveWorkingProducts([]);
      showToast("تم تفريغ مسودة العمل الحالية");
      render();
    } else {
      const working = getWorkingProducts();
      working.splice(index, 1);
      saveWorkingProducts(working);
      showToast("تم حذف المنتج من المسودة");
      render();
    }
  };

  table.addEventListener("click", (event) => {
    const editBtn = event.target.closest(".action-edit-btn");
    const deleteBtn = event.target.closest(".action-delete-btn");

    if (editBtn) {
      const index = parseInt(editBtn.dataset.index, 10);
      const working = getWorkingProducts();
      if (working[index]) {
        openEditModal(working[index], index);
      }
    }

    if (deleteBtn) {
      const index = parseInt(deleteBtn.dataset.index, 10);
      onDeleteConfirmCallback = (idx) => {
        const working = getWorkingProducts();
        working.splice(idx, 1);
        saveWorkingProducts(working);
        showToast("تم حذف المنتج من المسودة");
        render();
      };
      triggerDeleteModal(index);
    }
  });

  // حماية الانتقال والتنبيه للتغييرات غير المحفوظة
  const unsavedModal = document.getElementById("unsaved-modal");
  let targetUrl = "";

  function handleNavigation(e, url) {
    if (isModified()) {
      e.preventDefault();
      targetUrl = url;
      unsavedModal?.classList.remove("hidden");
    }
  }

  navSavedLink?.addEventListener("click", (e) => {
    handleNavigation(e, navSavedLink.getAttribute("href"));
  });

  document.getElementById("unsaved-save-leave-btn")?.addEventListener("click", () => {
    const working = getWorkingProducts();
    saveSavedProducts(working);
    localStorage.setItem("showSavedToast", "true");
    unsavedModal?.classList.add("hidden");
    window.location.href = targetUrl;
  });

  document.getElementById("unsaved-leave-btn")?.addEventListener("click", () => {
    const saved = getSavedProducts();
    saveWorkingProducts(saved);
    unsavedModal?.classList.add("hidden");
    window.location.href = targetUrl;
  });

  document.getElementById("unsaved-cancel-btn")?.addEventListener("click", () => {
    unsavedModal?.classList.add("hidden");
    targetUrl = "";
  });

  window.addEventListener("beforeunload", (e) => {
    if (isModified()) {
      e.preventDefault();
      e.returnValue = "لديك تغييرات غير محفوظة. هل تريد المغادرة؟";
      return e.returnValue;
    }
  });

  // التحقق من ظهور إشعار توست قادم من توجيه سابق
  if (localStorage.getItem("showSavedToast") === "true") {
    showToast("تم حفظ المنتجات بنجاح", "success");
    localStorage.removeItem("showSavedToast");
  }

  // أزرار تصدير واستيراد البيانات
  const exportBtn = document.getElementById("export-btn");
  const importBtn = document.getElementById("import-btn");
  const importFile = document.getElementById("import-file");

  exportBtn?.addEventListener("click", () => {
    const saved = getSavedProducts();
    if (saved.length === 0) {
      showToast("لا توجد منتجات لتصديرها", "error");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(saved, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `temu_stock_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("تم تصدير نسخة احتياطية بنجاح", "success");
  });

  importBtn?.addEventListener("click", () => {
    importFile?.click();
  });

  importFile?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const imported = JSON.parse(evt.target.result);
        if (Array.isArray(imported)) {
          saveSavedProducts(imported);
          saveWorkingProducts(imported);
          showToast("تم استيراد البيانات بنجاح", "success");
          setTimeout(() => {
            location.reload();
          }, 1000);
        } else {
          showToast("الملف لا يحتوي على قائمة منتجات صالحة", "error");
        }
      } catch {
        showToast("حدث خطأ أثناء قراءة ملف الاستيراد", "error");
      }
    };
    reader.readAsText(file);
  });

  render();
  return true;
}

// --- 2. إدارة صفحة المنتجات المحفوظة (products.html) ---

function initSavedProductsPage() {
  const tbody = document.getElementById("product-list");
  if (!tbody) return false;

  const searchInput = document.getElementById("search-input");
  const filterDelivery = document.getElementById("filter-delivery");
  const filterStock = document.getElementById("filter-stock");
  const filterPriceMin = document.getElementById("filter-price-min");
  const filterPriceMax = document.getElementById("filter-price-max");
  const sortBy = document.getElementById("sort-by");
  const clearButton = document.getElementById("clear-all");
  const backButton = document.getElementById("go-back");

  const categoryTabsContainer = document.getElementById("category-tabs-container");
  const inventoryNavLinks = document.getElementById("inventory-nav-links");

  let currentCategory = "all";
  let currentInventorySection = 1;

  // تهيئة نموذج التعديل المباشر لقاعدة البيانات
  setupModals({
    onSaveForm: (product, index) => {
      const saved = getSavedProducts();
      
      const duplicateIndex = saved.findIndex(p => p.code.toLowerCase() === product.code.toLowerCase());
      if (duplicateIndex !== -1 && duplicateIndex !== parseInt(index, 10)) {
        const modalError = document.getElementById("modal-error");
        if (modalError) {
          modalError.textContent = "⚠️ رمز المنتج (SKU) مستخدم بالفعل لمنتج آخر.";
          modalError.classList.remove("hidden");
          return;
        }
      }

      const dateStr = getCurrentDateTimeString();
      const originalProduct = saved[parseInt(index, 10)];
      
      product.createdAt = originalProduct.createdAt || dateStr;
      product.updatedAt = dateStr;
      
      saved[parseInt(index, 10)] = product;
      
      // التعديل المباشر يزامن قاعدة البيانات والمسودة فوراً
      saveSavedProducts(saved);
      saveWorkingProducts(saved);
      
      showToast("تم تعديل المنتج المحفوظ بنجاح", "success");
      document.getElementById("product-modal").classList.add("hidden");
      render();
    },
    onDeleteConfirm: (index) => {
      const saved = getSavedProducts();
      saved.splice(index, 1);
      
      saveSavedProducts(saved);
      saveWorkingProducts(saved);
      
      showToast("تم حذف المنتج بنجاح", "success");
      
      // التحقق من صلاحية رقم قسم المخزون الحالي بعد الحذف
      const totalSections = Math.max(1, Math.ceil(saved.length / 100));
      if (currentInventorySection > totalSections) {
        currentInventorySection = totalSections;
      }
      
      render();
    }
  });

  // تصفية، تقسيم، وترتيب وعرض المنتجات المحفوظة وحساب إحصائياتها
  function render() {
    const savedProducts = getSavedProducts();

    // 1. توليد نظام تصفح أقسام المخزون ديناميكياً بناءً على الحجم الكلي للمخزون المحفوظ (100 عنصر لكل قسم)
    const totalProducts = savedProducts.length;
    const totalSections = Math.max(1, Math.ceil(totalProducts / 100));

    if (currentInventorySection > totalSections) {
      currentInventorySection = totalSections;
    }

    if (inventoryNavLinks) {
      inventoryNavLinks.innerHTML = "";
      for (let i = 1; i <= totalSections; i++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `inventory-nav-btn ${i === currentInventorySection ? 'active' : ''}`;
        btn.textContent = `المخزون ${i}`;
        btn.dataset.section = i;
        btn.addEventListener("click", () => {
          currentInventorySection = i;
          render();
        });
        inventoryNavLinks.appendChild(btn);
      }
    }

    // 2. تجميع وتصفية المنتجات في القسم الحالي
    const query = searchInput?.value.toLowerCase().trim() || "";
    const deliveryFilter = filterDelivery?.value || "all";
    const stockFilter = filterStock?.value || "all";
    const minPrice = filterPriceMin?.value ? parseFloat(filterPriceMin.value) : null;
    const maxPrice = filterPriceMax?.value ? parseFloat(filterPriceMax.value) : null;
    const sortVal = sortBy?.value || "name";

    // تصفية المنتجات التي تقع في القسم الحالي وبناءً على كافة الفلاتر النشطة
    let filtered = [];

    savedProducts.forEach((product, originalIndex) => {
      // حساب رقم القسم الأصلي للمنتج بناءً على موقعه في قاعدة البيانات
      const productSection = Math.floor(originalIndex / 100) + 1;

      // أ) فلترة رقم المخزون (يجب أن يعمل الفلتران معاً)
      if (productSection !== currentInventorySection) return;

      // ب) فلترة التصنيف الفوري
      if (currentCategory !== "all" && product.category !== currentCategory) return;

      // ج) فلترة البحث النصي (SKU أو الاسم)
      const matchesSearch = product.name.toLowerCase().includes(query) || product.code.toLowerCase().includes(query);
      if (!matchesSearch) return;

      // د) فلترة حالة التوصيل
      if (deliveryFilter !== "all" && product.deliveryStatus !== deliveryFilter) return;

      // هـ) فلترة حالة المخزون
      const remQty = product.initialQty - product.qtySold;
      if (stockFilter === "instock" && remQty <= 5) return;
      if (stockFilter === "lowstock" && (remQty === 0 || remQty > 5)) return;
      if (stockFilter === "outofstock" && remQty !== 0) return;

      // و) فلترة نطاق السعر
      if (minPrice !== null && product.sellingPrice < minPrice) return;
      if (maxPrice !== null && product.sellingPrice > maxPrice) return;

      // إضافة المنتج إلى القائمة النشطة مع الاحتفاظ بمرجع الفهرس الأصلي في المصفوفة الكلية
      filtered.push({ ...product, masterIndex: originalIndex });
    });

    // 3. ترتيب المنتجات المصفاة
    filtered.sort((a, b) => {
      const profitA = ((a.sellingPrice - a.purchasePrice) * a.qtySold) - (a.deliveryStatus === "active" ? (a.deliveryPrice * a.qtySold) : 0);
      const profitB = ((b.sellingPrice - b.purchasePrice) * b.qtySold) - (b.deliveryStatus === "active" ? (b.deliveryPrice * b.qtySold) : 0);
      const salesA = a.sellingPrice * a.qtySold;
      const salesB = b.sellingPrice * b.qtySold;
      const remA = a.initialQty - a.qtySold;
      const remB = b.initialQty - b.qtySold;

      if (sortVal === "name") {
        return a.name.localeCompare(b.name, "ar");
      }
      if (sortVal === "code") {
        return a.code.localeCompare(b.code);
      }
      if (sortVal === "profit-desc") {
        return profitB - profitA;
      }
      if (sortVal === "profit-asc") {
        return profitA - profitB;
      }
      if (sortVal === "sales-desc") {
        return salesB - salesA;
      }
      if (sortVal === "stock-desc") {
        return remB - remA;
      }
      if (sortVal === "stock-asc") {
        return remA - remB;
      }
      return 0;
    });

    // 4. تحديث الإحصائيات بناءً على المنتجات المصفاة الحالية تلقائياً
    let totalQty = 0;
    let totalSold = 0;
    let remainingStock = 0;
    let totalPurchaseVal = 0;
    let totalSalesVal = 0;
    let totalDeliveryCost = 0;
    let totalProfit = 0;

    filtered.forEach((p) => {
      const remQty = p.initialQty - p.qtySold;
      const rowTotal = p.sellingPrice * p.qtySold;
      const rowPurchaseVal = p.purchasePrice * p.initialQty;
      const rowDeliveryCost = p.deliveryStatus === "active" ? (p.deliveryPrice * p.qtySold) : 0;
      const rowProfit = ((p.sellingPrice - p.purchasePrice) * p.qtySold) - rowDeliveryCost;

      totalQty += p.initialQty;
      totalSold += p.qtySold;
      remainingStock += remQty;
      totalPurchaseVal += rowPurchaseVal;
      totalSalesVal += rowTotal;
      totalDeliveryCost += rowDeliveryCost;
      totalProfit += rowProfit;
    });

    document.getElementById("stat-count").textContent = filtered.length;
    document.getElementById("stat-total-qty").textContent = totalQty;
    document.getElementById("stat-total-sold").textContent = totalSold;
    document.getElementById("stat-remaining-stock").textContent = remainingStock;
    
    document.getElementById("stat-purchase-val").textContent = formatNumber(totalPurchaseVal);
    document.getElementById("stat-sales-val").textContent = formatNumber(totalSalesVal);
    document.getElementById("stat-delivery-cost").textContent = formatNumber(totalDeliveryCost);
    
    const profitEl = document.getElementById("stat-profit");
    profitEl.textContent = formatNumber(totalProfit);
    
    if (totalProfit < 0) {
      profitEl.style.color = "var(--danger)";
    } else {
      profitEl.style.color = "var(--accent-3)";
    }

    // 5. طباعة صفوف الجدول
    tbody.innerHTML = "";
    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="14" class="muted" style="padding: 32px; text-align: center;">لا توجد منتجات مطابقة لخيارات البحث والفلاتر الحالية في هذا القسم.</td>
        </tr>
      `;
      return;
    }

    filtered.forEach((product, idx) => {
      const remQty = product.initialQty - product.qtySold;
      const rowTotal = product.sellingPrice * product.qtySold;

      let stockBadgeClass = "stock-ok";
      if (remQty === 0) stockBadgeClass = "stock-empty";
      else if (remQty < 5) stockBadgeClass = "stock-warning";

      const row = document.createElement("tr");
      
      // الترقيم في كل قسم مخزون يجب أن يبدأ دائماً من الرقم 1
      row.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong>${escapeHtml(product.code)}</strong></td>
        <td>${escapeHtml(product.name)}</td>
        <td><span style="font-size:0.9rem; font-weight:600;">${getCategoryLabel(product.category)}</span></td>
        <td>${formatNumber(product.purchasePrice)}</td>
        <td>${product.initialQty}</td>
        <td>${formatNumber(product.sellingPrice)}</td>
        <td>${product.qtySold}</td>
        <td><span class="stock-badge ${stockBadgeClass}">${remQty}</span></td>
        <td>${product.deliveryStatus === "active" ? "🚚 مع توصيل" : "❌ بدون توصيل"}</td>
        <td>${product.deliveryStatus === "active" ? formatNumber(product.deliveryPrice) : '<span class="muted">-</span>'}</td>
        <td><strong>${formatNumber(rowTotal)}</strong></td>
        <td>
          <button type="button" class="action-edit-btn" data-index="${product.masterIndex}" style="background:none; border:none; cursor:pointer; font-size:1.1rem;" title="تعديل">✏️</button>
        </td>
        <td>
          <button type="button" class="action-delete-btn" data-index="${product.masterIndex}" style="background:none; border:none; cursor:pointer; font-size:1.1rem;" title="حذف">🗑️</button>
        </td>
      `;
      tbody.appendChild(row);
    });

    // 6. توليد وتحديث أزرار التصفح والترقيم للجدول (Pagination)
    const paginationContainer = document.getElementById("pagination-container");
    if (paginationContainer) {
      paginationContainer.innerHTML = "";
      
      // زر السابق
      const prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "pagination-btn";
      prevBtn.textContent = "« السابق";
      prevBtn.disabled = currentInventorySection === 1;
      prevBtn.addEventListener("click", () => {
        if (currentInventorySection > 1) {
          currentInventorySection--;
          render();
        }
      });
      paginationContainer.appendChild(prevBtn);

      // الأزرار الرقمية
      for (let i = 1; i <= totalSections; i++) {
        const pageBtn = document.createElement("button");
        pageBtn.type = "button";
        pageBtn.className = `pagination-btn ${i === currentInventorySection ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener("click", () => {
          currentInventorySection = i;
          render();
        });
        paginationContainer.appendChild(pageBtn);
      }

      // زر التالي
      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "pagination-btn";
      nextBtn.textContent = "التالي »";
      nextBtn.disabled = currentInventorySection === totalSections;
      nextBtn.addEventListener("click", () => {
        if (currentInventorySection < totalSections) {
          currentInventorySection++;
          render();
        }
      });
      paginationContainer.appendChild(nextBtn);
    }
  }

  // ربط أحداث شريط البحث والترتيب والتصفية
  searchInput?.addEventListener("input", render);
  filterDelivery?.addEventListener("change", render);
  filterStock?.addEventListener("change", render);
  filterPriceMin?.addEventListener("input", render);
  filterPriceMax?.addEventListener("input", render);
  sortBy?.addEventListener("change", render);

  // ربط أزرار اختيار فئات المنتجات (Category Tabs)
  categoryTabsContainer?.addEventListener("click", (e) => {
    const tab = e.target.closest(".category-tab");
    if (!tab) return;
    
    // تغيير التبويب النشط
    categoryTabsContainer.querySelectorAll(".category-tab").forEach(btn => btn.classList.remove("active"));
    tab.classList.add("active");
    
    currentCategory = tab.dataset.category;
    render();
  });

  // حذف جميع المنتجات المحفوظة والمسودات
  clearButton?.addEventListener("click", () => {
    onDeleteConfirmCallback = (index) => {
      if (index === "all-saved") {
        saveSavedProducts([]);
        saveWorkingProducts([]);
        showToast("تم حذف قاعدة البيانات بالكامل بنجاح", "success");
        render();
      }
    };
    currentDeleteIndex = "all-saved";
    const deleteModal = document.getElementById("delete-modal");
    if (deleteModal) {
      deleteModal.querySelector(".modal-body p").textContent = "هل أنت متأكد من حذف جميع المنتجات المحفوظة نهائياً من الذاكرة؟";
      deleteModal.classList.remove("hidden");
    }
  });

  // العودة لصفحة لوحة الحساب
  backButton?.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  // معالجة الضغط على تعديل/حذف من داخل جدول المحفوظات
  tbody.addEventListener("click", (event) => {
    const editBtn = event.target.closest(".action-edit-btn");
    const deleteBtn = event.target.closest(".action-delete-btn");

    if (editBtn) {
      const index = parseInt(editBtn.dataset.index, 10);
      const saved = getSavedProducts();
      if (saved[index]) {
        openEditModal(saved[index], index);
      }
    }

    if (deleteBtn) {
      const index = parseInt(deleteBtn.dataset.index, 10);
      onDeleteConfirmCallback = (idx) => {
        const saved = getSavedProducts();
        saved.splice(idx, 1);
        saveSavedProducts(saved);
        saveWorkingProducts(saved);
        showToast("تم حذف المنتج بنجاح", "success");
        render();
      };
      triggerDeleteModal(index);
    }
  });

  // تفعيل توست الحفظ القادم من صفحة الحساب
  if (localStorage.getItem("showSavedToast") === "true") {
    showToast("تم حفظ المنتجات بنجاح", "success");
    localStorage.removeItem("showSavedToast");
  }

  // أزرار تصدير واستيراد البيانات لصفحة المحفوظات
  const exportSavedBtn = document.getElementById("export-saved-btn");
  const importSavedBtn = document.getElementById("import-saved-btn");
  const importSavedFile = document.getElementById("import-saved-file");

  exportSavedBtn?.addEventListener("click", () => {
    const saved = getSavedProducts();
    if (saved.length === 0) {
      showToast("لا توجد منتجات لتصديرها", "error");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(saved, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `temu_stock_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("تم تصدير نسخة احتياطية بنجاح", "success");
  });

  importSavedBtn?.addEventListener("click", () => {
    importSavedFile?.click();
  });

  importSavedFile?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const imported = JSON.parse(evt.target.result);
        if (Array.isArray(imported)) {
          saveSavedProducts(imported);
          saveWorkingProducts(imported);
          showToast("تم استيراد البيانات بنجاح", "success");
          setTimeout(() => {
            location.reload();
          }, 1000);
        } else {
          showToast("الملف لا يحتوي على قائمة منتجات صالحة", "error");
        }
      } catch {
        showToast("حدث خطأ أثناء قراءة ملف الاستيراد", "error");
      }
    };
    reader.readAsText(file);
  });

  render();
  return true;
}

// تشغيل التهيئة عند تحميل المستند
document.addEventListener("DOMContentLoaded", () => {
  initCalculatorPage();
  initSavedProductsPage();
});
