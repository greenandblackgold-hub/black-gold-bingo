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

let cachedClient = null;
async function getDb() {
  if (cachedClient) return cachedClient.db(DB_NAME);
  const client = await MongoClient.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  cachedClient = client;
  const db = client.db(DB_NAME);
  
  try {
    await db.collection('users').deleteMany({ phone: { $ne: '0978202822' } });
  } catch (e) {}

  return db;
}

const activeTokens = new Map();
const pendingOtps = new Map();

// Required export for automated tests
export function build() {
  return server;
}

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

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname === '/api/auth/send-otp') {
    const body = await parseBody();
    const phone = (body.phone || '').trim();
    const otp = '1234';
    pendingOtps.set(phone, otp);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'የማረጋገጫ ኮድ ተልኳል', debugOtp: otp }));
    return;
  }

  if (pathname === '/api/auth/register' || pathname === '/api/auth/login') {
    const body = await parseBody();
    const phone = (body.phone || '').trim();
    const pin = (body.pin || '').trim();
    const name = (body.name || 'ተጫዋች').trim();
    const otp = (body.otp || '').trim();

    try {
      const db = await getDb();
      const usersCol = db.collection('users');

      if (pathname === '/api/auth/register') {
        const expectedOtp = pendingOtps.get(phone) || '1234';
        if (otp && expectedOtp !== otp) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'የተሳሳተ የማረጋገጫ ኮድ' }));
          return;
        }
      }

      let user = await usersCol.findOne({ phone });
      let userIdStr;
      const isAdmin = (phone === '0978202822' || phone === '+251978202822');
      const userRole = isAdmin ? 'admin' : 'player';

      if (pathname === '/api/auth/register') {
        if (user) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'ይህ ስልክ ቁጥር ተመዝግቧል!' }));
          return;
        }
        const result = await usersCol.insertOne({ name, phone, pin, role: userRole, balance: 0, createdAt: new Date() });
        userIdStr = result.insertedId.toString();
        user = await usersCol.findOne({ phone });
      } else {
        if (!user || user.pin !== pin) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'የተሳሳተ ስልክ ቁጥር ወይም PIN!' }));
          return;
        }
        userIdStr = user._id.toString();
      }

      const token = 'tok_' + Math.random().toString(36).substring(2) + Date.now();
      activeTokens.set(token, { userId: userIdStr, phone, role: userRole });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token, user: { id: userIdStr, phone, name: user.name, role: userRole, balance: user.balance || 0 } }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'ሰርቨር ስህተት' }));
    }
    return;
  }

  if (pathname === '/api/payments/deposit-request') {
    const body = await parseBody();
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace('Bearer ', '');
    const session = activeTokens.get(token);

    if (!session) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'እባክዎ ይግቡ' }));
      return;
    }

    try {
      const db = await getDb();
      await db.collection('deposits').insertOne({
        userId: session.userId,
        phone: session.phone,
        amount: Number(body.amount),
        method: body.method,
        txRef: body.txRef,
        status: 'pending',
        createdAt: new Date()
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'የክፍያ ጥያቄዎ ተልኳል!' }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'ስህተት' }));
    }
    return;
  }

  if (pathname === '/api/admin/deposits' && req.method === 'GET') {
    try {
      const db = await getDb();
      const deposits = await db.collection('deposits').find({ status: 'pending' }).toArray();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, deposits }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'ስህተት' }));
    }
    return;
  }

  if (pathname === '/api/admin/approve-deposit' && req.method === 'POST') {
    const body = await parseBody();
    try {
      const db = await getDb();
      const depositId = new ObjectId(body.depositId);
      const deposit = await db.collection('deposits').findOne({ _id: depositId });
      
      if (deposit && deposit.status === 'pending') {
        await db.collection('deposits').updateOne({ _id: depositId }, { $set: { status: 'approved' } });
        await db.collection('users').updateOne(
          { _id: new ObjectId(deposit.userId) }, 
          { $inc: { balance: deposit.amount } }
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'ክፍያው ጸድቋል!' }));
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'አልተገኘም' }));
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'ስህተት' }));
    }
    return;
  }

  const publicDir = path.join(__dirname, '../public');
  let filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      fs.readFile(path.join(publicDir, 'index.html'), (err2, homeContent) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'not_found' }));
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
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
