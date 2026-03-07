// routes/api.js — MK Store full API
const https  = require('https');
const http   = require('http');
const crypto = require('crypto');
const store  = require('../data/store');

const ULTRAMSG = { instanceId:'instance163898', token:'lqpd96hpxg3m1wfp' };
const OWNER_WA = '201557454667';

// ── WHATSAPP ──────────────────────────────────────────────────────────────────
function sendWhatsAppTo(to, message) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ token:ULTRAMSG.token, to, body:message });
    const req  = https.request({
      hostname:'api.ultramsg.com', path:`/${ULTRAMSG.instanceId}/messages/chat`,
      method:'POST', headers:{ 'Content-Type':'application/json','Content-Length':Buffer.byteLength(body) },
    }, res => {
      let d=''; res.on('data',c=>d+=c);
      res.on('end',()=>{ try{const p=JSON.parse(d);(p.sent==='true'||p.sent===true)?resolve(p):reject(new Error(p.error));}catch(e){reject(e);} });
    });
    req.on('error',reject); req.write(body); req.end();
  });
}

function buildOwnerMsg(order) {
  const time   = new Date(order.createdAt).toLocaleString('en-EG',{timeZone:'Africa/Cairo',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short',year:'numeric'});
  const items  = order.items.map(i=>`  • ${i.name} ×${i.qty}  →  ${(i.priceEGP*i.qty).toLocaleString()} EGP`).join('\n');
  const method = order.paymentMethod==='vodafone'?'🔴 Vodafone Cash':order.paymentMethod==='telda'?'🟣 Telda':'🟢 InstaPay';
  const s      = order.assignedSender;
  return ['🎮 *NEW MK STORE ORDER!*','━━━━━━━━━━━━━━━━━━━━━',
    `📦 *Order ID:* ${order.orderId}`,`👤 *Player:*   ${order.fortniteUsername}`,
    `📱 *Buyer WA:* ${order.buyerWhatsapp||'—'}`,`💳 *Payment:*  ${method}`,
    '━━━━━━━━━━━━━━━━━━━━━',`🛒 *Items:*`,items,'━━━━━━━━━━━━━━━━━━━━━',
    `💰 *Total:* ${order.totalEGP.toLocaleString()} EGP`,`⏰ *Time:*  ${time}`,
    '━━━━━━━━━━━━━━━━━━━━━',
    s?`📲 *Assigned To:* ${s.name}\n📞 *Phone:* ${s.phone}\n💬 *WA:* ${s.whatsapp}`:'⚠️ No sender assigned',
    '━━━━━━━━━━━━━━━━━━━━━','⚡ *Deliver ASAP via Fortnite gifting!*'].join('\n');
}

// ── FORTNITE SHOP SYNC ────────────────────────────────────────────────────────
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers:{'User-Agent':'MKStore/1.0'} }, res => {
      let d=''; res.on('data',c=>d+=c);
      res.on('end',()=>{ try{resolve(JSON.parse(d));}catch(e){reject(new Error('JSON parse: '+e.message));} });
    });
    req.on('error',reject);
    req.setTimeout(15000,()=>{ req.destroy(); reject(new Error('Timeout')); });
  });
}

function rarityFrom(r) {
  if (!r) return 'rare';
  const map={common:'common',uncommon:'uncommon',rare:'rare',epic:'epic',legendary:'legendary',
    icon:'icon',marvel:'marvel',dc:'dc',dark:'dark',frozen:'frozen',lava:'lava',
    shadow:'shadow',gaminglegends:'gaminglegends',gaming_legends:'gaminglegends'};
  return map[r.toLowerCase().replace(/[\s_]/g,'')] || 'rare';
}

function categoryFrom(typeBackend, typeDisplay) {
  const b = (typeBackend  || '').toLowerCase();
  const d = (typeDisplay  || '').toLowerCase();
  if (b.includes('character') || d.includes('outfit'))                               return 'Outfits';
  if (b.includes('dance') || d.includes('emote') || d.includes('spray') || d.includes('toy')) return 'Emotes';
  if (b.includes('pickaxe') || d.includes('pickaxe') || d.includes('harvesting'))    return 'Pickaxes';
  if (b.includes('glider') || d.includes('glider'))                                  return 'Gliders';
  if (b.includes('wrap') || d.includes('wrap'))                                      return 'Wraps';
  if (b.includes('bundle') || d.includes('bundle'))                                  return 'Bundles';
  return 'Outfits';
}

async function syncFortniteShop() {
  console.log('🔄 Syncing Fortnite Item Shop…');
  try {
    const data = await fetchJSON('https://fortnite-api.com/v2/shop?language=en');
    if (!data.data) throw new Error('No data in API response. Status: ' + data.status);

    const d = data.data;
    let entries = [];

    // Shape A: flat entries array (new API format — 200+ entries)
    if (Array.isArray(d.entries) && d.entries.length > 0) {
      entries = d.entries;
      console.log('📦 Shape A — flat entries:', entries.length);
    } else {
      // Shape B — featured + daily + specials
      for (const key of ['featured','daily','specialFeatured','specialDaily','votes','voteWinners']) {
        if (d[key]?.entries?.length) { entries = entries.concat(d[key].entries); }
      }
      // Shape C — sections array
      if (!entries.length && Array.isArray(d.sections)) {
        for (const section of d.sections) {
          if (Array.isArray(section.entries)) entries = entries.concat(section.entries);
        }
      }
    }

    if (!entries.length) throw new Error('No entries found. Keys: ' + Object.keys(d).join(', '));
    console.log(`📊 Total entries: ${entries.length}`);

    const rate     = store.shopSettings.vbucksRate; // 0.15 EGP per V-Buck
    const oldCount = store.products.filter(p => p.fromShop).length;

    // Remove old shop items
    for (let i = store.products.length - 1; i >= 0; i--) {
      if (store.products[i].fromShop) store.products.splice(i, 1);
    }

    let added = 0;
    const seen = new Set();

    for (const entry of entries) {
      const vbucks = entry.finalPrice || entry.regularPrice || 0;
      if (!vbucks) continue;

      // NEW API uses brItems, OLD API uses items — support both
      const brItems = entry.brItems || entry.items || [];
      if (!brItems.length) continue;

      const isBundle = brItems.length > 1;

      if (isBundle) {
        const name = entry.bundle?.name
          || entry.devName?.replace(/^[A-Z]+\./,'')
          || brItems.map(i => i.name || i.displayName || '').filter(Boolean).join(' + ')
          || 'Bundle';
        if (!name || seen.has(name)) continue;
        seen.add(name);

        const first = brItems[0];
        const img   =
          entry.newDisplayAsset?.renderings?.[0]?.image ||
          entry.bundle?.image ||
          first.images?.featured ||
          first.images?.icon    ||
          first.images?.smallIcon || '';

        store.products.push({
          id: store.getNextProductId(),
          category: 'Bundles',
          rarity:   rarityFrom(first.rarity?.backendValue || first.rarity?.value || first.rarity?.displayValue || ''),
          name, priceEGP: Math.ceil(vbucks * rate), vbucksPrice: vbucks,
          amount: `${vbucks.toLocaleString()} V-Bucks`, badge: null, popular: false,
          description: `Bundle — ${brItems.length} items. Available in the Fortnite Item Shop.`,
          img, active: true, fromShop: true,
          giftable: entry.giftable || false, refundable: entry.refundable || false,
          section: entry.layout?.name || entry.layoutId || 'Shop',
          shopEntryId: entry.offerId || entry.id || null,
        });
        added++;

      } else {
        const brItem = brItems[0];
        const name   = brItem.name || brItem.displayName || entry.devName?.replace(/^[A-Z]+\./,'') || '';
        if (!name || seen.has(name)) continue;
        seen.add(name);

        const img =
          entry.newDisplayAsset?.renderings?.[0]?.image ||
          brItem.images?.featured ||
          brItem.images?.icon     ||
          brItem.images?.smallIcon ||
          brItem.images?.background ||
          (brItem.keyImages?.find(k=>k.type==='SmallIcon'))?.url || '';

        const category = categoryFrom(
          brItem.type?.backendValue || brItem.type?.value || '',
          brItem.type?.displayValue || ''
        );
        const rarity = rarityFrom(
          brItem.rarity?.backendValue || brItem.rarity?.value || brItem.rarity?.displayValue || ''
        );

        store.products.push({
          id: store.getNextProductId(),
          category, rarity, name,
          priceEGP: Math.ceil(vbucks * rate), vbucksPrice: vbucks,
          amount:  `${vbucks.toLocaleString()} V-Bucks`,
          badge:   rarity==='legendary'?'LEGENDARY':rarity==='icon'?'ICON SERIES':null,
          popular: rarity==='legendary'||rarity==='icon'||rarity==='marvel'||rarity==='dc',
          description: brItem.description || brItem.shortDescription || `${brItem.type?.displayValue||'Item'} available in the Fortnite Item Shop.`,
          img, active: true, fromShop: true,
          giftable: entry.giftable||false, refundable: entry.refundable||false,
          section: entry.layout?.name || entry.layoutId || 'Shop',
          shopEntryId: entry.offerId || entry.id || null,
        });
        added++;
      }
    }

    store.shopSettings.lastSyncTime = new Date().toISOString();
    console.log(`✅ Sync done — removed ${oldCount}, added ${added} items (rate: 1 V-Buck = ${rate} EGP)`);
    return { success:true, added, removed:oldCount, time:store.shopSettings.lastSyncTime };

  } catch(err) {
    console.error('❌ Shop sync failed:', err.message);
    return { success:false, error:err.message };
  }
}

function scheduleDailySync() {
  function msUntilMidnight() {
    const now   = new Date();
    const cairo = new Date(now.toLocaleString('en-US',{timeZone:'Africa/Cairo'}));
    const next  = new Date(cairo); next.setHours(24,0,5,0);
    return Math.max(next-cairo, 1000);
  }
  setTimeout(async()=>{
    if (store.shopSettings.autoSync) await syncFortniteShop();
    scheduleDailySync();
  }, msUntilMidnight());
  console.log(`⏰ Next auto-sync in ${Math.round(msUntilMidnight()/3600000)}h`);
}

setTimeout(()=>syncFortniteShop(), 3000);
scheduleDailySync();

// ── HELPERS ───────────────────────────────────────────────────────────────────
function genToken() { return crypto.randomBytes(32).toString('hex'); }
function genId()    { return Math.random().toString(36).slice(2).toUpperCase()+Date.now().toString(36).toUpperCase(); }
function json(res,status,data,extra) {
  res.writeHead(status,{'Content-Type':'application/json',...(extra||{})});
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise((resolve,reject)=>{
    let b=''; req.on('data',c=>b+=c);
    req.on('end',()=>{ try{resolve(b?JSON.parse(b):{});}catch(e){reject(e);} });
    req.on('error',reject);
  });
}
function getSessionId(req){ const m=(req.headers.cookie||'').match(/mkSessionId=([^;]+)/); return m?m[1]:null; }
function getAdminToken(req){ const m=(req.headers.cookie||'').match(/mkAdminToken=([^;]+)/); return m?m[1]:null; }
function isAdmin(req){
  const t=getAdminToken(req); if(!t) return false;
  const s=store.adminSessions[t]; if(!s) return false;
  if(Date.now()-s.createdAt>86400000){delete store.adminSessions[t];return false;}
  return true;
}

// ── MAIN HANDLER ──────────────────────────────────────────────────────────────
async function handleAPI(req,res,pathname) {
  let sessionId=getSessionId(req); let isNew=false;
  if(!sessionId){sessionId=genId();isNew=true;}
  if(!store.carts[sessionId]) store.carts[sessionId]=[];
  const ck=isNew?{'Set-Cookie':`mkSessionId=${sessionId}; Path=/; HttpOnly; SameSite=Strict`}:{};

  if (req.method==='GET'&&pathname==='/api/products') {
    const url=new URL(req.url,'http://localhost');
    const cat=url.searchParams.get('category')||'All';
    const search=(url.searchParams.get('search')||'').toLowerCase();
    const sort=url.searchParams.get('sort')||'default';
    let list=store.products.filter(p=>{
      if(!p.active) return false;
      return (cat==='All'||p.category===cat)&&(!search||p.name.toLowerCase().includes(search)||p.description.toLowerCase().includes(search));
    });
    if(sort==='price-asc')  list=[...list].sort((a,b)=>a.priceEGP-b.priceEGP);
    if(sort==='price-desc') list=[...list].sort((a,b)=>b.priceEGP-a.priceEGP);
    if(sort==='popular')    list=[...list].sort((a,b)=>(b.popular?1:0)-(a.popular?1:0));
    res.writeHead(200,{'Content-Type':'application/json',...ck});
    res.end(JSON.stringify({products:list,categories:store.CATEGORIES,rarity:store.RARITY,lastSync:store.shopSettings.lastSyncTime}));
    return;
  }

  if (req.method==='GET'&&pathname==='/api/payment-methods') {
    const active=store.senders.filter(s=>s.active);
    const next=active.length?active[store.senderIndex%active.length]:null;
    const methods=store.PAYMENT_METHODS.map(m=>({
      ...m,
      number:next?(m.id==='vodafone'?next.vodafoneNumber:m.id==='telda'?next.teldaNumber:next.instapayNumber):'—',
    }));
    res.writeHead(200,{'Content-Type':'application/json',...ck});
    res.end(JSON.stringify({methods})); return;
  }

  if (req.method==='GET'&&pathname==='/api/cart') {
    const cart=store.carts[sessionId];
    const total=cart.reduce((s,i)=>s+i.priceEGP*i.qty,0);
    res.writeHead(200,{'Content-Type':'application/json',...ck});
    res.end(JSON.stringify({cart,total:+total.toFixed(0),count:cart.reduce((s,i)=>s+i.qty,0)})); return;
  }

  if (req.method==='POST'&&pathname==='/api/cart/add') {
    const body=await readBody(req);
    const product=store.products.find(p=>p.id===+body.id&&p.active);
    if(!product) return json(res,404,{error:'Product not found'});
    const cart=store.carts[sessionId];
    const ex=cart.find(i=>i.id===product.id);
    if(ex){ex.qty++;}else{cart.push({...product,qty:1});}
    const total=cart.reduce((s,i)=>s+i.priceEGP*i.qty,0);
    res.writeHead(200,{'Content-Type':'application/json',...ck});
    res.end(JSON.stringify({cart,total:+total.toFixed(0),count:cart.reduce((s,i)=>s+i.qty,0)})); return;
  }

  if (req.method==='POST'&&pathname==='/api/cart/remove') {
    const body=await readBody(req);
    store.carts[sessionId]=store.carts[sessionId].filter(i=>i.id!==+body.id);
    const cart=store.carts[sessionId];
    const total=cart.reduce((s,i)=>s+i.priceEGP*i.qty,0);
    res.writeHead(200,{'Content-Type':'application/json',...ck});
    res.end(JSON.stringify({cart,total:+total.toFixed(0),count:cart.reduce((s,i)=>s+i.qty,0)})); return;
  }

  if (req.method==='POST'&&pathname==='/api/cart/checkout') {
    const body=await readBody(req);
    const cart=store.carts[sessionId];
    if(!cart.length)                                                  return json(res,400,{error:'Cart is empty'});
    if(!body.paymentMethod)                                           return json(res,400,{error:'Payment method required'});
    if(!body.fortniteUsername||body.fortniteUsername.trim().length<2) return json(res,400,{error:'Fortnite username required'});
    if(!body.buyerWhatsapp||body.buyerWhatsapp.trim().length<8)       return json(res,400,{error:'WhatsApp number required'});
    if(!body.screenshot||body.screenshot.length<100)                  return json(res,400,{error:'Payment screenshot required'});

    const totalEGP=cart.reduce((s,i)=>s+i.priceEGP*i.qty,0);
    const orderId='MK-'+Date.now().toString(36).toUpperCase();
    const sender=store.getNextSender();
    let buyerWa=body.buyerWhatsapp.trim().replace(/\s+/g,'');
    if(buyerWa.startsWith('0')) buyerWa='2'+buyerWa;

    const order={
      orderId, items:cart.map(i=>({id:i.id,name:i.name,qty:i.qty,priceEGP:i.priceEGP})),
      totalEGP:+totalEGP.toFixed(0), paymentMethod:body.paymentMethod,
      fortniteUsername:body.fortniteUsername.trim(),
      fortniteEmail:body.fortniteEmail||null, fortnitePassword:body.fortnitePassword||null,
      buyerWhatsapp:buyerWa, assignedSender:sender,
      status:'pending', paymentStatus:'awaiting_verification', createdAt:new Date().toISOString(),
    };
    store.orders[orderId]=order; store.carts[sessionId]=[];
    if(body.screenshot) store.screenshots[orderId]=body.screenshot;

    res.writeHead(200,{'Content-Type':'application/json',...ck});
    res.end(JSON.stringify({success:true,orderId,totalEGP:order.totalEGP,
      assignedSender:sender?{name:sender.name,phone:sender.phone,whatsapp:sender.whatsapp}:null}));

    const ownerMsg=buildOwnerMsg(order);
    const buyerMsg=['🎮 *MK Store — Order Received!*','━━━━━━━━━━━━━━━━━━━━━',
      `📦 *Order ID:* ${orderId}`,`💰 *Total:* ${order.totalEGP.toLocaleString()} EGP`,
      '━━━━━━━━━━━━━━━━━━━━━','⏳ Your payment screenshot is being reviewed.',
      'You will receive a WhatsApp confirmation once verified.',
      sender?`\n📲 Your sender: *${sender.name}* (${sender.phone})`:'',
      '━━━━━━━━━━━━━━━━━━━━━','🙏 Thank you for shopping at MK Store!'].join('\n');

    sendWhatsAppTo(OWNER_WA,ownerMsg).catch(e=>console.error('Owner WA:',e.message));
    if(sender) sendWhatsAppTo(sender.whatsapp,ownerMsg).catch(e=>console.error('Sender WA:',e.message));
    sendWhatsAppTo(buyerWa,buyerMsg).catch(e=>console.error('Buyer WA:',e.message));
    return;
  }

  // ── ADMIN AUTH ────────────────────────────────────────────────────────────
  if (req.method==='POST'&&pathname==='/api/admin/login') {
    const body=await readBody(req);
    const admin=store.ADMINS.find(a=>a.username===body.username&&a.password===body.password);
    if(!admin) return json(res,401,{error:'Invalid username or password'});
    const token=genToken();
    store.adminSessions[token]={username:admin.username,createdAt:Date.now()};
    res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':`mkAdminToken=${token}; Path=/; HttpOnly; SameSite=Strict`});
    res.end(JSON.stringify({success:true,username:admin.username})); return;
  }
  if (req.method==='POST'&&pathname==='/api/admin/logout') {
    const t=getAdminToken(req); if(t) delete store.adminSessions[t];
    res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':'mkAdminToken=; Path=/; Max-Age=0'});
    res.end(JSON.stringify({success:true})); return;
  }
  if (req.method==='GET'&&pathname==='/api/admin/me') {
    if(!isAdmin(req)) return json(res,401,{error:'Not authenticated'});
    return json(res,200,{username:store.adminSessions[getAdminToken(req)].username});
  }
  if(pathname.startsWith('/api/admin/')&&!isAdmin(req)) return json(res,401,{error:'Unauthorized'});

  // ── ADMIN PRODUCTS ────────────────────────────────────────────────────────
  if (req.method==='GET'&&pathname==='/api/admin/products')
    return json(res,200,{products:store.products,rarity:store.RARITY,categories:store.CATEGORIES});

  if (req.method==='POST'&&pathname==='/api/admin/products') {
    const body=await readBody(req);
    if(!body.name||!body.priceEGP||!body.category) return json(res,400,{error:'name, priceEGP and category required'});
    const p={id:store.getNextProductId(),category:body.category,rarity:body.rarity||'common',
      name:body.name.trim(),priceEGP:+body.priceEGP,amount:body.amount||null,badge:body.badge||null,
      popular:body.popular||false,description:body.description||'',active:true,fromShop:false,
      img:body.img||`https://picsum.photos/seed/${Date.now()}/400/300`};
    store.products.push(p);
    return json(res,200,{success:true,product:p});
  }

  if (req.method==='PUT'&&pathname.startsWith('/api/admin/products/')) {
    const id=+pathname.split('/').pop();
    const idx=store.products.findIndex(p=>p.id===id);
    if(idx===-1) return json(res,404,{error:'Product not found'});
    const body=await readBody(req);
    ['name','priceEGP','category','rarity','description','amount','badge','popular','img','active'].forEach(k=>{if(body[k]!==undefined) store.products[idx][k]=body[k];});
    return json(res,200,{success:true,product:store.products[idx]});
  }

  if (req.method==='DELETE'&&pathname.startsWith('/api/admin/products/')) {
    const id=+pathname.split('/').pop();
    const idx=store.products.findIndex(p=>p.id===id);
    if(idx===-1) return json(res,404,{error:'Product not found'});
    store.products.splice(idx,1);
    return json(res,200,{success:true});
  }

  // ── ADMIN SHOP SYNC ───────────────────────────────────────────────────────
  if (req.method==='POST'&&pathname==='/api/admin/sync-shop') {
    const result=await syncFortniteShop();
    return json(res,200,result);
  }

  if (req.method==='GET'&&pathname==='/api/admin/shop-debug') {
    try {
      const data = await fetchJSON('https://fortnite-api.com/v2/shop?language=en');
      const d = data.data || {};
      const allEntries = d.entries || d.featured?.entries || d.daily?.entries || [];
      const first = allEntries[0] || null;
      return json(res,200,{
        status: data.status, topLevelKeys: Object.keys(data), dataKeys: Object.keys(d),
        entriesCount: d.entries?.length||0, featuredCount: d.featured?.entries?.length||0,
        dailyCount: d.daily?.entries?.length||0,
        firstEntry: first?{
          keys: Object.keys(first), finalPrice: first.finalPrice,
          hasBrItems: Array.isArray(first.brItems), hasItems: Array.isArray(first.items),
          brItemsCount: first.brItems?.length||0, itemsCount: first.items?.length||0,
          firstItemName: (first.brItems?.[0]||first.items?.[0])?.name||null,
        }:null,
        currentRate: store.shopSettings.vbucksRate,
        productsInShop: store.products.filter(p=>p.fromShop).length,
        lastSync: store.shopSettings.lastSyncTime,
      });
    } catch(err) { return json(res,200,{error:err.message}); }
  }

  if (req.method==='GET'&&pathname==='/api/admin/shop-settings')
    return json(res,200,{settings:store.shopSettings});

  if (req.method==='PUT'&&pathname==='/api/admin/shop-settings') {
    const body=await readBody(req);
    if(body.vbucksRate!==undefined) {
      store.shopSettings.vbucksRate=+body.vbucksRate;
      store.products.forEach(p=>{ if(p.fromShop&&p.vbucksPrice) p.priceEGP=Math.ceil(p.vbucksPrice*store.shopSettings.vbucksRate); });
    }
    if(body.autoSync!==undefined) store.shopSettings.autoSync=!!body.autoSync;
    return json(res,200,{success:true,settings:store.shopSettings});
  }

  // ── ADMIN VISIBILITY ──────────────────────────────────────────────────────
  if (req.method==='GET'&&pathname==='/api/admin/visibility')
    return json(res,200,{visible:store.shopSettings.adminVisible,secret:store.shopSettings.adminSecret});

  if (req.method==='PUT'&&pathname==='/api/admin/visibility') {
    const body=await readBody(req);
    if(body.visible!==undefined) store.shopSettings.adminVisible=!!body.visible;
    if(body.secret&&body.secret.trim().length>3) store.shopSettings.adminSecret=body.secret.trim();
    console.log(`${store.shopSettings.adminVisible?'🔓':'🔒'} Admin panel is now ${store.shopSettings.adminVisible?'VISIBLE':'HIDDEN'}`);
    return json(res,200,{success:true,visible:store.shopSettings.adminVisible,secret:store.shopSettings.adminSecret});
  }

  // ── ADMIN ORDERS ──────────────────────────────────────────────────────────
  if (req.method==='GET'&&pathname==='/api/admin/orders') {
    const list=Object.values(store.orders).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    return json(res,200,{orders:list});
  }

  if (req.method==='PUT'&&pathname.startsWith('/api/admin/orders/')&&!pathname.includes('/verify')&&!pathname.includes('/reject')&&!pathname.includes('/screenshot')) {
    const id=pathname.split('/').pop(); const order=store.orders[id];
    if(!order) return json(res,404,{error:'Order not found'});
    const body=await readBody(req);
    if(body.status) order.status=body.status;
    if(body.paymentStatus) order.paymentStatus=body.paymentStatus;
    return json(res,200,{success:true,order});
  }

  if (req.method==='GET'&&pathname.startsWith('/api/admin/orders/')&&pathname.endsWith('/screenshot')) {
    const id=pathname.split('/')[4]; const img=store.screenshots[id];
    if(!img) return json(res,404,{error:'No screenshot'});
    return json(res,200,{screenshot:img});
  }

  if (req.method==='POST'&&pathname.startsWith('/api/admin/orders/')&&pathname.endsWith('/verify')) {
    const id=pathname.split('/')[4]; const order=store.orders[id];
    if(!order) return json(res,404,{error:'Order not found'});
    order.paymentStatus='verified'; order.status='delivering'; order.verifiedAt=new Date().toISOString();
    res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({success:true,order}));
    const s=order.assignedSender;
    const buyerMsg=['✅ *MK Store — Payment Verified!*','━━━━━━━━━━━━━━━━━━━━━',
      `📦 *Order ID:* ${order.orderId}`,`💰 *Total:* ${order.totalEGP.toLocaleString()} EGP`,
      '━━━━━━━━━━━━━━━━━━━━━','🎉 *Your payment is confirmed!*','Your items will be gifted shortly.',
      s?`\n📲 *Your sender:*\n👤 ${s.name}\n📞 ${s.phone}\n💬 ${s.whatsapp}`:'',
      '━━━━━━━━━━━━━━━━━━━━━','🙏 Thank you for shopping at MK Store!'].join('\n');
    const senderMsg=['📦 *Deliver This Order!*','━━━━━━━━━━━━━━━━━━━━━',
      `Order: *${order.orderId}*`,`Player: *${order.fortniteUsername}*`,
      `Items: ${order.items.map(i=>`${i.name} ×${i.qty}`).join(', ')}`,
      `Total: *${order.totalEGP.toLocaleString()} EGP*`,
      order.fortniteEmail?`\n📧 Email: ${order.fortniteEmail}`:'',
      order.fortnitePassword?`🔑 Password: ${order.fortnitePassword}`:'',
      '━━━━━━━━━━━━━━━━━━━━━','⚡ *Gift via Fortnite ASAP!*'].join('\n');
    if(order.buyerWhatsapp) sendWhatsAppTo(order.buyerWhatsapp,buyerMsg).catch(e=>console.error(e.message));
    if(s) sendWhatsAppTo(s.whatsapp,senderMsg).catch(e=>console.error(e.message));
    return;
  }

  if (req.method==='POST'&&pathname.startsWith('/api/admin/orders/')&&pathname.endsWith('/reject')) {
    const id=pathname.split('/')[4]; const order=store.orders[id];
    if(!order) return json(res,404,{error:'Order not found'});
    order.paymentStatus='rejected'; order.status='cancelled'; order.rejectedAt=new Date().toISOString();
    res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({success:true,order}));
    const buyerMsg=['❌ *MK Store — Payment Issue*','━━━━━━━━━━━━━━━━━━━━━',
      `📦 *Order ID:* ${order.orderId}`,
      '⚠️ We could not verify your payment screenshot.',
      'Please contact us or place a new order with correct payment proof.',
      '━━━━━━━━━━━━━━━━━━━━━','📞 Contact us on WhatsApp for help.'].join('\n');
    if(order.buyerWhatsapp) sendWhatsAppTo(order.buyerWhatsapp,buyerMsg).catch(e=>console.error(e.message));
    return;
  }

  // ── ADMIN SENDERS ─────────────────────────────────────────────────────────
  if (req.method==='GET'&&pathname==='/api/admin/senders')
    return json(res,200,{senders:store.senders});

  if (req.method==='PUT'&&pathname.startsWith('/api/admin/senders/')) {
    const id=+pathname.split('/').pop();
    const sender=store.senders.find(s=>s.id===id);
    if(!sender) return json(res,404,{error:'Sender not found'});
    const body=await readBody(req);
    ['name','phone','whatsapp','vodafoneNumber','instapayNumber','teldaNumber','active'].forEach(k=>{if(body[k]!==undefined) sender[k]=body[k];});
    return json(res,200,{success:true,sender});
  }

  // ── ADMIN CATEGORIES ─────────────────────────────────────────────────────
  if (req.method==='GET'&&pathname==='/api/admin/categories')
    return json(res,200,{categories:store.CATEGORIES.filter(c=>c!=='All')});

  if (req.method==='POST'&&pathname==='/api/admin/categories') {
    const body=await readBody(req);
    const name=(body.name||'').trim();
    if(!name||name.length<2) return json(res,400,{error:'Category name must be at least 2 characters'});
    if(store.CATEGORIES.includes(name)) return json(res,400,{error:'Category already exists'});
    store.CATEGORIES.push(name);
    return json(res,200,{success:true,categories:store.CATEGORIES.filter(c=>c!=='All')});
  }

  if (req.method==='DELETE'&&pathname.startsWith('/api/admin/categories/')) {
    const name=decodeURIComponent(pathname.split('/api/admin/categories/')[1]);
    const protected_=['All','V-Bucks','Outfits','Emotes','Pickaxes','Gliders','Wraps','Bundles','Battle Pass'];
    if(protected_.includes(name)) return json(res,400,{error:'Cannot delete a default category'});
    store.CATEGORIES=store.CATEGORIES.filter(c=>c!==name);
    return json(res,200,{success:true,categories:store.CATEGORIES.filter(c=>c!=='All')});
  }

  if (req.method==='PUT'&&pathname.startsWith('/api/admin/categories/')) {
    const oldName=decodeURIComponent(pathname.split('/api/admin/categories/')[1]);
    const body=await readBody(req);
    const newName=(body.name||'').trim();
    const protected_=['All','V-Bucks','Outfits','Emotes','Pickaxes','Gliders','Wraps','Bundles','Battle Pass'];
    if(protected_.includes(oldName)) return json(res,400,{error:'Cannot rename a default category'});
    if(!newName||newName.length<2) return json(res,400,{error:'Name must be at least 2 characters'});
    if(store.CATEGORIES.includes(newName)) return json(res,400,{error:'Category already exists'});
    const idx=store.CATEGORIES.indexOf(oldName);
    if(idx===-1) return json(res,404,{error:'Category not found'});
    store.CATEGORIES[idx]=newName;
    // Rename on all products too
    store.products.forEach(p=>{ if(p.category===oldName) p.category=newName; });
    return json(res,200,{success:true,categories:store.CATEGORIES.filter(c=>c!=='All')});
  }

  json(res,404,{error:'Not found'});
}

module.exports = { handleAPI };
