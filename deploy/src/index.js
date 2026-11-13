import http from 'http';
import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      res.end(JSON.stringify({ error: 'bad_request', message: 'ስልክ ቁጥር እና ፒን አስፈላጊ ናቸው' }));
      return;
    }
    try {
      const usersCol = db.collection('users');
      let user = await usersCol.findOne({ phone });
      if (user) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'exists', message: 'ይህ ስልክ ቁጥር ተመዝግቧል' }));
        return;
      }
      const result = await usersCol.insertOne({ 
        name: name || 'Player', 
        phone, 
        pin, 
        role: phone === '0978202822' ? 'admin' : 'player', 
        balance: 0, 
        createdAt: new Date() 
      });
      const token = 'tok_' + Math.random().toString(36).substring(2) + Date.now();
      const userIdStr = result.insertedId.toString();
      activeTokens.set(token, { userId: userIdStr, phone });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        token, 
        user: { id: userIdStr, phone, name: name || 'Player', role: phone === '0978202822' ? 'admin' : 'player', balance: 0 } 
      }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'server_error', message: 'ሰርቨር ስህተት ተፈጥሯል' }));
    }
    return;
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const { phone, pin } = await parseBody();
    if (!phone || !pin) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'bad_request', message: 'ስልክ ቁጥር እና ፒን አስፈላጊ ናቸው' }));
      return;
    }
    try {
      const usersCol = db.collection('users');
      let user = await usersCol.findOne({ phone });
      if (!user) {
        const isAdmin = phone === '0978202822';
        await usersCol.insertOne({ 
          name: isAdmin ? 'Owner' : 'Player', 
          phone, 
          pin, 
          role: isAdmin ? 'admin' : 'player', 
          balance: 0, 
          createdAt: new Date() 
        });
        user = await usersCol.findOne({ phone });
      }
      if (user.pin && user.pin !== pin) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_pin', message: 'ልክ ያልሆነ ፒን ቁጥር' }));
        return;
      }
      const token = 'tok_' + Math.random().toString(36).substring(2) + Date.now();
      const userIdStr = user._id.toString();
      activeTokens.set(token, { userId: userIdStr, phone });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        token, 
        user: { id: userIdStr, phone, name: user.name, role: user.role || 'player', balance: user.balance || 0 } 
      }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'server_error', message: 'ሰርቨር ስህተት ተፈጥሯል' }));
    }
    return;
  }

  // --- WALLET API ---
  if (pathname === '/api/wallet' && req.method === 'GET') {
    const authUser = getAuthUser(req);
    if (!authUser) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'unauthorized', message: 'እባክዎ ይግቡ' })); return; }
    try {
      const user = await db.collection('users').findOne({ _id: new ObjectId(authUser.userId) });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ balance: user ? user.balance || 0 : 0 }));
    } catch(e) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'error', message: 'ሰርቨር ስህተት' })); }
    return;
  }

  // --- SECURE DEPOSIT API (DIRECT TXN ID CHECK) ---
  if (pathname === '/api/payments/deposit' && req.method === 'POST') {
    const authUser = getAuthUser(req);
    if (!authUser) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'unauthorized', message: 'እባክዎ ይግቡ' })); return; }
    
    const { amount, method, txnId } = await parseBody();
    const depositAmount = Number(amount);
    const cleanTxnId = (txnId || '').trim();

    if (!depositAmount || depositAmount <= 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'bad_amount', message: 'እባክዎ ትክክለኛ የብር መጠን ያስገቡ' }));
      return;
    }

    if (!cleanTxnId || cleanTxnId.length < 4) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'bad_txn', message: 'እባክዎ ትክክለኛ የባንክ/ቴሌብር ሪፈረንስ ቁጥር (Txn ID) ያስገቡ' }));
      return;
    }

    try {
      const existingTxn = await db.collection('transactions').findOne({ txnId: cleanTxnId });
      if (existingTxn) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'duplicate_txn', message: 'ይህ የግብይት ቁጥር (Txn ID) ከዚህ በፊት ጥቅም ላይ ውሏል!' }));
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
        balance: updatedUser.balance 
      }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'server_error', message: 'ሰርቨር ስህተት ተፈጥሯል' }));
    }
    return;
  }

  // --- SERVE FRONTEND STATIC FILES ---
  const publicDir = path.join(__dirname, '../public');
  let filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      fs.readFile(path.join(publicDir, 'index.html'), (err2, homeContent) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'not_found', message: 'Page not found' }));
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(homeContent);
        }
      });
    } else {
      let ext = path.extname(filePath);
      let contentType = 'text/html';
      if (ext === '.js') contentType = 'application/javascript';
      else if (ext === '.css') contentType = 'text/css';
      else if (ext === '.json') contentType = 'application/json';
      else if (ext === '.svg') contentType = 'image/svg+xml';
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Bingo API & Web running on port ${PORT}`);
});
