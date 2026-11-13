import http from 'http';
import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';

const PORT = process.env.PORT || 10000;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'blackgold_bingo';

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is missing!");
  process.exit(1);
}

let db;
let currentRoundActive = false;
let drawnNumbersList = [];

MongoClient.connect(MONGODB_URI)
  .then(client => {
    db = client.db(DB_NAME);
    console.log("Connected to MongoDB Atlas successfully");
  })
  .catch(err => console.error("MongoDB connection error:", err));

const activeTokens = new Map();

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parseBody = () => new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch(e) { resolve({}); }
    });
  });

  const getAuthUser = (req) => {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace('Bearer ', '').trim();
    return activeTokens.get(token) || null;
  };

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', storage: 'mongo' }));
    return;
  }

  // --- AUTH APIs ---
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    const { name, phone, pin } = await parseBody();
    if (!phone || !pin) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'ስልክ ቁጥር እና ፒን አስፈላጊ ናቸው' }));
      return;
    }
    try {
      const usersCol = db.collection('users');
      let user = await usersCol.findOne({ phone });
      if (user) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'ይህ ስልክ ቁጥር ተመዝግቧል' }));
        return;
      }
      const result = await usersCol.insertOne({ name: name || 'Player', phone, pin, balance: 0, createdAt: new Date() });
      const token = 'tok_' + Math.random().toString(36).substring(2) + Date.now();
      activeTokens.set(token, { userId: result.insertedId.toString(), phone });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token, message: 'ተመዝግቧል' }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'ሰርቨር ስህተት ተፈጥሯል' }));
    }
    return;
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const { phone, pin } = await parseBody();
    if (!phone || !pin) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'ስልክ ቁጥር እና ፒን አስፈላጊ ናቸው' }));
      return;
    }
    try {
      const usersCol = db.collection('users');
      let user = await usersCol.findOne({ phone });
      if (!user) {
        await usersCol.insertOne({ name: phone === '0978202822' ? 'Owner' : 'Player', phone, pin, balance: 0, createdAt: new Date() });
        user = await usersCol.findOne({ phone });
      }
      if (user.pin && user.pin !== pin) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'ልክ ያልሆነ ፒን ቁጥር' }));
        return;
      }
      const token = 'tok_' + Math.random().toString(36).substring(2) + Date.now();
      activeTokens.set(token, { userId: user._id.toString(), phone });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token, message: 'በተሳካ ሁኔታ ገብተዋል' }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'ሰርቨር ስህተት ተፈጥሯል' }));
    }
    return;
  }

  // --- WALLET API ---
  if (pathname === '/api/wallet' && req.method === 'GET') {
    const authUser = getAuthUser(req);
    if (!authUser) { res.writeHead(401); res.end(JSON.stringify({ message: 'እባክዎ ይግቡ' })); return; }
    try {
      const user = await db.collection('users').findOne({ _id: new ObjectId(authUser.userId) });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ balance: user ? user.balance || 0 : 0 }));
    } catch(e) { res.writeHead(500); res.end(JSON.stringify({ message: 'ሰርቨር ስህተት' })); }
    return;
  }

  // --- SECURE DEPOSIT API (NO CHAPA - DIRECT TXN ID CHECK) ---
  if (pathname === '/api/payments/deposit' && req.method === 'POST') {
    const authUser = getAuthUser(req);
    if (!authUser) { res.writeHead(401); res.end(JSON.stringify({ message: 'እባክዎ ይግቡ' })); return; }
    
    const { amount, method, txnId } = await parseBody();
    const depositAmount = Number(amount);
    const cleanTxnId = (txnId || '').trim();

    if (!depositAmount || depositAmount <= 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'እባክዎ ትክክለኛ የብር መጠን ያስገቡ' }));
      return;
    }

    if (!cleanTxnId || cleanTxnId.length < 4) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'እባክዎ ትክክለኛ የባንክ/ቴሌብር ሪፈረንስ ቁጥር (Txn ID) ያስገቡ' }));
      return;
    }

    try {
      const existingTxn = await db.collection('transactions').findOne({ txnId: cleanTxnId });
      if (existingTxn) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'ይህ የግብይት ቁጥር (Txn ID) ከዚህ በፊት ጥቅም ላይ ውሏል!' }));
        return;
      }

      await db.collection('transactions').insertOne({
        userId: authUser.userId,
        phone: authUser.phone,
        method: method || 'Telebirr/CBE',
        txnId: cleanTxnId,
        amount: depositAmount,
        status: 'approved',
        createdAt: new Date()
      });

      await db.collection('users').updateOne(
        { _id: new ObjectId(authUser.userId) },
        { $inc: { balance: depositAmount } }
      );

      const updatedUser = await db.collection('users').findOne({ _id: new ObjectId(authUser.userId) });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        message: 'ክፍያው ተረጋግጦ ቦርሳዎ በትክክል ተሞልቷል!', 
        newBalance: updatedUser.balance 
      }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'ሰርቨር ስህተት ተፈጥሯል' }));
    }
    return;
  }

  // --- GAME & CARDS APIs ---
  if (pathname === '/api/cards/buy' && req.method === 'POST') {
    const authUser = getAuthUser(req);
    if (!authUser) { res.writeHead(401); res.end(JSON.stringify({ message: 'እባክዎ ይግቡ' })); return; }
    const { count = 1 } = await parseBody();
    const cost = Number(count) * 10;
    try {
      const user = await db.collection('users').findOne({ _id: new ObjectId(authUser.userId) });
      if (!user || user.balance < cost) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'በቂ ቀሪ ሂሳብ የለዎትም (1 ካርድ = 10 ብር)' }));
        return;
      }
      await db.collection('users').updateOne({ _id: new ObjectId(authUser.userId) }, { $inc: { balance: -cost } });
      await db.collection('user_cards').insertOne({
        userId: authUser.userId,
        phone: authUser.phone,
        cardNumbers: Array.from({length: 25}, () => Math.floor(Math.random() * 75) + 1),
        createdAt: new Date()
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'ካርድ በተሳካ ሁኔታ ተገዝቷል!' }));
    } catch(e) { res.writeHead(500); res.end(JSON.stringify({ message: 'ሰርቨር ስህተት' })); }
    return;
  }

  if (pathname === '/api/cards' && req.method === 'GET') {
    const authUser = getAuthUser(req);
    if (!authUser) { res.writeHead(401); res.end(JSON.stringify({ message: 'እባክዎ ይግቡ' })); return; }
    try {
      const cards = await db.collection('user_cards').find({ userId: authUser.userId }).toArray();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ cards }));
    } catch(e) { res.writeHead(500); res.end(JSON.stringify({ message: 'ሰርቨር ስህተት' })); }
    return;
  }

  if (pathname === '/api/game/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ active: currentRoundActive, drawnNumbers: drawnNumbersList }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not_found', message: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Bingo API running on port ${PORT}`);
});
