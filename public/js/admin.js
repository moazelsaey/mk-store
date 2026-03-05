// admin.js — MK Store Admin Panel
(function () {
  'use strict';

  // ── API ────────────────────────────────────────────────────────────────────
  async function api(path, method = 'GET', body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res  = await fetch(path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  // ── TOAST ──────────────────────────────────────────────────────────────────
  let toastT;
  function toast(msg, type = 'success') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className   = `toast show ${type}`;
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('show'), 3000);
  }

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  const loginPage = document.getElementById('loginPage');
  const adminApp  = document.getElementById('adminApp');
  const adminName = document.getElementById('adminName');

  async function checkAuth() {
    try {
      const data = await api('/api/admin/me');
      showApp(data.username);
    } catch {
      showLogin();
    }
  }

  function showLogin() { loginPage.style.display = 'flex'; adminApp.classList.remove('visible'); }
  function showApp(username) {
    loginPage.style.display = 'none';
    adminApp.classList.add('visible');
    adminName.textContent = username;
    loadAll();
  }

  document.getElementById('loginBtn').addEventListener('click', async () => {
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value;
    const errEl    = document.getElementById('loginError');
    errEl.textContent = '';
    if (!username || !password) { errEl.textContent = 'Enter username and password'; return; }
    try {
      const data = await api('/api/admin/login', 'POST', { username, password });
      showApp(data.username);
    } catch (e) { errEl.textContent = e.message; }
  });

  document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('loginBtn').click(); });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await api('/api/admin/logout', 'POST').catch(() => {});
    showLogin();
  });

  // ── NAVIGATION ─────────────────────────────────────────────────────────────
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      document.getElementById('page-' + item.dataset.page).classList.add('active');
      if (item.dataset.page === 'orders')   renderOrders();
      if (item.dataset.page === 'products') renderProducts();
      if (item.dataset.page === 'senders')  renderSenders();
      if (item.dataset.page === 'dashboard') renderDashboard();
      if (item.dataset.page === 'shop')     { renderShopPage(); loadVisibility(); }
    });
  });

  // ── STATE ──────────────────────────────────────────────────────────────────
  let allProducts = [];
  let allOrders   = [];
  let allSenders  = [];
  let allRarity   = {};

  async function loadAll() {
    try {
      const [pd, od, sd] = await Promise.all([
        api('/api/admin/products'),
        api('/api/admin/orders'),
        api('/api/admin/senders'),
      ]);
      allProducts = pd.products; allRarity = pd.rarity;
      allOrders   = od.orders;
      allSenders  = sd.senders;
      renderDashboard();
      renderProducts();
      populateCategoryFilter(pd.categories);
    } catch (e) { toast('Failed to load data: ' + e.message, 'error'); }
  }

  // ── DASHBOARD ──────────────────────────────────────────────────────────────
  function renderDashboard() {
    const pending   = allOrders.filter(o => o.status === 'pending').length;
    const delivered = allOrders.filter(o => o.status === 'delivered').length;
    const revenue   = allOrders.filter(o => o.status !== 'cancelled').reduce((s,o) => s + o.totalEGP, 0);
    const active    = allProducts.filter(p => p.active).length;

    document.getElementById('stat-orders').textContent    = allOrders.length;
    document.getElementById('stat-pending').textContent   = pending;
    document.getElementById('stat-delivered').textContent = delivered;
    document.getElementById('stat-revenue').textContent   = revenue.toLocaleString();
    document.getElementById('stat-products').textContent  = active;

    const tbody = document.getElementById('recentOrdersBody');
    const recent = [...allOrders].slice(0, 10);
    tbody.innerHTML = recent.length ? recent.map(o => orderRow(o)).join('') : '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:2rem">No orders yet</td></tr>';
    attachOrderStatusListeners(tbody);
  }

  // ── PRODUCTS ───────────────────────────────────────────────────────────────
  function populateCategoryFilter(categories) {
    const sel = document.getElementById('productCatFilter');
    sel.innerHTML = '<option value="All">All Categories</option>';
    (categories || []).filter(c => c !== 'All').forEach(c => {
      sel.insertAdjacentHTML('beforeend', `<option value="${c}">${c}</option>`);
    });
  }

  function renderProducts() {
    const search = document.getElementById('productSearch').value.toLowerCase();
    const cat    = document.getElementById('productCatFilter').value;
    const grid   = document.getElementById('productsGrid');

    let list = allProducts.filter(p => {
      const matchSearch = !search || p.name.toLowerCase().includes(search);
      const matchCat    = cat === 'All' || p.category === cat;
      return matchSearch && matchCat;
    });

    if (!list.length) { grid.innerHTML = '<p style="color:var(--muted);padding:1rem">No products found.</p>'; return; }

    grid.innerHTML = list.map(p => {
      const cfg = allRarity[p.rarity] || { color:'#888', label: p.rarity };
      return `
        <div class="product-card ${p.active ? '' : 'inactive'}" data-id="${p.id}">
          <img class="product-card-img" src="${p.img}" alt="${p.name}" onerror="this.style.opacity='.2'"/>
          <div class="product-card-body">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:.3rem">
              <span style="font-size:.6rem;font-weight:800;color:${cfg.color};border:1px solid ${cfg.color};border-radius:3px;padding:1px 5px;text-transform:uppercase">${cfg.label}</span>
              ${p.active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-red">Hidden</span>'}
            </div>
            <div class="product-card-name">${p.name}</div>
            <div class="product-card-price">${p.priceEGP.toLocaleString()} EGP</div>
            <div class="product-card-actions">
              <button class="btn btn-ghost btn-sm edit-product-btn" data-id="${p.id}">✏️ Edit</button>
              <button class="btn btn-danger btn-sm delete-product-btn" data-id="${p.id}">🗑 Delete</button>
            </div>
          </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('.edit-product-btn').forEach(btn => {
      btn.addEventListener('click', () => openEditProduct(+btn.dataset.id));
    });
    grid.querySelectorAll('.delete-product-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteProduct(+btn.dataset.id));
    });
  }

  document.getElementById('productSearch').addEventListener('input', renderProducts);
  document.getElementById('productCatFilter').addEventListener('change', renderProducts);

  // Add product
  document.getElementById('addProductBtn').addEventListener('click', () => openProductModal());
  document.getElementById('closeProductModal').addEventListener('click', closeProductModal);
  document.getElementById('cancelProductModal').addEventListener('click', closeProductModal);

  function openProductModal(product) {
    document.getElementById('productModalTitle').textContent = product ? 'Edit Product' : 'Add Product';
    document.getElementById('editProductId').value = product ? product.id : '';
    document.getElementById('pName').value         = product ? product.name        : '';
    document.getElementById('pPrice').value        = product ? product.priceEGP    : '';
    document.getElementById('pCategory').value     = product ? product.category    : 'Skins';
    document.getElementById('pRarity').value       = product ? product.rarity      : 'common';
    document.getElementById('pAmount').value       = product ? (product.amount||'') : '';
    document.getElementById('pBadge').value        = product ? (product.badge||'')  : '';
    document.getElementById('pDescription').value  = product ? product.description : '';
    document.getElementById('pImg').value          = product ? product.img         : '';
    document.getElementById('pPopular').checked    = product ? product.popular     : false;
    document.getElementById('pActive').checked     = product ? product.active      : true;
    document.getElementById('productModal').classList.add('open');
  }
  function closeProductModal() { document.getElementById('productModal').classList.remove('open'); }
  function openEditProduct(id) { openProductModal(allProducts.find(p => p.id === id)); }

  document.getElementById('saveProductBtn').addEventListener('click', async () => {
    const id    = document.getElementById('editProductId').value;
    const price = +document.getElementById('pPrice').value;
    const name  =  document.getElementById('pName').value.trim();
    if (!name)      { toast('Product name is required', 'error'); return; }
    if (!price || price <= 0) { toast('Valid price is required', 'error'); return; }

    const payload = {
      name, priceEGP: price,
      category:    document.getElementById('pCategory').value,
      rarity:      document.getElementById('pRarity').value,
      amount:      document.getElementById('pAmount').value.trim() || null,
      badge:       document.getElementById('pBadge').value.trim()  || null,
      description: document.getElementById('pDescription').value.trim(),
      img:         document.getElementById('pImg').value.trim() || undefined,
      popular:     document.getElementById('pPopular').checked,
      active:      document.getElementById('pActive').checked,
    };

    try {
      if (id) {
        const data = await api(`/api/admin/products/${id}`, 'PUT', payload);
        const idx  = allProducts.findIndex(p => p.id === +id);
        if (idx !== -1) allProducts[idx] = data.product;
        toast('✅ Product updated!');
      } else {
        const data = await api('/api/admin/products', 'POST', payload);
        allProducts.push(data.product);
        toast('✅ Product added!');
      }
      closeProductModal();
      renderProducts();
      renderDashboard();
    } catch (e) { toast(e.message, 'error'); }
  });

  async function deleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    try {
      await api(`/api/admin/products/${id}`, 'DELETE');
      allProducts = allProducts.filter(p => p.id !== id);
      renderProducts(); renderDashboard();
      toast('🗑 Product deleted');
    } catch (e) { toast(e.message, 'error'); }
  }

  // ── ORDERS ─────────────────────────────────────────────────────────────────
  function payStatusBadge(ps) {
    if (!ps || ps === 'awaiting_verification') return '<span class="pay-status-badge awaiting">⏳ Awaiting</span>';
    if (ps === 'verified')  return '<span class="pay-status-badge verified">✅ Verified</span>';
    if (ps === 'rejected')  return '<span class="pay-status-badge rejected">❌ Rejected</span>';
    return `<span class="pay-status-badge awaiting">${ps}</span>`;
  }

  function orderRow(o) {
    const method  = o.paymentMethod === 'vodafone' ? '🔴 Vodafone'
                  : o.paymentMethod === 'telda'    ? '🟣 Telda'
                  :                                  '🟢 InstaPay';
    const sender  = o.assignedSender ? `${o.assignedSender.name}<br><small style="color:var(--muted)">${o.assignedSender.phone}</small>` : '<span style="color:var(--muted)">None</span>';
    const time    = new Date(o.createdAt).toLocaleString('en-EG', { timeZone:'Africa/Cairo', hour:'2-digit', minute:'2-digit', day:'2-digit', month:'short' });
    const items   = o.items.map(i => `${i.name} x${i.qty}`).join(', ');
    const waNum   = o.buyerWhatsapp
      ? `<a href="https://wa.me/${o.buyerWhatsapp}" target="_blank" style="color:var(--green);font-weight:700;text-decoration:none">📱 ${o.buyerWhatsapp}</a>`
      : '<span style="color:var(--muted)">—</span>';
    const email   = o.fortniteEmail
      ? `<span style="color:var(--accent)">${o.fortniteEmail}</span>`
      : '<span style="color:var(--muted)">—</span>';
    const pass    = o.fortnitePassword
      ? `<span class="pass-cell" data-pass="${o.fortnitePassword}">
           <span class="pass-hidden">••••••••</span>
           <button class="btn btn-ghost btn-sm reveal-pass" style="padding:2px 6px;font-size:.6rem" title="Reveal">👁</button>
         </span>`
      : '<span style="color:var(--muted)">—</span>';

    const canVerify = !o.paymentStatus || o.paymentStatus === 'awaiting_verification';
    const verifyBtns = canVerify
      ? `<div style="display:flex;flex-direction:column;gap:3px;margin-top:4px">
           <button class="btn btn-success btn-sm verify-btn" data-order-id="${o.orderId}" style="font-size:.65rem;padding:2px 7px">✅ Verify</button>
           <button class="btn btn-danger  btn-sm reject-btn" data-order-id="${o.orderId}" style="font-size:.65rem;padding:2px 7px">❌ Reject</button>
         </div>` : '';

    return `
      <tr class="order-row-clickable" data-order-id="${o.orderId}" title="Click to view order details">
        <td><code style="font-size:.72rem;color:var(--accent)">${o.orderId}</code></td>
        <td><strong>${o.fortniteUsername}</strong></td>
        <td>${waNum}</td>
        <td style="font-size:.78rem">${email}</td>
        <td style="font-size:.78rem">${pass}</td>
        <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.75rem;color:var(--muted)">${items}</td>
        <td><strong style="color:var(--accent)">${o.totalEGP.toLocaleString()} EGP</strong></td>
        <td>${method}</td>
        <td>${sender}</td>
        <td>
          ${payStatusBadge(o.paymentStatus)}
          ${verifyBtns}
          <button class="btn btn-ghost btn-sm screenshot-btn" data-order-id="${o.orderId}" style="font-size:.65rem;padding:2px 7px;margin-top:3px">📸 Screenshot</button>
        </td>
        <td>
          <select class="status-select" data-order-id="${o.orderId}">
            <option value="pending"    ${o.status==='pending'    ?'selected':''}>⏳ Pending</option>
            <option value="delivering" ${o.status==='delivering' ?'selected':''}>🚚 Delivering</option>
            <option value="delivered"  ${o.status==='delivered'  ?'selected':''}>✅ Delivered</option>
            <option value="cancelled"  ${o.status==='cancelled'  ?'selected':''}>❌ Cancelled</option>
          </select>
        </td>
        <td style="font-size:.72rem;color:var(--muted);white-space:nowrap">${time}</td>
        <td><button class="btn btn-ghost btn-sm view-order-btn" data-order-id="${o.orderId}" style="white-space:nowrap">🔍 View</button></td>
      </tr>`;
  }

  function renderOrders() {
    const search = document.getElementById('orderSearch').value.toLowerCase();
    const status = document.getElementById('orderStatusFilter').value;
    const tbody  = document.getElementById('ordersBody');

    let list = allOrders.filter(o => {
      const matchSearch = !search || o.orderId.toLowerCase().includes(search) || o.fortniteUsername.toLowerCase().includes(search);
      const matchStatus = status === 'all' || o.status === status;
      return matchSearch && matchStatus;
    });

    tbody.innerHTML = list.length
      ? list.map(o => orderRow(o)).join('')
      : '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:2rem">No orders found</td></tr>';
    attachOrderStatusListeners(tbody);
  }

  function attachOrderStatusListeners(container) {
    container.querySelectorAll('.status-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        const id = sel.dataset.orderId;
        try {
          await api(`/api/admin/orders/${id}`, 'PUT', { status: sel.value });
          const order = allOrders.find(o => o.orderId === id);
          if (order) order.status = sel.value;
          toast('✅ Status updated');
          renderDashboard();
        } catch (e) { toast(e.message, 'error'); }
      });
      sel.addEventListener('click', e => e.stopPropagation());
    });

    // Reveal password toggle
    container.querySelectorAll('.reveal-pass').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const cell   = btn.closest('.pass-cell');
        const hidden = cell.querySelector('.pass-hidden');
        const pass   = cell.dataset.pass;
        if (hidden.textContent === '••••••••') {
          hidden.textContent = pass; hidden.style.color = 'var(--gold)'; btn.textContent = '🙈';
        } else {
          hidden.textContent = '••••••••'; hidden.style.color = ''; btn.textContent = '👁';
        }
      });
    });

    // Verify payment button
    container.querySelectorAll('.verify-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('Verify this payment and notify the buyer?')) return;
        try {
          await api(`/api/admin/orders/${btn.dataset.orderId}/verify`, 'POST');
          const order = allOrders.find(o => o.orderId === btn.dataset.orderId);
          if (order) { order.paymentStatus = 'verified'; order.status = 'delivering'; }
          toast('✅ Payment verified! Buyer & sender notified.');
          renderOrders(); renderDashboard();
          if (currentOrderId === btn.dataset.orderId) openOrderModal(btn.dataset.orderId);
        } catch (e) { toast(e.message, 'error'); }
      });
    });

    // Reject payment button
    container.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('Reject this payment? The buyer will be notified.')) return;
        try {
          await api(`/api/admin/orders/${btn.dataset.orderId}/reject`, 'POST');
          const order = allOrders.find(o => o.orderId === btn.dataset.orderId);
          if (order) { order.paymentStatus = 'rejected'; order.status = 'cancelled'; }
          toast('❌ Payment rejected. Buyer notified.', 'error');
          renderOrders(); renderDashboard();
        } catch (e) { toast(e.message, 'error'); }
      });
    });

    // Screenshot button
    container.querySelectorAll('.screenshot-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        await openScreenshotModal(btn.dataset.orderId);
      });
    });

    // View order button + row click
    container.querySelectorAll('.view-order-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); openOrderModal(btn.dataset.orderId); });
    });
    container.querySelectorAll('.order-row-clickable').forEach(row => {
      row.addEventListener('click', () => openOrderModal(row.dataset.orderId));
    });
  }

  // ── SCREENSHOT MODAL ──────────────────────────────────────────────────────
  let screenshotOrderId = null;

  async function openScreenshotModal(orderId) {
    screenshotOrderId = orderId;
    try {
      const data = await api(`/api/admin/orders/${orderId}/screenshot`);
      document.getElementById('screenshotImg').src = data.screenshot;
      const order = allOrders.find(o => o.orderId === orderId);
      document.getElementById('screenshotOrderInfo').textContent =
        order ? `Order ${orderId} — ${order.fortniteUsername} — ${order.totalEGP.toLocaleString()} EGP` : orderId;
      const canVerify = !order?.paymentStatus || order?.paymentStatus === 'awaiting_verification';
      document.getElementById('verifyFromScreenshotBtn').style.display = canVerify ? 'inline-flex' : 'none';
      document.getElementById('rejectFromScreenshotBtn').style.display = canVerify ? 'inline-flex' : 'none';
      document.getElementById('screenshotModal').classList.add('open');
    } catch(e) {
      toast('No screenshot uploaded for this order', 'error');
    }
  }

  document.getElementById('closeScreenshotModal').addEventListener('click', () => {
    document.getElementById('screenshotModal').classList.remove('open');
  });
  document.getElementById('screenshotModal').addEventListener('click', e => {
    if (e.target.id === 'screenshotModal') document.getElementById('screenshotModal').classList.remove('open');
  });
  document.getElementById('verifyFromScreenshotBtn').addEventListener('click', async () => {
    if (!screenshotOrderId || !confirm('Verify this payment?')) return;
    try {
      await api(`/api/admin/orders/${screenshotOrderId}/verify`, 'POST');
      const order = allOrders.find(o => o.orderId === screenshotOrderId);
      if (order) { order.paymentStatus = 'verified'; order.status = 'delivering'; }
      document.getElementById('screenshotModal').classList.remove('open');
      toast('✅ Payment verified! Buyer & sender notified.');
      renderOrders(); renderDashboard();
    } catch(e) { toast(e.message, 'error'); }
  });
  document.getElementById('rejectFromScreenshotBtn').addEventListener('click', async () => {
    if (!screenshotOrderId || !confirm('Reject this payment?')) return;
    try {
      await api(`/api/admin/orders/${screenshotOrderId}/reject`, 'POST');
      const order = allOrders.find(o => o.orderId === screenshotOrderId);
      if (order) { order.paymentStatus = 'rejected'; order.status = 'cancelled'; }
      document.getElementById('screenshotModal').classList.remove('open');
      toast('❌ Payment rejected.', 'error');
      renderOrders(); renderDashboard();
    } catch(e) { toast(e.message, 'error'); }
  });


  // ── ORDER DETAIL MODAL ─────────────────────────────────────────────────────
  let currentOrderId = null;

  function openOrderModal(orderId) {
    const o = allOrders.find(o => o.orderId === orderId);
    if (!o) return;
    currentOrderId = orderId;

    const time   = new Date(o.createdAt).toLocaleString('en-EG', { timeZone:'Africa/Cairo', hour:'2-digit', minute:'2-digit', day:'2-digit', month:'short', year:'numeric' });
    const method = o.paymentMethod === 'vodafone' ? '🔴 Vodafone Cash'
                 : o.paymentMethod === 'telda'    ? '🟣 Telda'
                 :                                  '🟢 InstaPay';

    // Header
    document.getElementById('omOrderId').textContent = o.orderId;
    document.getElementById('omTime').textContent    = time;

    // Status badge
    const badge = document.getElementById('omStatusBadge');
    const statusLabel = { pending:'⏳ Pending', delivering:'🚚 Delivering', delivered:'✅ Delivered', cancelled:'❌ Cancelled' };
    badge.textContent  = statusLabel[o.status] || o.status;
    badge.className    = `order-status-badge ${o.status}`;

    // Status buttons
    document.querySelectorAll('.status-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.val === o.status);
    });

    // Items list
    const itemsEl = document.getElementById('omItems');
    itemsEl.innerHTML = o.items.map(item => {
      const prod = allProducts.find(p => p.id === item.id);
      const img  = prod ? prod.img : `https://picsum.photos/seed/${item.id}/80/80`;
      return `
        <div class="order-item-row">
          <img class="order-item-img" src="${img}" alt="${item.name}" onerror="this.style.opacity='.2'"/>
          <span class="order-item-name">${item.name}</span>
          <span class="order-item-qty">×${item.qty}</span>
          <span class="order-item-price">${(item.priceEGP * item.qty).toLocaleString()} EGP</span>
        </div>`;
    }).join('');

    // Payment
    document.getElementById('omMethod').textContent  = method;
    document.getElementById('omTotal').textContent   = `${o.totalEGP.toLocaleString()} EGP`;
    document.getElementById('omTxRef').textContent   = o.txRef || '—';

    // Buyer info
    document.getElementById('omUsername').textContent = o.fortniteUsername || '—';

    const waLink = document.getElementById('omWaLink');
    waLink.textContent = o.buyerWhatsapp || '—';
    waLink.href        = o.buyerWhatsapp ? `https://wa.me/${o.buyerWhatsapp}` : '#';

    document.getElementById('omEmail').textContent = o.fortniteEmail || '—';

    const passText   = document.getElementById('omPassText');
    const revealBtn  = document.getElementById('omRevealPass');
    const passCell   = document.getElementById('omPassCell');
    if (o.fortnitePassword) {
      passCell.dataset.pass  = o.fortnitePassword;
      passText.textContent   = '••••••••';
      passText.style.color   = '';
      revealBtn.textContent  = '👁';
      revealBtn.style.display = 'inline-flex';
    } else {
      passText.textContent    = '—';
      revealBtn.style.display = 'none';
    }

    // Sender info
    const sender = o.assignedSender;
    document.getElementById('omSenderName').textContent  = sender ? sender.name     : '—';
    document.getElementById('omSenderPhone').textContent = sender ? sender.phone    : '—';
    const senderWaLink = document.getElementById('omSenderWaLink');
    senderWaLink.textContent = sender ? sender.whatsapp : '—';
    senderWaLink.href        = sender ? `https://wa.me/${sender.whatsapp}` : '#';

    document.getElementById('orderModal').classList.add('open');
  }

  function closeOrderModal() {
    document.getElementById('orderModal').classList.remove('open');
    currentOrderId = null;
  }

  // Status buttons inside modal
  document.getElementById('omStatusBtns').addEventListener('click', async e => {
    const btn = e.target.closest('.status-opt');
    if (!btn || !currentOrderId) return;
    const newStatus = btn.dataset.val;
    try {
      await api(`/api/admin/orders/${currentOrderId}`, 'PUT', { status: newStatus });
      const order = allOrders.find(o => o.orderId === currentOrderId);
      if (order) order.status = newStatus;
      // Update badge
      const badge = document.getElementById('omStatusBadge');
      const statusLabel = { pending:'⏳ Pending', delivering:'🚚 Delivering', delivered:'✅ Delivered', cancelled:'❌ Cancelled' };
      badge.textContent = statusLabel[newStatus];
      badge.className   = `order-status-badge ${newStatus}`;
      // Update buttons
      document.querySelectorAll('.status-opt').forEach(b => b.classList.toggle('active', b.dataset.val === newStatus));
      renderDashboard(); renderOrders();
      toast('✅ Status updated to: ' + statusLabel[newStatus]);
    } catch (e) { toast(e.message, 'error'); }
  });

  // Password reveal inside modal
  document.getElementById('omRevealPass').addEventListener('click', () => {
    const passText  = document.getElementById('omPassText');
    const passCell  = document.getElementById('omPassCell');
    const revealBtn = document.getElementById('omRevealPass');
    if (passText.textContent === '••••••••') {
      passText.textContent = passCell.dataset.pass;
      passText.style.color = 'var(--gold)';
      revealBtn.textContent = '🙈';
    } else {
      passText.textContent = '••••••••';
      passText.style.color = '';
      revealBtn.textContent = '👁';
    }
  });

  document.getElementById('closeOrderModal').addEventListener('click',    closeOrderModal);
  document.getElementById('closeOrderModalBtn').addEventListener('click', closeOrderModal);
  document.getElementById('orderModal').addEventListener('click', e => { if (e.target.id === 'orderModal') closeOrderModal(); });

  document.getElementById('orderSearch').addEventListener('input', renderOrders);
  document.getElementById('orderStatusFilter').addEventListener('change', renderOrders);

  // ── SENDERS ────────────────────────────────────────────────────────────────
  function renderSenders() {
    const tbody = document.getElementById('sendersBody');
    tbody.innerHTML = allSenders.map((s, i) => `
      <tr>
        <td><span style="font-family:var(--fh);font-size:1.1rem;font-weight:700;color:var(--accent)">#${i+1}</span></td>
        <td><strong>${s.name}</strong></td>
        <td><code style="color:var(--text)">${s.phone}</code></td>
        <td><code style="color:var(--green)">${s.whatsapp}</code></td>
        <td><code style="color:#ff6680">${s.vodafoneNumber || '—'}</code></td>
        <td><code style="color:#00d48a">${s.instapayNumber || '—'}</code></td>
        <td><code style="color:#a880ff">${s.teldaNumber    || '—'}</code></td>
        <td><code style="color:#a880ff">${s.teldaNumber    || '—'}</code></td>
        <td>${s.active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-red">Inactive</span>'}</td>
        <td><button class="btn btn-ghost btn-sm edit-sender-btn" data-id="${s.id}">✏️ Edit</button></td>
      </tr>`).join('');

    tbody.querySelectorAll('.edit-sender-btn').forEach(btn => {
      btn.addEventListener('click', () => openEditSender(+btn.dataset.id));
    });
  }

  document.getElementById('closeSenderModal').addEventListener('click',  () => document.getElementById('senderModal').classList.remove('open'));
  document.getElementById('cancelSenderModal').addEventListener('click', () => document.getElementById('senderModal').classList.remove('open'));

  function openEditSender(id) {
    const s = allSenders.find(s => s.id === id);
    if (!s) return;
    document.getElementById('editSenderId').value = s.id;
    document.getElementById('sName').value        = s.name;
    document.getElementById('sPhone').value       = s.phone;
    document.getElementById('sWhatsapp').value    = s.whatsapp;
    document.getElementById('sVodafone').value    = s.vodafoneNumber || '';
    document.getElementById('sInstapay').value    = s.instapayNumber || '';
    document.getElementById('sTelda').value       = s.teldaNumber    || '';
    document.getElementById('sActive').checked    = s.active;
    document.getElementById('senderModal').classList.add('open');
  }

  document.getElementById('saveSenderBtn').addEventListener('click', async () => {
    const id       = document.getElementById('editSenderId').value;
    if (!id) return;
    const name     = document.getElementById('sName').value.trim();
    const phone    = document.getElementById('sPhone').value.trim();
    const whatsapp = document.getElementById('sWhatsapp').value.trim();
    const vodafone = document.getElementById('sVodafone').value.trim();
    const instapay = document.getElementById('sInstapay').value.trim();
    const telda    = document.getElementById('sTelda').value.trim();
    const active   = document.getElementById('sActive').checked;
    if (!name || !phone || !whatsapp) { toast('Name, phone and WhatsApp are required', 'error'); return; }
    try {
      const data = await api(`/api/admin/senders/${id}`, 'PUT', { name, phone, whatsapp, vodafoneNumber: vodafone, instapayNumber: instapay, teldaNumber: telda, active });
      const idx  = allSenders.findIndex(s => s.id === +id);
      if (idx !== -1) allSenders[idx] = data.sender;
      document.getElementById('senderModal').classList.remove('open');
      renderSenders();
      toast('✅ Sender updated!');
    } catch (e) { toast(e.message, 'error'); }
  });

  // Close modals on overlay click
  ['productModal','senderModal'].forEach(id => {
    document.getElementById(id).addEventListener('click', e => { if (e.target.id === id) e.target.classList.remove('open'); });
  });

  // Keyboard ESC closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.getElementById('productModal').classList.remove('open');
      document.getElementById('senderModal').classList.remove('open');
    }
  });

  // ── SHOP SYNC PAGE ────────────────────────────────────────────────────────
  async function renderShopPage() {
    try {
      const data = await api('/api/admin/shop-settings');
      const s    = data.settings;
      document.getElementById('vbucksRateInput').value = s.vbucksRate;
      document.getElementById('autoSyncToggle').checked = s.autoSync;
      document.getElementById('shopRate').textContent   = s.vbucksRate + ' EGP';
      document.getElementById('shopLastSync').textContent = s.lastSyncTime
        ? new Date(s.lastSyncTime).toLocaleString('en-EG',{timeZone:'Africa/Cairo',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short',year:'numeric'})
        : 'Never';
      const shopItems = allProducts.filter(p => p.fromShop).length;
      document.getElementById('shopItemCount').textContent = shopItems;
    } catch(e) { toast('Failed to load shop settings', 'error'); }
  }

  document.getElementById('saveRateBtn').addEventListener('click', async () => {
    const rate = +document.getElementById('vbucksRateInput').value;
    if (!rate || rate <= 0) { toast('Enter a valid rate', 'error'); return; }
    const autoSync = document.getElementById('autoSyncToggle').checked;
    try {
      await api('/api/admin/shop-settings', 'PUT', { vbucksRate: rate, autoSync });
      // Refresh product list to reflect new prices
      const pd = await api('/api/admin/products');
      allProducts = pd.products;
      document.getElementById('shopRate').textContent = rate + ' EGP';
      toast('✅ Rate saved! All shop prices updated.');
      renderShopPage();
    } catch(e) { toast(e.message, 'error'); }
  });

  document.getElementById('autoSyncToggle').addEventListener('change', async () => {
    const autoSync = document.getElementById('autoSyncToggle').checked;
    await api('/api/admin/shop-settings', 'PUT', { autoSync }).catch(() => {});
  });

  document.getElementById('debugShopBtn').addEventListener('click', async () => {
    const btn = document.getElementById('debugShopBtn');
    const out = document.getElementById('debugOutput');
    btn.disabled = true; btn.textContent = '⏳ Checking…';
    out.style.display = 'block';
    out.textContent = 'Fetching from fortnite-api.com…';
    try {
      const result = await api('/api/admin/shop-debug');
      out.textContent = JSON.stringify(result, null, 2);
      if (result.error) out.style.color = 'var(--red)';
      else out.style.color = 'var(--green)';
    } catch(e) {
      out.textContent = '❌ ' + e.message;
      out.style.color = 'var(--red)';
    }
    btn.disabled = false; btn.textContent = '🔬 Debug API';
  });

  document.getElementById('syncNowBtn').addEventListener('click', async () => {
    const btn    = document.getElementById('syncNowBtn');
    const status = document.getElementById('syncStatus');
    btn.disabled = true; btn.textContent = '⏳ Syncing…'; status.textContent = '';
    try {
      const result = await api('/api/admin/sync-shop', 'POST');
      if (result.success) {
        status.textContent = `✅ Done! Added ${result.added} items, removed ${result.removed} old items.`;
        const pd = await api('/api/admin/products');
        allProducts = pd.products;
        renderShopPage();
        toast(`✅ Shop synced — ${result.added} items added`);
      } else {
        status.textContent = '❌ Sync failed: ' + result.error;
        toast('Sync failed: ' + result.error, 'error');
      }
    } catch(e) { status.textContent = '❌ ' + e.message; toast(e.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = '🔄 Sync Now'; }
  });

  // ── ADMIN VISIBILITY ─────────────────────────────────────────────────────
  async function loadVisibility() {
    try {
      const data = await api('/api/admin/visibility');
      const toggle  = document.getElementById('adminVisibleToggle');
      const badge   = document.getElementById('adminVisibleBadge');
      const warning = document.getElementById('adminVisibleWarning');
      const urlEl   = document.getElementById('adminSecretUrlDisplay');
      const input   = document.getElementById('adminSecretInput');
      if (!toggle) return;
      toggle.checked = data.visible;
      if (input) input.value = data.secret || '';
      updateVisibilityUI(data.visible, data.secret);
    } catch(e) { /* ignore if not on shop page yet */ }
  }

  function updateVisibilityUI(visible, secret) {
    const badge   = document.getElementById('adminVisibleBadge');
    const warning = document.getElementById('adminVisibleWarning');
    const urlEl   = document.getElementById('adminSecretUrlDisplay');
    if (!badge) return;
    if (visible) {
      badge.textContent = '✅ Visible';
      badge.className   = 'badge badge-green';
      if (warning) warning.style.display = 'none';
    } else {
      badge.textContent = '🔒 Hidden';
      badge.className   = 'badge badge-red';
      if (warning) {
        warning.style.display = 'block';
        const url = `${location.origin}/admin?secret=${encodeURIComponent(secret||'')}`;
        if (urlEl) urlEl.textContent = url;
      }
    }
  }

  const visToggle = document.getElementById('adminVisibleToggle');
  if (visToggle) {
    visToggle.addEventListener('change', async () => {
      const visible = visToggle.checked;
      const secret  = document.getElementById('adminSecretInput')?.value?.trim();
      if (!visible && !confirm('⚠️ This will HIDE the admin panel.\n\nMake sure you have the secret URL saved before hiding!\n\nContinue?')) {
        visToggle.checked = true; return;
      }
      try {
        const data = await api('/api/admin/visibility', 'PUT', { visible, secret });
        updateVisibilityUI(data.visible, data.secret);
        toast(data.visible ? '🔓 Admin panel is now VISIBLE' : '🔒 Admin panel is now HIDDEN. Save your secret URL!', data.visible ? 'success' : 'error');
      } catch(e) { toast(e.message, 'error'); visToggle.checked = !visible; }
    });
  }

  const saveSecretBtn = document.getElementById('saveSecretBtn');
  if (saveSecretBtn) {
    saveSecretBtn.addEventListener('click', async () => {
      const secret  = document.getElementById('adminSecretInput')?.value?.trim();
      const visible = document.getElementById('adminVisibleToggle')?.checked;
      if (!secret || secret.length < 4) { toast('Secret must be at least 4 characters', 'error'); return; }
      try {
        const data = await api('/api/admin/visibility', 'PUT', { visible, secret });
        updateVisibilityUI(data.visible, data.secret);
        toast('✅ Secret updated!');
      } catch(e) { toast(e.message, 'error'); }
    });
  }

  const copySecretUrlBtn = document.getElementById('copySecretUrlBtn');
  if (copySecretUrlBtn) {
    copySecretUrlBtn.addEventListener('click', async () => {
      try {
        const data = await api('/api/admin/visibility');
        const url  = `${location.origin}/admin?secret=${encodeURIComponent(data.secret||'')}`;
        await navigator.clipboard.writeText(url);
        toast('📋 Secret URL copied to clipboard!');
      } catch(e) { toast('Failed to copy', 'error'); }
    });
  }

  // ── SIDEBAR HIDE/SHOW ────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function() {
    const hideBtn = document.getElementById('hideSidebarBtn');
    const showBtn = document.getElementById('showSidebarBtn');
    const sidebar = document.getElementById('sidebar');
    if (!hideBtn || !sidebar) return;
    hideBtn.addEventListener('click', () => {
      sidebar.classList.add('collapsed');
      if (showBtn) showBtn.style.display = 'block';
    });
    if (showBtn) {
      showBtn.addEventListener('click', () => {
        sidebar.classList.remove('collapsed');
        showBtn.style.display = 'none';
      });
    }
  });

  // ── INIT ───────────────────────────────────────────────────────────────────
  checkAuth();
})();
