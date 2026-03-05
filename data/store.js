// data/store.js

const RARITY = {
  common:        { label:'Common',          color:'#b0b0b0' },
  uncommon:      { label:'Uncommon',        color:'#1eff00' },
  rare:          { label:'Rare',            color:'#0070dd' },
  epic:          { label:'Epic',            color:'#a335ee' },
  legendary:     { label:'Legendary',       color:'#ff8000' },
  icon:          { label:'Icon',            color:'#00d4ff' },
  marvel:        { label:'Marvel',          color:'#ed1d24' },
  dc:            { label:'DC',              color:'#0074f0' },
  dark:          { label:'Dark',            color:'#8b0000' },
  frozen:        { label:'Frozen',          color:'#88eeff' },
  lava:          { label:'Lava',            color:'#ff4400' },
  shadow:        { label:'Shadow',          color:'#666688' },
  gaminglegends: { label:'Gaming Legends',  color:'#00ff88' },
};

const CATEGORIES = ['All','V-Bucks','Outfits','Emotes','Pickaxes','Gliders','Wraps','Bundles','Battle Pass'];

const ADMINS = [
  { username:'admin', password:'mkstore2024' },
  { username:'moaz',  password:'moaz1234'    },
];

const PAYMENT_METHODS = [
  { id:'vodafone', name:'Vodafone Cash', color:'#e60028', instruction:'Send the exact total to this Vodafone Cash number, then upload your payment screenshot.' },
  { id:'instapay', name:'InstaPay',      color:'#00a86b', instruction:'Transfer the exact total via InstaPay to this number, then upload your payment screenshot.' },
  { id:'telda',    name:'Telda',         color:'#6c3fff', instruction:'Send the exact total via Telda to this number, then upload your payment screenshot.' },
];

const shopSettings = {
  vbucksRate:   0.15,
  lastSyncTime: null,
  autoSync:     true,
  adminVisible: true,   // when false → /admin returns 404
  adminSecret:  'mkadmin2024', // secret URL suffix to re-enable: /admin?secret=mkadmin2024
};

const senders = [
  { id:1, name:'Sender 1', phone:'01000000001', whatsapp:'201000000001', vodafoneNumber:'01000000001', instapayNumber:'01000000001', teldaNumber:'01000000001', active:true },
  { id:2, name:'Sender 2', phone:'01000000002', whatsapp:'201000000002', vodafoneNumber:'01000000002', instapayNumber:'01000000002', teldaNumber:'01000000002', active:true },
  { id:3, name:'Sender 3', phone:'01000000003', whatsapp:'201000000003', vodafoneNumber:'01000000003', instapayNumber:'01000000003', teldaNumber:'01000000003', active:true },
];
let senderIndex = 0;
function getNextSender() {
  const active = senders.filter(s=>s.active);
  if (!active.length) return null;
  const s = active[senderIndex % active.length];
  senderIndex++;
  return s;
}

let nextProductId = 100;
const products = [
  { id:1, category:'V-Bucks', rarity:'common',    name:'1,000 V-Bucks',  priceEGP:150,  amount:'1,000',  badge:null,          popular:false, description:'Spend on the Item Shop.',     img:'https://picsum.photos/seed/vb1000/400/300',  active:true, fromShop:false },
  { id:2, category:'V-Bucks', rarity:'rare',      name:'2,800 V-Bucks',  priceEGP:420,  amount:'2,800',  badge:'POPULAR',     popular:true,  description:'More V-Bucks for more items.', img:'https://picsum.photos/seed/vb2800/400/300',  active:true, fromShop:false },
  { id:3, category:'V-Bucks', rarity:'epic',      name:'5,000 V-Bucks',  priceEGP:750,  amount:'5,000',  badge:'BEST VALUE',  popular:false, description:'Best value bundle.',           img:'https://picsum.photos/seed/vb5000/400/300',  active:true, fromShop:false },
  { id:4, category:'V-Bucks', rarity:'legendary', name:'13,500 V-Bucks', priceEGP:2025, amount:'13,500', badge:'MEGA PACK',   popular:false, description:'Mega V-Bucks pack.',           img:'https://picsum.photos/seed/vb13500/400/300', active:true, fromShop:false },
  { id:5, category:'Battle Pass', rarity:'legendary', name:'Chapter 5 Battle Pass', priceEGP:140, amount:'100 Tiers', badge:'SEASON', popular:true, description:'100 tiers of rewards.', img:'https://picsum.photos/seed/bp5/400/300', active:true, fromShop:false },
];

const orders      = {};
const adminSessions = {};
const carts       = {};
const screenshots = {};  // orderId → base64 data URL

module.exports = {
  RARITY, CATEGORIES, ADMINS, PAYMENT_METHODS, shopSettings,
  products, senders, orders, carts, adminSessions, screenshots,
  getNextSender,
  getNextProductId: () => nextProductId++,
  get senderIndex() { return senderIndex; },
};
