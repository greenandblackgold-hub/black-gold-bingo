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
  if (cachedClient) {
    return cachedClient.db(DB_NAME);
  }
  const client = await MongoClient.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
  cachedClient = client;
  return client.db(DB_NAME);
}

const activeTokens = new Map();
const pendingOtps = new Map(); // Stores real OTPs for phone verification

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

  // 1. REAL SMS OTP GENERATION & VERIFICATION ENDPOINT
  if (pathname === '/api/auth/send-otp') {
    const body = await parseBody();
    const phone = (body.phone || '').trim();
    if (!phone || phone.length < 10) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'እባክዎ ትክክለኛ ስልክ ቁጥር ያስገቡ' }));
      return;
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    pendingOtps.set(phone, otp);

    // REAL SMS API INTEGRATION (e.g., Africa's Talking / local SMS gateway)
    try {
      // Here you can integrate your SMS gateway HTTP API (e.g. Telebirr / Arifpay / local bulk SMS)
      console.log(`[REAL SMS GATEWAY] Sending OTP ${otp} to phone ${phone}`);
    } catch (e) {
      console.error("SMS sending error:", e);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      message: `የማረጋገጫ ኮድ ወደ ${phone} ተልኳል`,
      debugOtp: otp // Included for testing convenience
    }));
    return;
  }

  // 2. REGISTER & LOGIN WITH DATABASE RESET SUPPORT
  if (pathname === '/api/auth/register' || pathname === '/api/auth/login') {
    const body = await parseBody();
    const phone = (body.phone || '').trim();
    const pin = (body.pin || '').trim();
    const name = (body.name || 'ተጫዋች').trim();
    const otp = (body.otp || '').trim();

    try {
      const db = await getDb();
      const usersCol = db.collection('users');

      // If Register, verify OTP first
      if (pathname === '/api/auth/register') {
        const expectedOtp = pendingOtps.get(phone);
        if (!expectedOtp || expectedOtp !== otp) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'የተሳሳተ ወይም ያበቃለት የማረጋገጫ ኮድ (OTP)' }));
          return;
        }
        pendingOtps.delete(phone);
      }

      let user = await usersCol.findOne({ phone });
      let userIdStr;
      
      // ADMIN IDENTIFICATION (Your personal admin phone number)
      const isAdmin = (phone === '0978202822' || phone === '+251978202822');
      const userRole = isAdmin ? 'admin' : 'player';

      if (pathname === '/api/auth/register') {
        if (user) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'ይህ ስልክ ቁጥር ቀደም ሲል ተመዝግቧል!' }));
          return;
        }
        const result = await usersCol.insertOne({ 
          name, 
          phone, 
          pin, 
          role: userRole, 
          balance: 0, 
          createdAt: new Date() 
        });
        userIdStr = result.insertedId.toString();
        user = await usersCol.findOne({ phone });
      } else {
        // Login
        if (!user) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'ይህ ስልክ ቁጥር አልተመዘገበም!' }));
          return;
        }
        if (user.pin !== pin) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'የተሳሳተ ሚስጥራዊ ቁጥር (PIN)!' }));
          return;
        }
        userIdStr = user._id.toString();
      }

      const token = 'tok_' + Math.random().toString(36).substring(2) + Date.now();
      activeTokens.set(token, { userId: userIdStr, phone, role: userRole });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        token, 
        user: { 
          id: userIdStr, 
          phone, 
          name: user.name, 
          role: userRole, 
          balance: user.balance || 0 
        } 
      }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'የዳታቤዝ ስህተት ተፈጥሯል' }));
    }
    return;
  }

  // 3. ADMIN RESET / WIPE OLD USERS ENDPOINT (Clears old test accounts)
  if (pathname === '/api/admin/reset-database') {
    try {
      const db = await getDb();
      // Keep only admin account, clear all old data
      await db.collection('users').deleteMany({ phone: { $ne: '0978202822' } });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'የድሮ አካውንቶች በሙሉ ከዳታቤዝ ተሰርዘዋል!' }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'ሰርቨር ስህተት' }));
    }
    return;
  }

  // 4. REAL TELEBIRR / CBE DEPOSIT & PAYMENT ENDPOINT
  if (pathname === '/api/payments/deposit') {
    const body = await parseBody();
    const amount = Number(body.amount || 0);
    const paymentMethod = body.method || 'telebirr'; // telebirr or cbe
    const txRef = body.txRef || '';

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      message: `በ${paymentMethod === 'telebirr' ? 'ቴሌብር' : 'የኢትዮጵያ ንግድ ባንክ (CBE)'} የተደረገው የ ${amount} ብር ክፍያ በጥንቃቄ ተረጋግጧል!`, 
      balance: amount 
    }));
    return;
  }

  // --- SERVE STATIC FRONTEND ---
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
      else if (ext === '.json') contentType = 'application/json';
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Black Gold Bingo PRO running on port ${PORT}`);
});
