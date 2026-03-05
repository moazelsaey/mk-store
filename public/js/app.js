// ── MK Store app.js (optimised) ─────────────────────────────────────────────
(function () {
  'use strict';

  // ── STATE ──────────────────────────────────────────────────────────────────
  const state = {
    products: [], rarity: {}, categories: [], paymentMethods: [],
    cart: [], cartTotal: 0, cartCount: 0,
    activeCategory: 'All', searchQuery: '', sort: 'default',
    cartOpen: false, selectedMethod: 'vodafone',
    screenshotData: null,
  };

  // ── DOM ────────────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const E = {
    grid: $('productGrid'), categoryBar: $('categoryBar'),
    cartCount: $('cartCount'), cartBtn: $('cartBtn'),
    cartDrawer: $('cartDrawer'), cartItems: $('cartItems'),
    cartTotal: $('cartTotal'), overlay: $('overlay'),
    closeCart: $('closeCart'), checkoutBtn: $('checkoutBtn'),
    searchInput: $('searchInput'), sortSelect: $('sortSelect'),
    resultsCount: $('resultsCount'), toast: $('toast'),
    loadingState: $('loadingState'),
    paymentOverlay: $('paymentOverlay'), closePayment: $('closePayment'),
    methodTabs: $('methodTabs'),
    payAmount: $('payAmount'), payPhone: $('payPhone'),
    payMethodName: $('payMethodName'), payInstruction: $('payInstruction'),
    copyPhone: $('copyPhone'),
    fortniteUsername: $('fortniteUsername'), buyerWhatsapp: $('buyerWhatsapp'),
    fortniteEmail: $('fortniteEmail'), fortnitePassword: $('fortnitePassword'),
    screenshotInput: $('screenshotInput'), uploadArea: $('uploadArea'),
    uploadPreview: $('uploadPreview'), uploadText: $('uploadText'),
    uploadIcon: $('uploadIcon'), uploadSub: $('uploadSub'),
    confirmPayBtn: $('confirmPayBtn'),
    successOverlay: $('successOverlay'), successOrderId: $('successOrderId'),
    successTotal: $('successTotal'), successClose: $('successClose'),
    senderName: $('senderName'), senderPhone: $('senderPhone'),
    senderWa: $('senderWa'), senderWaLink: $('senderWaLink'),
  };

  // ── API ────────────────────────────────────────────────────────────────────
  async function api(path, method = 'GET', body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
    return res.json();
  }

  async function loadProducts() {
    const p = new URLSearchParams({ category: state.activeCategory, search: state.searchQuery, sort: state.sort });
    const data = await api(`/api/products?${p}`);
    state.products   = data.products;
    state.rarity     = data.rarity;
    state.categories = data.categories;
    if (data.lastSync) {
      const badge  = document.getElementById('syncBadge');
      const timeEl = document.getElementById('syncTime');
      const t = new Date(data.lastSync);
      timeEl.textContent = 'Shop synced ' + t.toLocaleTimeString('en-EG',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Cairo'});
      badge.style.display = 'inline-flex';
    }
    renderCategories();
    renderGrid();
  }

  async function loadCart() {
    const data = await api('/api/cart');
    state.cart = data.cart; state.cartTotal = data.total; state.cartCount = data.count;
    renderCartCount(); renderCartItems();
  }

  async function loadPaymentMethods() {
    const data = await api('/api/payment-methods');
    state.paymentMethods = data.methods;
  }

  async function addToCart(id) {
    try {
      const data = await api('/api/cart/add', 'POST', { id });
      state.cart = data.cart; state.cartTotal = data.total; state.cartCount = data.count;
      renderCartCount(); renderCartItems(); bumpCount();
      const p = state.products.find(p => p.id === id);
      showToast(`✓ ${p ? p.name : 'Item'} added to cart!`);
      refreshCardBtn(id, 'added');
    } catch (e) { showToast('❌ ' + e.message); }
  }

  async function removeFromCart(id) {
    try {
      const data = await api('/api/cart/remove', 'POST', { id });
      state.cart = data.cart; state.cartTotal = data.total; state.cartCount = data.count;
      renderCartCount(); renderCartItems(); renderGrid();
    } catch (e) { showToast('❌ ' + e.message); }
  }

  async function submitOrder() {
    const fnUser   = E.fortniteUsername.value.trim();
    const buyerWa  = E.buyerWhatsapp.value.trim();
    const fnEmail  = E.fortniteEmail.value.trim();
    const fnPass   = E.fortnitePassword.value;
    const screenshot = state.screenshotData || null;
    if (!fnUser  || fnUser.length < 2)  { showToast('❌ Enter your Fortnite username'); return; }
    if (!buyerWa || buyerWa.length < 8) { showToast('❌ Enter your WhatsApp number');  return; }
    if (!screenshot)                     { showToast('❌ Upload your payment screenshot'); return; }

    E.confirmPayBtn.disabled = true;
    E.confirmPayBtn.textContent = 'Processing…';
    try {
      const data = await api('/api/cart/checkout', 'POST', {
        paymentMethod:    state.selectedMethod,
        fortniteUsername: fnUser,
        buyerWhatsapp:    buyerWa,
        fortniteEmail:    fnEmail || null,
        fortnitePassword: fnPass  || null,
        screenshot,
      });
      if (data.success) {
        state.cart = []; state.cartTotal = 0; state.cartCount = 0;
        renderCartCount(); renderCartItems(); renderGrid();
        closePaymentModal();

        E.successOrderId.textContent = `Order ID: ${data.orderId}`;
        E.successTotal.textContent   = `Total paid: ${data.totalEGP || data.total} EGP`;

        const sender = data.assignedSender;
        const box    = document.getElementById('senderInfoBox');
        if (sender && sender.name) {
          E.senderName.textContent = sender.name;
          E.senderPhone.textContent = sender.phone;
          E.senderWa.textContent   = sender.whatsapp;
          E.senderWaLink.href      = `https://wa.me/${sender.whatsapp}`;
          const sv = document.getElementById('senderVodafone');
          const si = document.getElementById('senderInstapay');
          if (sv) sv.textContent = sender.vodafoneNumber || '—';
          if (si) si.textContent = sender.instapayNumber || '—';
          box.style.display = 'block';
        } else {
          box.style.display = 'none';
        }

        E.successOverlay.classList.add('open');
        E.fortniteUsername.value = ''; E.buyerWhatsapp.value = '';
        E.fortniteEmail.value = ''; E.fortnitePassword.value = '';
        state.screenshotData = null;
        E.uploadArea.classList.remove('has-file');
        E.uploadPreview.style.display = 'none';
        E.uploadIcon.style.display = 'block';
        E.uploadText.textContent = 'Tap to upload screenshot';
        E.uploadSub.textContent  = 'PNG, JPG or JPEG';
        E.screenshotInput.value  = '';
      }
    } catch (e) { showToast('❌ ' + e.message); }
    finally { E.confirmPayBtn.disabled = false; E.confirmPayBtn.textContent = 'Confirm Order ✓'; }
  }

  // ── RENDER CATEGORIES ─────────────────────────────────────────────────────
  function renderCategories() {
    if (E.categoryBar.children.length) {
      E.categoryBar.querySelectorAll('.cat-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.cat === state.activeCategory);
      });
      return;
    }
    state.categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-btn' + (cat === state.activeCategory ? ' active' : '');
      btn.textContent = cat; btn.dataset.cat = cat;
      btn.addEventListener('click', () => { state.activeCategory = cat; loadProducts(); });
      E.categoryBar.appendChild(btn);
    });
  }

  // ── RENDER GRID ───────────────────────────────────────────────────────────
  // Use documentFragment + innerHTML string for fast batch render
  function renderGrid() {
    if (E.loadingState) E.loadingState.remove();
    E.grid.querySelectorAll('.card,.no-results').forEach(el => el.remove());

    if (!state.products.length) {
      E.grid.insertAdjacentHTML('beforeend', '<div class="no-results"><div class="no-results-icon">🔍</div><p>No items found.</p></div>');
      E.resultsCount.textContent = '0 items found';
      return;
    }

    E.resultsCount.textContent = `${state.products.length} item${state.products.length !== 1 ? 's' : ''} found`;
    const cartIds = new Set(state.cart.map(i => i.id));

    // Build all HTML at once — much faster than one-by-one appendChild
    const html = state.products.map((p, i) => {
      const cfg    = state.rarity[p.rarity] || { color: '#00d4ff', label: p.rarity };
      const inCart = cartIds.has(p.id);
      const delay  = Math.min(i * 0.04, 0.4);
      return `
        <div class="card" data-id="${p.id}" style="animation-delay:${delay}s">
          <div class="card-img-wrap">
            <img class="card-img" src="${p.img}" alt="${p.name}" loading="lazy" onerror="this.style.opacity='.2'" />
            <div class="card-img-overlay"></div>
            <div class="card-rarity-bar" style="background:linear-gradient(90deg,transparent,${cfg.color},transparent)"></div>
            ${p.badge ? `<div class="card-badge" style="background:${cfg.color}">${p.badge}</div>` : ''}
          </div>
          <div class="card-body">
            <span class="card-rarity-label" style="color:${cfg.color};border-color:${cfg.color}">${cfg.label}</span>
            <h3 class="card-name">${p.name}</h3>
            ${p.amount ? `<div class="card-amount" style="color:${cfg.color}">${p.amount}</div>` : ''}
            <p class="card-desc">${p.description}</p>
            <div class="card-footer">
              <span class="card-price">${p.priceEGP.toLocaleString()} EGP</span>
              <button class="add-btn ${inCart ? 'in-cart' : ''}" data-id="${p.id}"
                style="background:${inCart ? 'transparent' : cfg.color};color:${inCart ? cfg.color : '#000'};${inCart ? `border:1px solid ${cfg.color}` : ''}">
                ${inCart ? 'In Cart' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>`;
    }).join('');

    E.grid.insertAdjacentHTML('beforeend', html);

    // Single delegated listener instead of one per card
    E.grid.addEventListener('click', gridClickHandler, { once: false });
  }

  // Single delegated click handler for the whole grid
  function gridClickHandler(e) {
    const btn = e.target.closest('.add-btn');
    if (!btn) return;
    e.stopPropagation();
    addToCart(+btn.dataset.id);
  }
  // Attach once on init
  E.grid.addEventListener('click', gridClickHandler);

  function refreshCardBtn(id, state_) {
    const btn = E.grid.querySelector(`.add-btn[data-id="${id}"]`);
    if (!btn) return;
    const p   = state.products.find(p => p.id === id);
    const cfg = p ? (state.rarity[p.rarity] || {}) : {};
    const c   = cfg.color || '#00d4ff';
    if (state_ === 'added') {
      btn.textContent = '✓ Added!'; btn.classList.add('added');
      setTimeout(() => {
        btn.textContent = 'In Cart';
        btn.classList.remove('added'); btn.classList.add('in-cart');
        btn.style.background = 'transparent'; btn.style.color = c;
        btn.style.border = `1px solid ${c}`;
      }, 700);
    }
  }

  // ── CART ──────────────────────────────────────────────────────────────────
  function renderCartCount() { E.cartCount.textContent = state.cartCount; }

  function renderCartItems() {
    E.cartItems.innerHTML = '';
    if (!state.cart.length) {
      E.cartItems.innerHTML = '<div class="cart-empty"><div class="cart-empty-icon">🛒</div><p>Your cart is empty</p></div>';
      E.cartTotal.textContent = '0 EGP'; return;
    }
    const html = state.cart.map(item => {
      const cfg = state.rarity[item.rarity] || { color: '#00d4ff' };
      return `
        <div class="cart-item">
          <img class="cart-item-img" src="${item.img}" alt="${item.name}" loading="lazy" onerror="this.style.display='none'" />
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">${item.priceEGP.toLocaleString()} EGP × ${item.qty} = <strong style="color:${cfg.color}">${(item.priceEGP * item.qty).toLocaleString()} EGP</strong></div>
          </div>
          <button class="cart-remove" data-id="${item.id}" title="Remove">🗑</button>
        </div>`;
    }).join('');
    E.cartItems.innerHTML = html;
    E.cartItems.querySelectorAll('.cart-remove').forEach(btn => {
      btn.addEventListener('click', () => removeFromCart(+btn.dataset.id));
    });
    E.cartTotal.textContent = `${state.cartTotal.toLocaleString()} EGP`;
  }

  // ── PAYMENT MODAL ─────────────────────────────────────────────────────────
  function openPaymentModal() {
    if (!state.cart.length) { showToast('⚠️ Your cart is empty!'); return; }
    closeCartDrawer(); updatePaymentUI();
    E.paymentOverlay.classList.add('open');
    E.overlay.classList.add('open');
  }
  function closePaymentModal() {
    E.paymentOverlay.classList.remove('open');
    E.overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  function updatePaymentUI() {
    const method = state.paymentMethods.find(m => m.id === state.selectedMethod);
    if (!method) return;
    E.payAmount.textContent      = `${state.cartTotal.toLocaleString()} EGP`;
    E.payPhone.textContent       = method.number;
    E.payMethodName.textContent  = `via ${method.name}`;
    E.payInstruction.textContent = method.instruction;
    E.confirmPayBtn.className    = 'confirm-btn';
    if (state.selectedMethod === 'vodafone') E.confirmPayBtn.classList.add('voda-btn');
    if (state.selectedMethod === 'instapay') E.confirmPayBtn.classList.add('insta-btn');
    if (state.selectedMethod === 'telda')    E.confirmPayBtn.classList.add('telda-btn');
    E.payAmount.style.color = method.color;
    document.querySelectorAll('.step-num').forEach(s => s.style.background = method.color);
    E.methodTabs.querySelectorAll('.method-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.method === state.selectedMethod);
    });
  }

  // ── CART DRAWER ───────────────────────────────────────────────────────────
  function openCartDrawer()  {
    state.cartOpen = true;
    E.cartDrawer.classList.add('open');
    E.overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeCartDrawer() {
    state.cartOpen = false;
    E.cartDrawer.classList.remove('open');
    if (!E.paymentOverlay.classList.contains('open')) E.overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ── TOAST ─────────────────────────────────────────────────────────────────
  let toastT;
  function showToast(msg) {
    clearTimeout(toastT);
    E.toast.textContent = msg;
    E.toast.classList.add('show');
    toastT = setTimeout(() => E.toast.classList.remove('show'), 2800);
  }

  function bumpCount() {
    E.cartCount.classList.add('bump');
    setTimeout(() => E.cartCount.classList.remove('bump'), 300);
  }

  // ── PARTICLES — reduced count + skip on low-end devices ───────────────────
  function initParticles() {
    const cv = document.getElementById('particles');
    if (!cv) return;
    // Skip particles on mobile to save battery & CPU
    if (window.innerWidth < 640) { cv.style.display = 'none'; return; }
    const ctx = cv.getContext('2d');
    let W = cv.width = innerWidth, H = cv.height = innerHeight;
    const cols = ['#00d4ff','#a335ee','#ff8000','#1eff00'];
    // Reduced from 55 → 28 particles
    const pts = Array.from({ length: 28 }, () => ({
      x: Math.random()*W, y: Math.random()*H,
      r: Math.random()*1.6+.3,
      dx: (Math.random()-.5)*.3, dy: (Math.random()-.5)*.3,
      a: Math.random()*.4+.1, c: cols[Math.floor(Math.random()*cols.length)],
    }));
    let raf;
    (function draw() {
      ctx.clearRect(0,0,W,H);
      pts.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle = p.c + Math.floor(p.a*255).toString(16).padStart(2,'0');
        ctx.fill(); p.x+=p.dx; p.y+=p.dy;
        if(p.x<0||p.x>W) p.dx*=-1; if(p.y<0||p.y>H) p.dy*=-1;
      });
      raf = requestAnimationFrame(draw);
    })();
    // Pause particles when tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else (function draw() { /* restart */ raf = requestAnimationFrame(draw); })();
    });
    addEventListener('resize', () => { W=cv.width=innerWidth; H=cv.height=innerHeight; });
  }

  // ── SCREENSHOT UPLOAD ─────────────────────────────────────────────────────
  // Simple direct trigger — works on iOS Safari
  E.uploadArea.addEventListener('click', () => {
    E.screenshotInput.value = ''; // reset so same file can be re-selected
    E.screenshotInput.click();
  });
  E.uploadArea.addEventListener('dragover', e => { e.preventDefault(); E.uploadArea.classList.add('dragover'); });
  E.uploadArea.addEventListener('dragleave', () => E.uploadArea.classList.remove('dragover'));
  E.uploadArea.addEventListener('drop', e => {
    e.preventDefault(); E.uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0]; if (file) handleScreenshot(file);
  });
  E.screenshotInput.addEventListener('change', () => {
    const file = E.screenshotInput.files[0]; if (file) handleScreenshot(file);
  });
  function handleScreenshot(file) {
    // image/* covers HEIC/HEIF on iOS; also allow empty type (some Android browsers)
    if (file.type && !file.type.startsWith('image/')) { showToast('❌ Please upload an image file'); return; }
    if (file.size > 5*1024*1024) { showToast('❌ Screenshot must be under 5MB'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      state.screenshotData    = e.target.result;
      E.uploadPreview.src     = e.target.result;
      E.uploadPreview.style.display = 'block';
      E.uploadIcon.style.display    = 'none';
      E.uploadText.textContent = '✅ ' + file.name;
      E.uploadSub.textContent  = (file.size/1024).toFixed(0) + ' KB — tap to change';
      E.uploadArea.classList.add('has-file');
    };
    reader.readAsDataURL(file);
  }

  // ── EVENTS ────────────────────────────────────────────────────────────────
  E.cartBtn.addEventListener('click',     () => state.cartOpen ? closeCartDrawer() : openCartDrawer());
  E.closeCart.addEventListener('click',   closeCartDrawer);
  E.overlay.addEventListener('click',     () => { closeCartDrawer(); closePaymentModal(); });
  E.checkoutBtn.addEventListener('click', openPaymentModal);
  E.closePayment.addEventListener('click',closePaymentModal);
  E.confirmPayBtn.addEventListener('click', submitOrder);
  E.successClose.addEventListener('click', () => E.successOverlay.classList.remove('open'));

  document.getElementById('togglePass').addEventListener('click', () => {
    const inp = E.fortnitePassword;
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  E.methodTabs.addEventListener('click', e => {
    const tab = e.target.closest('.method-tab');
    if (!tab) return;
    state.selectedMethod = tab.dataset.method;
    updatePaymentUI();
  });

  E.copyPhone.addEventListener('click', () => {
    const method = state.paymentMethods.find(m => m.id === state.selectedMethod);
    if (!method) return;
    navigator.clipboard.writeText(method.number || '')
      .then(() => showToast('📋 Number copied!'))
      .catch(() => showToast('📋 ' + (method.number || '')));
  });

  let searchT;
  E.searchInput.addEventListener('input', () => {
    clearTimeout(searchT);
    searchT = setTimeout(() => { state.searchQuery = E.searchInput.value.trim(); loadProducts(); }, 350);
  });
  E.sortSelect.addEventListener('change', () => { state.sort = E.sortSelect.value; loadProducts(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeCartDrawer(); closePaymentModal(); E.successOverlay.classList.remove('open'); }
  });

  // ── INIT ──────────────────────────────────────────────────────────────────
  async function init() {
    initParticles();
    await Promise.all([loadProducts(), loadCart(), loadPaymentMethods()]);
  }

  init().catch(err => {
    console.error(err);
    if (E.loadingState) E.loadingState.remove();
    E.grid.innerHTML = '<div class="no-results"><div class="no-results-icon">⚠️</div><p>Failed to load. Please refresh.</p></div>';
  });
})();
