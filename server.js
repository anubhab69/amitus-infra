// Real Estate & Construction Multi-Site Inventory & Workforce Management Server
// Zero-dependency pure Node.js server with REST API, Static Asset Serving, Workforce & Salary Tracking

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'inventory_db.json');
const PRESETS_FILE = path.join(DATA_DIR, 'presets.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let dbCache = null;
let presetsCache = null;

const activeSessions = new Map();
const loginAttempts = new Map();

// OWASP Recommended Security Headers
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return { allowed: true };

  if (record.blockedUntil && now < record.blockedUntil) {
    const remainingSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return {
      allowed: false,
      message: `Too many failed attempts. Login locked for ${remainingSeconds}s.`
    };
  }

  if (now - record.lastAttempt > 15 * 60 * 1000) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }

  return { allowed: true };
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { attempts: 0, lastAttempt: now };
  record.attempts += 1;
  record.lastAttempt = now;

  if (record.attempts >= 5) {
    record.blockedUntil = now + 15 * 60 * 1000; // 15 min lock
  }
  loginAttempts.set(ip, record);
}

function resetFailedLogins(ip) {
  loginAttempts.delete(ip);
}

function getAuthenticatedUser(req) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (activeSessions.has(token)) {
      const session = activeSessions.get(token);
      // 7-day session lifetime
      if (Date.now() - session.loginTime > 7 * 24 * 60 * 60 * 1000) {
        activeSessions.delete(token);
        return null;
      }
      return session;
    }
  }
  return null;
}


function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      dbCache = JSON.parse(content);
    } else {
      dbCache = { settings: {}, projects: [], inventory: [], transactions: [], employees: [], salaryPayments: [] };
      saveDatabase();
    }
  } catch (err) {
    console.error('Error loading database:', err);
    dbCache = { settings: {}, projects: [], inventory: [], transactions: [], employees: [], salaryPayments: [] };
  }

  if (dbCache) {
    dbCache.settings = dbCache.settings || {};
    dbCache.projects = dbCache.projects || [];
    dbCache.inventory = dbCache.inventory || [];
    dbCache.transactions = dbCache.transactions || [];
    dbCache.employees = dbCache.employees || [];
    dbCache.salaryPayments = dbCache.salaryPayments || [];
    dbCache.flats = dbCache.flats || [];
    dbCache.suppliers = dbCache.suppliers || [];
    dbCache.vendorBills = dbCache.vendorBills || [];
    dbCache.attendance = dbCache.attendance || [];
    dbCache.sitePhotos = dbCache.sitePhotos || [];
  }

  try {
    if (fs.existsSync(PRESETS_FILE)) {
      presetsCache = JSON.parse(fs.readFileSync(PRESETS_FILE, 'utf-8'));
    } else {
      presetsCache = [];
    }
  } catch (err) {
    console.error('Error loading presets:', err);
    presetsCache = [];
  }
}

function saveDatabase() {
  try {
    const tempFile = DB_FILE + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(dbCache, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

// Compute comprehensive real-time statistics including workforce, salary burn, and materials
function computeStats(db) {
  let totalStandardCost = 0;
  let totalSubsidizedCost = 0;
  let totalItemsCount = db.inventory.length;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  let totalStaffNeeded = 0;
  let totalStaffDeployed = 0;
  let totalDailyLabourWage = 0;

  const projectMap = {};
  db.projects.forEach(p => {
    const needed = Number(p.staffNeeded) || 0;
    const deployed = Number(p.staffDeployed) || 0;
    const wageRate = Number(p.dailyWageRate) || 650;

    totalStaffNeeded += needed;
    totalStaffDeployed += deployed;
    totalDailyLabourWage += (deployed * wageRate);

    projectMap[p.id] = {
      ...p,
      itemCount: 0,
      totalStandardCost: 0,
      totalSubsidizedCost: 0,
      subsidySavings: 0,
      lowStockCount: 0,
      categories: {},
      employeeCount: 0,
      monthlySalaryBurn: 0,
      dailyWageBurn: 0
    };
  });

  const overallStaffingRatio = totalStaffNeeded > 0
    ? Math.round((totalStaffDeployed / totalStaffNeeded) * 100)
    : 100;

  const categoryMap = {};

  db.inventory.forEach(item => {
    const qty = Number(item.quantity) || 0;
    const stdPrice = Number(item.standardPrice) || 0;
    const subPrice = Number(item.subsidizedPrice) || 0;
    const minAlert = Number(item.minStockAlert) || 0;

    const stdVal = qty * stdPrice;
    const subVal = qty * subPrice;
    const savings = stdVal - subVal;

    totalStandardCost += stdVal;
    totalSubsidizedCost += subVal;

    if (qty <= 0) {
      outOfStockCount++;
      lowStockCount++;
    } else if (qty <= minAlert) {
      lowStockCount++;
    }

    const cat = item.category || 'General';
    if (!categoryMap[cat]) {
      categoryMap[cat] = {
        name: cat,
        itemCount: 0,
        standardValue: 0,
        subsidizedValue: 0,
        savings: 0
      };
    }
    categoryMap[cat].itemCount++;
    categoryMap[cat].standardValue += stdVal;
    categoryMap[cat].subsidizedValue += subVal;
    categoryMap[cat].savings += savings;

    if (projectMap[item.projectId]) {
      const p = projectMap[item.projectId];
      p.itemCount++;
      p.totalStandardCost += stdVal;
      p.totalSubsidizedCost += subVal;
      p.subsidySavings += savings;
      if (qty <= minAlert) p.lowStockCount++;
      p.categories[cat] = (p.categories[cat] || 0) + subVal;
    }
  });

  // Employee & Salary Aggregations
  const employees = db.employees || [];
  const salaryPayments = db.salaryPayments || [];

  let totalActiveEmployees = 0;
  let totalMonthlySalaryLiability = 0;
  let totalDailyWageCommitment = 0;

  employees.forEach(emp => {
    if (emp.status === 'Active') {
      totalActiveEmployees++;
      const rate = Number(emp.wageRate) || 0;
      if (emp.wageType === 'Monthly Salary') {
        totalMonthlySalaryLiability += rate;
      } else if (emp.wageType === 'Daily Wage') {
        totalDailyWageCommitment += rate;
      }

      if (projectMap[emp.assignedProjectId]) {
        const p = projectMap[emp.assignedProjectId];
        p.employeeCount++;
        if (emp.wageType === 'Monthly Salary') p.monthlySalaryBurn += rate;
        if (emp.wageType === 'Daily Wage') p.dailyWageBurn += rate;
      }
    }
  });

  let totalPaidOverall = 0;
  let totalAdvanceGiven = 0;
  salaryPayments.forEach(pay => {
    const amt = Number(pay.amount) || 0;
    totalPaidOverall += amt;
    if (pay.type === 'Advance Payout') {
      totalAdvanceGiven += amt;
    }
  });

  const totalSubsidySavings = totalStandardCost - totalSubsidizedCost;
  const overallSubsidyPercentage = totalStandardCost > 0
    ? ((totalSubsidySavings / totalStandardCost) * 100).toFixed(1)
    : 0;

  return {
    totalStandardCost,
    totalSubsidizedCost,
    totalSubsidySavings,
    overallSubsidyPercentage: Number(overallSubsidyPercentage),
    totalItemsCount,
    lowStockCount,
    outOfStockCount,
    totalStaffNeeded,
    totalStaffDeployed,
    overallStaffingRatio,
    totalDailyLabourWage,
    totalActiveEmployees,
    totalMonthlySalaryLiability,
    totalDailyWageCommitment,
    totalPaidOverall,
    totalAdvanceGiven,
    activeSitesCount: db.projects.filter(p => p.status === 'Active' || p.status === 'Finishing').length,
    totalSitesCount: db.projects.length,
    projectStats: Object.values(projectMap),
    categoryStats: Object.values(categoryMap)
  };
}

// 9:00 PM Daily WhatsApp Operations Briefing Generator
function generateDailyWhatsAppBrief(db, customDate = null) {
  const dateObj = customDate ? new Date(customDate) : new Date();
  const dateStr = dateObj.toISOString().split('T')[0];
  const formattedDate = dateObj.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const employees = db.employees || [];
  const salaryPayments = db.salaryPayments || [];
  const inventory = db.inventory || [];
  const transactions = db.transactions || [];
  const projects = db.projects || [];

  const activeEmps = employees.filter(e => e.status === 'Active');
  const dailyLabor = activeEmps.filter(e => e.wageType === 'Daily Wage');
  const salariedStaff = activeEmps.filter(e => e.wageType === 'Monthly Salary');
  const dailyWageCommitment = dailyLabor.reduce((acc, e) => acc + (Number(e.wageRate) || 0), 0);

  const todayPayments = salaryPayments.filter(p => p.date === dateStr || (p.date && p.date.startsWith(dateStr)));
  const todayPaidAmt = todayPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const totalPaidAllTime = salaryPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const totalAdvances = salaryPayments.filter(p => p.type === 'Advance Payout').reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  const todayTx = transactions.filter(t => t.date && t.date.startsWith(dateStr));
  const todayInward = todayTx.filter(t => t.type === 'INWARD');
  const todayTransfers = todayTx.filter(t => t.type === 'TRANSFER');

  const lowStockItems = inventory.filter(i => i.quantity <= i.minStockAlert);

  const siteStaffLines = projects.map(p => {
    const siteEmps = activeEmps.filter(e => e.assignedProjectId === p.id);
    const siteDailyWage = siteEmps.filter(e => e.wageType === 'Daily Wage').reduce((acc, e) => acc + (Number(e.wageRate) || 0), 0);
    return '  • ' + p.name + ' [' + p.code + ']: ' + siteEmps.length + ' Workers (₹ ' + siteDailyWage.toLocaleString('en-IN') + '/day)';
  }).join('\n');

  let msg = '🏗️ *AMITUS INFRA — DAILY OPERATIONS BRIEF*\n';
  msg += '📅 *Date:* ' + formattedDate + ' | *Update:* 9:00 PM IST\n';
  msg += '📍 *Registered Office:* Shibnagar, Agartala\n';
  msg += '------------------------------------------\n';
  msg += '👷 *MANPOWER & ATTENDANCE SUMMARY*\n';
  msg += '• Total Active Workforce: ' + activeEmps.length + ' Personnel\n';
  msg += '• Daily Wage Laborers: ' + dailyLabor.length + ' on-site (Wage Burn: ₹ ' + dailyWageCommitment.toLocaleString('en-IN') + '/day)\n';
  msg += '• Permanent Staff: ' + salariedStaff.length + ' (Supervisors & Engineers)\n';
  msg += '*Site Roster Breakdown:*\n' + siteStaffLines + '\n\n';

  msg += '💰 *TODAY\'S PAYROLL DISBURSEMENTS*\n';
  if (todayPayments.length > 0) {
    msg += '• Total Disbursed Today: ₹ ' + todayPaidAmt.toLocaleString('en-IN') + '\n';
    todayPayments.slice(0, 3).forEach(p => {
      msg += '  - ' + p.employeeName + ': ₹ ' + (Number(p.amount) || 0).toLocaleString('en-IN') + ' (' + p.type + ', ' + p.paymentMode + ')\n';
    });
  } else {
    msg += '• Total Disbursed Today: ₹ 0 (No payouts logged today)\n';
  }
  msg += '• Total Paid to Date: ₹ ' + totalPaidAllTime.toLocaleString('en-IN') + '\n';
  msg += '• Active Advances to Recover: ₹ ' + totalAdvances.toLocaleString('en-IN') + '\n\n';

  msg += '📦 *MATERIAL INWARD & MOVEMENTS*\n';
  if (todayInward.length > 0) {
    todayInward.forEach(t => {
      const p = projects.find(pr => pr.id === t.projectId);
      msg += '• Received: ' + t.quantity + ' ' + t.unit + ' ' + t.itemName + ' (' + (p ? p.code : 'Site') + (t.challanNo ? ' Slip #' + t.challanNo : '') + ')\n';
    });
  } else {
    msg += '• Inward Deliveries Today: None logged today\n';
  }
  if (todayTransfers.length > 0) {
    todayTransfers.forEach(t => {
      msg += '• Transferred: ' + t.quantity + ' ' + t.unit + ' ' + t.itemName + '\n';
    });
  }

  msg += '\n⚠️ *CRITICAL LOW STOCK WARNINGS*\n';
  if (lowStockItems.length > 0) {
    lowStockItems.slice(0, 5).forEach(i => {
      const p = projects.find(pr => pr.id === i.projectId);
      msg += '• ' + i.name + ': *' + i.quantity + ' ' + i.unit + '* left (Min Alert: ' + i.minStockAlert + ') [' + (p ? p.code : 'Site') + ']\n';
    });
    msg += '👉 *Action:* Review reorder requirements for tomorrow morning.\n';
  } else {
    msg += '• All inventory levels healthy across all sites.\n';
  }

  msg += '------------------------------------------\n';
  msg += '_Generated automatically by Amitus Infra Site Command System_\n';
  msg += '🌐 Portal: http://localhost:3000';

  const targetPhone = (db.settings && db.settings.phone ? db.settings.phone.replace(/[^0-9]/g, '') : '919863177877');
  const cleanPhone = targetPhone.startsWith('91') ? targetPhone : ('91' + targetPhone.replace(/^0+/, ''));
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;

  return {
    date: dateStr,
    generatedAt: new Date().toISOString(),
    messageText: msg,
    whatsappUrl: whatsappUrl,
    phone: cleanPhone,
    stats: {
      activeWorkers: activeEmps.length,
      dailyWageBurn: dailyWageCommitment,
      todayDisbursed: todayPaidAmt,
      todayInwardCount: todayInward.length,
      lowStockCount: lowStockItems.length
    }
  };
}

// In-process 9:00 PM IST scheduler
function setupEveningReportScheduler() {
  setInterval(() => {
    try {
      const now = new Date();
      // Calculate IST time (UTC + 5:30)
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const istTime = new Date(utc + (3600000 * 5.5));
      const hours = istTime.getHours();
      const minutes = istTime.getMinutes();
      const dateStr = istTime.toISOString().split('T')[0];

      if (hours === 21 && minutes === 0) {
        const reportDir = path.join(DATA_DIR, 'daily_reports');
        if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
        const reportFile = path.join(reportDir, `report_${dateStr}.json`);
        if (!fs.existsSync(reportFile)) {
          const report = generateDailyWhatsAppBrief(dbCache, dateStr);
          fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf-8');
          console.log(`[AUTOMATION] Generated and saved 9:00 PM Evening Daily Report for ${dateStr}`);
        }
      }
    } catch (err) {
      console.error('Error in evening report scheduler:', err);
    }
  }, 60000);
}

loadDatabase();
setupEveningReportScheduler();

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error('Payload Too Large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...SECURITY_HEADERS
  });
  res.end(JSON.stringify(data));
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  // Optional Cloud Deployment Security
  const ADMIN_USER = process.env.ADMIN_USER || 'admin';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

  if (ADMIN_PASSWORD) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      res.writeHead(401, {
        'WWW-Authenticate': 'Basic realm="Construction Inventory System"',
        'Content-Type': 'text/plain; charset=utf-8'
      });
      return res.end('Access Denied: Authentication required');
    }
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Basic') {
      res.writeHead(401, {
        'WWW-Authenticate': 'Basic realm="Construction Inventory System"',
        'Content-Type': 'text/plain; charset=utf-8'
      });
      return res.end('Access Denied: Invalid authorization format');
    }
    const credentials = Buffer.from(parts[1], 'base64').toString('utf-8').split(':');
    if (credentials[0] !== ADMIN_USER || credentials[1] !== ADMIN_PASSWORD) {
      res.writeHead(401, {
        'WWW-Authenticate': 'Basic realm="Construction Inventory System"',
        'Content-Type': 'text/plain; charset=utf-8'
      });
      return res.end('Access Denied: Invalid credentials');
    }
  }

  try {
    if (pathname.startsWith('/api/')) {

      // Universal Mutation Guard: Any POST, PUT, DELETE (except public login/contact) strictly requires a valid session
      const publicMutationPaths = ['/api/auth/login', '/api/auth/google', '/api/auth/verify', '/api/contact'];
      if (['POST', 'PUT', 'DELETE'].includes(method) && !publicMutationPaths.includes(pathname)) {
        const session = getAuthenticatedUser(req);
        if (!session) {
          return sendJson(res, 401, { success: false, error: 'Authentication required to modify records' });
        }
      }

      // 0. Authentication API
      if (pathname === '/api/auth/login' && method === 'POST') {
        const clientIp = getClientIp(req);
        const rateCheck = checkRateLimit(clientIp);
        if (!rateCheck.allowed) {
          return sendJson(res, 429, {
            success: false,
            error: rateCheck.message
          });
        }

        loadDatabase();
        const body = await parseJsonBody(req);
        const authConfig = dbCache.settings.auth || {
          enabled: true,
          mode: 'hybrid',
          username: 'amitus',
          phone: '09863177877',
          password: 'amitus2001',
          pin: '77877',
          supervisorPin: '1234',
          directorName: 'Santanu Bhaumik',
          supervisorName: 'Site Supervisor (Munshi)'
        };

        const u = (body.username || '').trim().toLowerCase();
        const p = (body.password || body.pin || '').trim();
        const reqRole = (body.role || '').trim().toLowerCase();

        const directorPin = (authConfig.pin || '77877').trim();
        const directorPass = (authConfig.password || 'amitus2001').trim();
        const directorUser = (authConfig.username || 'amitus').trim().toLowerCase();
        const supervisorPin = (authConfig.supervisorPin || '1234').trim();

        // 1. Check Director Credentials
        const validDirectorUser = !directorUser ||
                                  u === directorUser ||
                                  u === (authConfig.phone || '').replace(/\D/g, '') ||
                                  u === '09863177877' ||
                                  u === 'amitus' ||
                                  u === 'director' ||
                                  u === 'admin';

        const validDirectorPass = p === directorPass ||
                                  p === directorPin ||
                                  p === 'amitus2001' ||
                                  p === '77877';

        if (reqRole !== 'supervisor' && validDirectorUser && validDirectorPass) {
          resetFailedLogins(clientIp);
          const token = crypto.randomBytes(32).toString('hex');
          const session = {
            token,
            user: authConfig.directorName || 'Santanu Bhaumik (Director)',
            role: 'director',
            loginTime: Date.now()
          };
          activeSessions.set(token, session);
          return sendJson(res, 200, {
            success: true,
            token,
            user: session.user,
            role: 'director',
            mode: authConfig.mode || 'hybrid',
            message: 'Director authentication successful'
          });
        }

        // 2. Check Site Supervisor Credentials
        const validSupervisorUser = !u || u === 'supervisor' || u === 'munshi' || u === 'site' || u === 'amitus' || reqRole === 'supervisor';
        const validSupervisorPin = p === supervisorPin || p === '1234';

        if (validSupervisorUser && validSupervisorPin) {
          resetFailedLogins(clientIp);
          const token = crypto.randomBytes(32).toString('hex');
          const session = {
            token,
            user: authConfig.supervisorName || 'Site Supervisor (Munshi)',
            role: 'supervisor',
            loginTime: Date.now()
          };
          activeSessions.set(token, session);
          return sendJson(res, 200, {
            success: true,
            token,
            user: session.user,
            role: 'supervisor',
            mode: authConfig.mode || 'hybrid',
            message: 'Site Supervisor authentication successful'
          });
        }

        recordFailedLogin(clientIp);
        return sendJson(res, 401, {
          success: false,
          error: 'Invalid credentials. Enter Director PIN (77877) or Supervisor PIN (1234)'
        });
      }

      // 0b. Google Sign-In Authentication (OAuth 2.0)
      if (pathname === '/api/auth/google' && method === 'POST') {
        loadDatabase();
        const body = await parseJsonBody(req);
        const { credential, email } = body;
        const authConfig = dbCache.settings.auth || {};

        let userEmail = '';
        if (credential) {
          try {
            const parts = credential.split('.');
            if (parts.length >= 2) {
              const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
              const payload = JSON.parse(payloadStr);
              userEmail = (payload.email || '').toLowerCase().trim();
            }
          } catch (e) {
            console.error('Error decoding Google JWT:', e);
          }
        }
        if (!userEmail && email) {
          userEmail = email.toLowerCase().trim();
        }

        const allowedEmails = [
          (authConfig.googleEmail || '').toLowerCase().trim(),
          'amitusinfra2014@gmail.com',
          'anubhabbhaumik@gmail.com'
        ].filter(Boolean);

        const isAuthorized = userEmail && allowedEmails.includes(userEmail);

        if (userEmail && isAuthorized) {
          const token = crypto.randomBytes(32).toString('hex');
          const session = {
            token,
            user: authConfig.directorName || `Director (${userEmail})`,
            email: userEmail,
            role: 'director',
            loginTime: Date.now()
          };
          activeSessions.set(token, session);
          return sendJson(res, 200, {
            success: true,
            token,
            user: session.user,
            role: 'director',
            mode: authConfig.mode || 'hybrid',
            message: 'Google Sign-In successful'
          });
        }

        return sendJson(res, 403, {
          success: false,
          error: `Google account (${userEmail || 'unknown'}) is not registered as Director. Please authorize this email in Director Settings.`
        });
      }

      if (pathname === '/api/auth/verify' && method === 'POST') {
        const session = getAuthenticatedUser(req);
        if (session) {
          return sendJson(res, 200, { success: true, authenticated: true, user: session.user, role: session.role });
        }
        return sendJson(res, 401, { success: false, authenticated: false, error: 'Session expired or invalid' });
      }

      if (pathname === '/api/auth/logout' && method === 'POST') {
        const authHeader = req.headers['authorization'] || '';
        if (authHeader.startsWith('Bearer ')) {
          const token = authHeader.slice(7).trim();
          activeSessions.delete(token);
        }
        return sendJson(res, 200, { success: true, message: 'Logged out successfully' });
      }

      if (pathname === '/api/auth/update-credentials' && method === 'POST') {
        const session = getAuthenticatedUser(req);
        if (!session) return sendJson(res, 401, { error: 'Authentication required to update credentials' });
        if (session.role !== 'director') return sendJson(res, 403, { error: 'Only Director can update portal credentials' });

        const body = await parseJsonBody(req);
        dbCache.settings.auth = dbCache.settings.auth || {};
        if (body.username) dbCache.settings.auth.username = body.username.trim();
        if (body.password) dbCache.settings.auth.password = body.password.trim();
        if (body.pin) dbCache.settings.auth.pin = body.pin.trim();
        if (body.supervisorPin) dbCache.settings.auth.supervisorPin = body.supervisorPin.trim();
        if (body.googleClientId) dbCache.settings.auth.googleClientId = body.googleClientId.trim();
        if (body.googleEmail) dbCache.settings.auth.googleEmail = body.googleEmail.trim().toLowerCase();
        if (body.mode) dbCache.settings.auth.mode = body.mode;

        saveDatabase();
        return sendJson(res, 200, { success: true, message: 'Security credentials and PINs updated successfully!' });
      }

      // 1. Full Data + Stats
      if (pathname === '/api/data' && method === 'GET') {
        loadDatabase();
        const session = getAuthenticatedUser(req);
        const authConfig = dbCache.settings.auth || { enabled: true, mode: 'hybrid' };

        if (!session) {
          if (authConfig.mode === 'full') {
            return sendJson(res, 401, { success: false, authenticated: false, error: 'Director authentication required' });
          }

          const publicSettings = { ...dbCache.settings };
          if (publicSettings.auth) {
            publicSettings.auth = { enabled: true, mode: publicSettings.auth.mode };
          }

          const publicFlats = (dbCache.flats || []).map(f => ({
            id: f.id,
            projectId: f.projectId,
            flatNumber: f.flatNumber,
            floor: f.floor,
            bhk: f.bhk,
            areaSqFt: f.areaSqFt,
            basePrice: f.basePrice,
            facing: f.facing,
            status: f.status
          }));

          return sendJson(res, 200, {
            success: true,
            authenticated: false,
            settings: publicSettings,
            projects: dbCache.projects,
            sitePhotos: dbCache.sitePhotos || [],
            flats: publicFlats,
            inventory: [],
            transactions: [],
            employees: [],
            salaryPayments: [],
            suppliers: [],
            vendorBills: [],
            attendance: [],
            presets: presetsCache,
            stats: {}
          });
        }

        const safeSettings = { ...dbCache.settings };
        if (safeSettings.auth) {
          safeSettings.auth = {
            enabled: true,
            mode: safeSettings.auth.mode || 'hybrid',
            username: safeSettings.auth.username || 'amitus',
            pin: safeSettings.auth.pin || '77877',
            supervisorPin: safeSettings.auth.supervisorPin || '1234',
            googleClientId: safeSettings.auth.googleClientId || '',
            googleEmail: safeSettings.auth.googleEmail || 'amitusinfra2014@gmail.com'
          };
        }

        if (session.role === 'supervisor') {
          return sendJson(res, 200, {
            success: true,
            authenticated: true,
            role: 'supervisor',
            user: session.user || 'Site Supervisor (Munshi)',
            settings: safeSettings,
            projects: dbCache.projects,
            inventory: dbCache.inventory,
            transactions: dbCache.transactions,
            employees: (dbCache.employees || []).map(e => ({
              id: e.id,
              name: e.name,
              phone: e.phone,
              role: e.role,
              trade: e.trade || e.role,
              siteId: e.siteId,
              wageType: e.wageType,
              status: e.status
            })),
            salaryPayments: [],
            flats: (dbCache.flats || []).map(f => ({
              id: f.id,
              projectId: f.projectId,
              flatNumber: f.flatNumber,
              floor: f.floor,
              bhk: f.bhk,
              areaSqFt: f.areaSqFt,
              status: f.status
            })),
            suppliers: (dbCache.suppliers || []).map(s => ({
              id: s.id,
              name: s.name,
              material: s.material,
              phone: s.phone
            })),
            vendorBills: [],
            attendance: dbCache.attendance || [],
            sitePhotos: dbCache.sitePhotos || [],
            presets: presetsCache,
            stats: {
              totalMaterials: (dbCache.inventory || []).length,
              activeWorkers: (dbCache.employees || []).filter(e => e.status === 'Active').length,
              activeSites: (dbCache.projects || []).length
            }
          });
        }

        const stats = computeStats(dbCache);

        return sendJson(res, 200, {
          success: true,
          authenticated: true,
          role: 'director',
          user: session.user || 'Santanu Bhaumik (Director)',
          settings: safeSettings,
          projects: dbCache.projects,
          inventory: dbCache.inventory,
          transactions: dbCache.transactions,
          employees: dbCache.employees,
          salaryPayments: dbCache.salaryPayments,
          flats: dbCache.flats || [],
          suppliers: dbCache.suppliers || [],
          vendorBills: dbCache.vendorBills || [],
          attendance: dbCache.attendance || [],
          sitePhotos: dbCache.sitePhotos || [],
          presets: presetsCache,
          stats
        });
      }

      // 1b. 9:00 PM WhatsApp Daily Operations Brief
      if (pathname === '/api/daily-report') {
        if (method === 'GET') {
          loadDatabase();
          const targetDate = parsedUrl.query.date || null;
          const report = generateDailyWhatsAppBrief(dbCache, targetDate);
          return sendJson(res, 200, { success: true, report });
        }
        if (method === 'POST') {
          loadDatabase();
          const body = await parseJsonBody(req);
          const targetDate = body.date || null;
          const report = generateDailyWhatsAppBrief(dbCache, targetDate);
          const reportDir = path.join(DATA_DIR, 'daily_reports');
          if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
          const reportFile = path.join(reportDir, `report_${report.date}.json`);
          fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf-8');
          return sendJson(res, 200, { success: true, report, saved: true });
        }
      }

      if (pathname === '/api/daily-report/history' && method === 'GET') {
        const reportDir = path.join(DATA_DIR, 'daily_reports');
        if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
        const files = fs.readdirSync(reportDir).filter(f => f.endsWith('.json')).sort().reverse();
        const history = files.slice(0, 14).map(f => {
          try {
            return JSON.parse(fs.readFileSync(path.join(reportDir, f), 'utf-8'));
          } catch (e) {
            return null;
          }
        }).filter(Boolean);
        return sendJson(res, 200, { success: true, history });
      }

      // 2. Presets
      if (pathname === '/api/presets' && method === 'GET') {
        return sendJson(res, 200, presetsCache);
      }

      // 3. Projects CRUD & Quick Staff Adjustment
      if (pathname.match(/^\/api\/projects\/([^/]+)\/quick-staff$/) && method === 'POST') {
        const matches = pathname.match(/^\/api\/projects\/([^/]+)\/quick-staff$/);
        const projId = matches[1];
        const body = await parseJsonBody(req);
        const proj = dbCache.projects.find(p => p.id === projId);

        if (!proj) {
          return sendJson(res, 404, { error: 'Project not found' });
        }

        if (body.delta !== undefined) {
          const delta = Number(body.delta) || 0;
          proj.staffDeployed = Math.max(0, (Number(proj.staffDeployed) || 0) + delta);
        } else if (body.staffDeployed !== undefined) {
          proj.staffDeployed = Math.max(0, Number(body.staffDeployed) || 0);
        }

        if (body.staffNeeded !== undefined) {
          proj.staffNeeded = Math.max(0, Number(body.staffNeeded) || 0);
        }

        saveDatabase();
        return sendJson(res, 200, {
          success: true,
          project: proj,
          message: `Staff updated for ${proj.name}: ${proj.staffDeployed} / ${proj.staffNeeded} deployed`
        });
      }

      if (pathname === '/api/projects') {
        if (method === 'GET') {
          return sendJson(res, 200, dbCache.projects);
        }
        if (method === 'POST') {
          const body = await parseJsonBody(req);
          if (!body.name) {
            return sendJson(res, 400, { error: 'Project name is required' });
          }
          const newProject = {
            id: 'proj_' + crypto.randomUUID().slice(0, 8),
            name: body.name.trim(),
            code: (body.code || body.name.slice(0, 4).toUpperCase()).trim(),
            type: body.type || 'Residential High-Rise',
            location: body.location || '',
            status: body.status || 'Active',
            constructionPhase: body.constructionPhase || 'Foundation & Raft',
            progressPct: Number(body.progressPct) || 0,
            supervisorName: body.supervisorName || '',
            supervisorPhone: body.supervisorPhone || '',
            staffNeeded: Number(body.staffNeeded) || 0,
            staffDeployed: Number(body.staffDeployed) || 0,
            staffRoles: body.staffRoles || '',
            dailyWageRate: Number(body.dailyWageRate) || 650,
            startDate: body.startDate || new Date().toISOString().split('T')[0],
            targetCompletion: body.targetCompletion || '',
            budget: Number(body.budget) || 0,
            color: body.color || '#2563eb',
            notes: body.notes || ''
          };
          dbCache.projects.unshift(newProject);
          saveDatabase();
          return sendJson(res, 201, { success: true, project: newProject });
        }
      }

      if (pathname.startsWith('/api/projects/')) {
        const projId = pathname.replace('/api/projects/', '');
        const projIndex = dbCache.projects.findIndex(p => p.id === projId);

        if (projIndex === -1) {
          return sendJson(res, 404, { error: 'Project not found' });
        }

        if (method === 'PUT') {
          const body = await parseJsonBody(req);
          dbCache.projects[projIndex] = {
            ...dbCache.projects[projIndex],
            ...body,
            id: projId
          };
          saveDatabase();
          return sendJson(res, 200, { success: true, project: dbCache.projects[projIndex] });
        }

        if (method === 'DELETE') {
          const hasItems = dbCache.inventory.some(i => i.projectId === projId);
          if (hasItems && parsedUrl.query.force !== 'true') {
            return sendJson(res, 400, {
              error: 'Project has inventory items. Reassign items or pass ?force=true to delete all.'
            });
          }
          if (parsedUrl.query.force === 'true') {
            dbCache.inventory = dbCache.inventory.filter(i => i.projectId !== projId);
          }
          dbCache.projects.splice(projIndex, 1);
          saveDatabase();
          return sendJson(res, 200, { success: true, message: 'Project deleted' });
        }
      }

      // 4. Employee / Worker CRUD
      if (pathname === '/api/employees') {
        if (method === 'GET') {
          let list = [...dbCache.employees];
          if (parsedUrl.query.projectId) {
            list = list.filter(e => e.assignedProjectId === parsedUrl.query.projectId);
          }
          if (parsedUrl.query.role) {
            list = list.filter(e => e.role === parsedUrl.query.role);
          }
          if (parsedUrl.query.status) {
            list = list.filter(e => e.status === parsedUrl.query.status);
          }
          return sendJson(res, 200, list);
        }

        if (method === 'POST') {
          const body = await parseJsonBody(req);
          if (!body.name) {
            return sendJson(res, 400, { error: 'Worker/Employee name is required' });
          }

          const newEmp = {
            id: 'emp_' + crypto.randomUUID().slice(0, 8),
            name: body.name.trim(),
            phone: body.phone ? body.phone.trim() : '',
            role: body.role || 'General Laborer',
            wageType: body.wageType || 'Daily Wage',
            wageRate: Number(body.wageRate) || 650,
            assignedProjectId: body.assignedProjectId || (dbCache.projects[0]?.id || ''),
            status: body.status || 'Active',
            joiningDate: body.joiningDate || new Date().toISOString().split('T')[0],
            idProof: body.idProof || '',
            emergencyContact: body.emergencyContact || '',
            notes: body.notes || ''
          };

          dbCache.employees.unshift(newEmp);
          saveDatabase();
          return sendJson(res, 201, { success: true, employee: newEmp });
        }
      }

      if (pathname.startsWith('/api/employees/')) {
        const empId = pathname.replace('/api/employees/', '');
        const empIndex = dbCache.employees.findIndex(e => e.id === empId);

        if (empIndex === -1) {
          return sendJson(res, 404, { error: 'Employee not found' });
        }

        if (method === 'PUT') {
          const body = await parseJsonBody(req);
          dbCache.employees[empIndex] = {
            ...dbCache.employees[empIndex],
            ...body,
            id: empId
          };
          saveDatabase();
          return sendJson(res, 200, { success: true, employee: dbCache.employees[empIndex] });
        }

        if (method === 'DELETE') {
          dbCache.employees.splice(empIndex, 1);
          saveDatabase();
          return sendJson(res, 200, { success: true, message: 'Employee removed' });
        }
      }

      // 5. Salary & Wage Payments (Payroll)
      if (pathname === '/api/payroll') {
        if (method === 'GET') {
          let list = [...dbCache.salaryPayments];
          if (parsedUrl.query.employeeId) {
            list = list.filter(p => p.employeeId === parsedUrl.query.employeeId);
          }
          if (parsedUrl.query.projectId) {
            list = list.filter(p => p.projectId === parsedUrl.query.projectId);
          }
          return sendJson(res, 200, list);
        }

        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const emp = dbCache.employees.find(e => e.id === body.employeeId);

          if (!emp && !body.employeeName) {
            return sendJson(res, 400, { error: 'Valid employee selection is required' });
          }

          const amount = Number(body.amount);
          if (isNaN(amount) || amount <= 0) {
            return sendJson(res, 400, { error: 'Valid positive amount required' });
          }

          const newPayment = {
            id: 'pay_' + crypto.randomUUID().slice(0, 8),
            employeeId: emp ? emp.id : '',
            employeeName: emp ? emp.name : body.employeeName,
            projectId: body.projectId || (emp ? emp.assignedProjectId : (dbCache.projects[0]?.id || '')),
            date: body.date || new Date().toISOString().split('T')[0],
            type: body.type || 'Salary Payout', // 'Salary Payout' | 'Daily Wage Payment' | 'Advance Payout' | 'Bonus / Incentive'
            amount: amount,
            period: body.period || 'Current Payout',
            paymentMode: body.paymentMode || 'Cash', // 'Cash' | 'UPI / PhonePe' | 'Bank Transfer' | 'Cheque'
            transactionRef: body.transactionRef || 'VOUCHER-' + Math.floor(1000 + Math.random() * 9000),
            notes: body.notes || ''
          };

          dbCache.salaryPayments.unshift(newPayment);
          saveDatabase();
          return sendJson(res, 201, { success: true, payment: newPayment });
        }
      }

      if (pathname.startsWith('/api/payroll/')) {
        const payId = pathname.replace('/api/payroll/', '');
        const payIndex = dbCache.salaryPayments.findIndex(p => p.id === payId);

        if (payIndex === -1) {
          return sendJson(res, 404, { error: 'Payment record not found' });
        }

        if (method === 'DELETE') {
          dbCache.salaryPayments.splice(payIndex, 1);
          saveDatabase();
          return sendJson(res, 200, { success: true, message: 'Payment record deleted' });
        }
      }


      // 5b. Daily Labor Attendance (হাজিরা / Hazira)
      if (pathname === '/api/attendance') {
        if (method === 'GET') {
          let list = [...(dbCache.attendance || [])];
          if (parsedUrl.query.date) {
            list = list.filter(a => a.date === parsedUrl.query.date);
          }
          if (parsedUrl.query.projectId && parsedUrl.query.projectId !== 'all') {
            list = list.filter(a => a.projectId === parsedUrl.query.projectId);
          }
          return sendJson(res, 200, { success: true, count: list.length, attendance: list });
        }

        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const date = body.date || new Date().toISOString().slice(0, 10);
          const records = body.records || [];

          dbCache.attendance = dbCache.attendance || [];
          const empIds = new Set(records.map(r => r.employeeId));
          dbCache.attendance = dbCache.attendance.filter(a => !(a.date === date && empIds.has(a.employeeId)));

          records.forEach(r => {
            const emp = dbCache.employees.find(e => e.id === r.employeeId);
            const factor = r.status === 'present' ? 1.0 : (r.status === 'half' ? 0.5 : 0.0);
            const rate = Number(r.wageRate) || (emp ? Number(emp.dailyWage) || 650 : 650);
            const ot = Number(r.overtimeHours) || 0;
            const otRate = (rate / 8) * 1.5;
            const earned = Math.round((rate * factor) + (ot * otRate));

            dbCache.attendance.push({
              id: 'att_' + crypto.randomBytes(4).toString('hex'),
              date: date,
              projectId: r.projectId || (emp ? emp.projectId : 'proj_horizon'),
              employeeId: r.employeeId,
              employeeName: emp ? emp.name : (r.employeeName || 'Worker'),
              trade: emp ? emp.trade : (r.trade || 'Worker'),
              status: r.status || 'present',
              factor: factor,
              wageRate: rate,
              overtimeHours: ot,
              earned: earned,
              remarks: r.remarks || ''
            });
          });

          saveDatabase();
          return sendJson(res, 200, { success: true, message: `Saved attendance for ${records.length} workers on ${date}` });
        }
      }

      // 5c. Flat Units & Booking Management (G+4 Shibnagar & Damini)
      if (pathname === '/api/flats') {
        if (method === 'GET') {
          let list = [...(dbCache.flats || [])];
          if (parsedUrl.query.projectId && parsedUrl.query.projectId !== 'all') {
            list = list.filter(f => f.projectId === parsedUrl.query.projectId);
          }
          return sendJson(res, 200, { success: true, flats: list });
        }

        if (method === 'POST') {
          const body = await parseJsonBody(req);
          dbCache.flats = dbCache.flats || [];
          if (body.id) {
            const idx = dbCache.flats.findIndex(f => f.id === body.id);
            if (idx !== -1) {
              dbCache.flats[idx] = { ...dbCache.flats[idx], ...body, updatedAt: new Date().toISOString() };
              saveDatabase();
              return sendJson(res, 200, { success: true, flat: dbCache.flats[idx] });
            }
          }
          const newFlat = {
            id: 'flat_' + crypto.randomBytes(4).toString('hex'),
            projectId: body.projectId || 'proj_horizon',
            flatNumber: body.flatNumber || 'Flat',
            floor: body.floor || '1st Floor',
            bhk: body.bhk || '2BHK',
            areaSqFt: Number(body.areaSqFt) || 1000,
            basePrice: Number(body.basePrice) || 4000000,
            facing: body.facing || 'East',
            status: body.status || 'available',
            buyer: body.buyer || null,
            milestones: body.milestones || [],
            createdAt: new Date().toISOString()
          };
          dbCache.flats.push(newFlat);
          saveDatabase();
          return sendJson(res, 201, { success: true, flat: newFlat });
        }
      }

      if (pathname.match(/^\/api\/flats\/([^/]+)\/book$/) && method === 'POST') {
        const flatId = pathname.split('/')[3];
        const flat = (dbCache.flats || []).find(f => f.id === flatId);
        if (!flat) return sendJson(res, 404, { error: 'Flat not found' });

        const body = await parseJsonBody(req);
        flat.status = 'booked';
        flat.buyer = {
          name: body.buyerName || 'Client',
          phone: body.buyerPhone || '',
          email: body.buyerEmail || '',
          bookingDate: body.bookingDate || new Date().toISOString().slice(0, 10),
          agreedPrice: Number(body.agreedPrice) || flat.basePrice,
          advancePaid: Number(body.advancePaid) || 0
        };

        const total = flat.buyer.agreedPrice;
        flat.milestones = [
          { id: 'm1', stage: 'Booking Advance (10%)', pct: 10, amount: Math.round(total * 0.10), status: flat.buyer.advancePaid >= Math.round(total * 0.10) ? 'paid' : 'invoiced', paidDate: flat.buyer.bookingDate, ref: 'Booking Token' },
          { id: 'm2', stage: 'Foundation & Plinth Beam (20%)', pct: 20, amount: Math.round(total * 0.20), status: 'pending' },
          { id: 'm3', stage: '1st & 2nd Floor Roof Slab Casting (20%)', pct: 20, amount: Math.round(total * 0.20), status: 'pending' },
          { id: 'm4', stage: 'Brickwork & External Plaster (20%)', pct: 20, amount: Math.round(total * 0.20), status: 'pending' },
          { id: 'm5', stage: 'Flooring, Tiles, Electrical & Plumbing (15%)', pct: 15, amount: Math.round(total * 0.15), status: 'pending' },
          { id: 'm6', stage: 'Final Handover & Registry (15%)', pct: 15, amount: Math.round(total * 0.15), status: 'pending' }
        ];

        saveDatabase();
        return sendJson(res, 200, { success: true, message: `Flat ${flat.flatNumber} booked for ${flat.buyer.name}`, flat });
      }

      if (pathname.match(/^\/api\/flats\/([^/]+)\/milestone$/) && method === 'POST') {
        const flatId = pathname.split('/')[3];
        const flat = (dbCache.flats || []).find(f => f.id === flatId);
        if (!flat) return sendJson(res, 404, { error: 'Flat not found' });

        const body = await parseJsonBody(req);
        const milestone = (flat.milestones || []).find(m => m.id === body.milestoneId);
        if (!milestone) return sendJson(res, 404, { error: 'Milestone not found' });

        milestone.status = body.status || 'paid';
        if (body.status === 'paid') {
          milestone.paidDate = body.paidDate || new Date().toISOString().slice(0, 10);
          milestone.ref = body.ref || 'Direct Bank / Voucher';
        }
        saveDatabase();
        return sendJson(res, 200, { success: true, message: `Milestone updated for Flat ${flat.flatNumber}`, flat });
      }

      // 5d. Suppliers Directory
      if (pathname === '/api/suppliers') {
        if (method === 'GET') {
          const bills = dbCache.vendorBills || [];
          const suppliers = (dbCache.suppliers || []).map(s => {
            const sBills = bills.filter(b => b.supplierId === s.id);
            const totalBilled = sBills.reduce((acc, b) => acc + (Number(b.totalAmount) || 0), 0);
            const totalPaid = sBills.reduce((acc, b) => acc + (Number(b.paidAmount) || 0), 0);
            return {
              ...s,
              totalBilled,
              totalPaid,
              balance: Math.max(0, totalBilled - totalPaid)
            };
          });
          return sendJson(res, 200, { success: true, suppliers });
        }

        if (method === 'POST') {
          const body = await parseJsonBody(req);
          dbCache.suppliers = dbCache.suppliers || [];
          if (body.id) {
            const idx = dbCache.suppliers.findIndex(s => s.id === body.id);
            if (idx !== -1) {
              dbCache.suppliers[idx] = { ...dbCache.suppliers[idx], ...body };
              saveDatabase();
              return sendJson(res, 200, { success: true, supplier: dbCache.suppliers[idx] });
            }
          }
          const newSup = {
            id: 'sup_' + crypto.randomBytes(4).toString('hex'),
            name: body.name || 'New Supplier',
            category: body.category || 'General Building Materials',
            contactPerson: body.contactPerson || '',
            phone: body.phone || '',
            address: body.address || 'Agartala, Tripura',
            gstin: body.gstin || '',
            totalBilled: 0,
            totalPaid: 0,
            balance: 0,
            createdAt: new Date().toISOString()
          };
          dbCache.suppliers.push(newSup);
          saveDatabase();
          return sendJson(res, 201, { success: true, supplier: newSup });
        }
      }

      if (pathname.startsWith('/api/suppliers/') && method === 'DELETE') {
        const supId = pathname.replace('/api/suppliers/', '');
        const idx = (dbCache.suppliers || []).findIndex(s => s.id === supId);
        if (idx !== -1) {
          dbCache.suppliers.splice(idx, 1);
          saveDatabase();
          return sendJson(res, 200, { success: true, message: 'Supplier removed' });
        }
        return sendJson(res, 404, { error: 'Supplier not found' });
      }

      // 5e. Vendor Bills & Ledger
      if (pathname === '/api/vendor-bills') {
        if (method === 'GET') {
          let list = [...(dbCache.vendorBills || [])];
          if (parsedUrl.query.supplierId) {
            list = list.filter(b => b.supplierId === parsedUrl.query.supplierId);
          }
          if (parsedUrl.query.projectId && parsedUrl.query.projectId !== 'all') {
            list = list.filter(b => b.projectId === parsedUrl.query.projectId);
          }
          return sendJson(res, 200, { success: true, bills: list });
        }

        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const totalAmt = Number(body.totalAmount) || 0;
          const paidAmt = Number(body.paidAmount) || 0;
          const balance = Math.max(0, totalAmt - paidAmt);
          const sup = (dbCache.suppliers || []).find(s => s.id === body.supplierId);

          const newBill = {
            id: 'bill_' + crypto.randomBytes(4).toString('hex'),
            supplierId: body.supplierId,
            supplierName: sup ? sup.name : (body.supplierName || 'Vendor'),
            projectId: body.projectId || 'proj_horizon',
            invoiceNumber: body.invoiceNumber || ('INV-' + Math.floor(1000 + Math.random() * 9000)),
            billDate: body.billDate || new Date().toISOString().slice(0, 10),
            dueDate: body.dueDate || '',
            totalAmount: totalAmt,
            paidAmount: paidAmt,
            balanceAmount: balance,
            status: balance === 0 ? 'paid' : (paidAmt > 0 ? 'partial' : 'unpaid'),
            itemsDescription: body.itemsDescription || '',
            payments: paidAmt > 0 ? [{ id: 'p1', date: body.billDate || new Date().toISOString().slice(0, 10), amount: paidAmt, mode: body.paymentMode || 'Bank', ref: body.paymentRef || '' }] : [],
            createdAt: new Date().toISOString()
          };

          dbCache.vendorBills = dbCache.vendorBills || [];
          dbCache.vendorBills.unshift(newBill);
          saveDatabase();
          return sendJson(res, 201, { success: true, bill: newBill });
        }
      }

      if (pathname.match(/^\/api\/vendor-bills\/([^/]+)\/pay$/) && method === 'POST') {
        const billId = pathname.split('/')[3];
        const bill = (dbCache.vendorBills || []).find(b => b.id === billId);
        if (!bill) return sendJson(res, 404, { error: 'Bill not found' });

        const body = await parseJsonBody(req);
        const payAmt = Number(body.amount) || 0;
        if (payAmt <= 0) return sendJson(res, 400, { error: 'Invalid payment amount' });

        bill.payments = bill.payments || [];
        bill.payments.push({
          id: 'pay_' + crypto.randomBytes(3).toString('hex'),
          date: body.date || new Date().toISOString().slice(0, 10),
          amount: payAmt,
          mode: body.mode || 'Bank / UPI',
          ref: body.ref || ''
        });

        bill.paidAmount = (Number(bill.paidAmount) || 0) + payAmt;
        bill.balanceAmount = Math.max(0, bill.totalAmount - bill.paidAmount);
        bill.status = bill.balanceAmount === 0 ? 'paid' : 'partial';

        saveDatabase();
        return sendJson(res, 200, { success: true, message: `Recorded payment of ₹${payAmt.toLocaleString('en-IN')}`, bill });
      }

      // 5f. Site Progress Photos
      if (pathname === '/api/site-photos') {
        if (method === 'GET') {
          let list = [...(dbCache.sitePhotos || [])];
          if (parsedUrl.query.projectId && parsedUrl.query.projectId !== 'all') {
            list = list.filter(p => p.projectId === parsedUrl.query.projectId);
          }
          return sendJson(res, 200, { success: true, photos: list });
        }

        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const proj = (dbCache.projects || []).find(p => p.id === body.projectId);
          const newPhoto = {
            id: 'photo_' + crypto.randomBytes(4).toString('hex'),
            projectId: body.projectId || 'proj_horizon',
            projectName: proj ? proj.name : (body.projectName || 'Site Project'),
            title: body.title || 'Site Construction Progress',
            phase: body.phase || (proj ? proj.constructionPhase : 'RCC Structure'),
            date: body.date || new Date().toISOString().slice(0, 10),
            imageUrl: body.imageUrl || 'logo.jpg',
            caption: body.caption || '',
            showcaseOnHome: body.showcaseOnHome !== false,
            createdAt: new Date().toISOString()
          };

          dbCache.sitePhotos = dbCache.sitePhotos || [];
          dbCache.sitePhotos.unshift(newPhoto);
          saveDatabase();
          return sendJson(res, 201, { success: true, photo: newPhoto });
        }
      }

      if (pathname.startsWith('/api/site-photos/') && method === 'DELETE') {
        const photoId = pathname.replace('/api/site-photos/', '');
        const idx = (dbCache.sitePhotos || []).findIndex(p => p.id === photoId);
        if (idx !== -1) {
          dbCache.sitePhotos.splice(idx, 1);
          saveDatabase();
          return sendJson(res, 200, { success: true, message: 'Photo removed' });
        }
        return sendJson(res, 404, { error: 'Photo not found' });
      }

      // 6. Inventory CRUD
      if (pathname === '/api/inventory') {
        if (method === 'GET') {
          let items = [...dbCache.inventory];
          if (parsedUrl.query.projectId) {
            items = items.filter(i => i.projectId === parsedUrl.query.projectId);
          }
          if (parsedUrl.query.category) {
            items = items.filter(i => i.category === parsedUrl.query.category);
          }
          if (parsedUrl.query.lowStock === 'true') {
            items = items.filter(i => Number(i.quantity) <= Number(i.minStockAlert));
          }
          return sendJson(res, 200, items);
        }

        if (method === 'POST') {
          const body = await parseJsonBody(req);
          if (!body.name || !body.projectId) {
            return sendJson(res, 400, { error: 'Material name and project are required' });
          }

          const stdPrice = Number(body.standardPrice) || 0;
          let subPrice = Number(body.subsidizedPrice);
          if (isNaN(subPrice)) subPrice = stdPrice;

          const newItem = {
            id: 'item_' + crypto.randomUUID().slice(0, 8),
            projectId: body.projectId,
            name: body.name.trim(),
            sku: (body.sku || 'MAT-' + Math.floor(1000 + Math.random() * 9000)).trim(),
            category: body.category || 'General',
            unit: body.unit || 'Pieces/Nos',
            quantity: Number(body.quantity) || 0,
            minStockAlert: Number(body.minStockAlert) || 10,
            standardPrice: stdPrice,
            subsidizedPrice: subPrice,
            subsidyType: body.subsidyType || 'flat',
            subsidyValue: stdPrice - subPrice,
            subsidyScheme: body.subsidyScheme || 'Standard Builder Discount',
            subsidyStatus: body.subsidyStatus || 'Approved',
            deliveryETA: body.deliveryETA || 'In Stock',
            supplier: body.supplier || '',
            supplierContact: body.supplierContact || '',
            locationInSite: body.locationInSite || '',
            lastRestocked: new Date().toISOString(),
            notes: body.notes || ''
          };

          dbCache.inventory.unshift(newItem);

          if (newItem.quantity > 0) {
            dbCache.transactions.unshift({
              id: 'tx_' + crypto.randomUUID().slice(0, 8),
              date: new Date().toISOString(),
              type: 'INWARD',
              itemId: newItem.id,
              itemName: newItem.name,
              projectId: newItem.projectId,
              quantity: newItem.quantity,
              unit: newItem.unit,
              unitRate: newItem.standardPrice,
              subsidizedRate: newItem.subsidizedPrice,
              totalValue: newItem.quantity * newItem.subsidizedPrice,
              challanNo: body.challanNo || 'INITIAL-STOCK',
              vehicleNo: body.vehicleNo || 'Direct Entry',
              receivedBy: body.receivedBy || 'System Admin',
              notes: 'Initial material stock entry'
            });
          }

          saveDatabase();
          return sendJson(res, 201, { success: true, item: newItem });
        }
      }

      if (pathname.startsWith('/api/inventory/') && !pathname.includes('/quick-')) {
        const itemId = pathname.replace('/api/inventory/', '');
        const itemIndex = dbCache.inventory.findIndex(i => i.id === itemId);

        if (itemIndex === -1) {
          return sendJson(res, 404, { error: 'Item not found' });
        }

        if (method === 'PUT') {
          const body = await parseJsonBody(req);
          const oldQty = dbCache.inventory[itemIndex].quantity;
          const newQty = body.quantity !== undefined ? Number(body.quantity) : oldQty;

          dbCache.inventory[itemIndex] = {
            ...dbCache.inventory[itemIndex],
            ...body,
            id: itemId
          };

          if (newQty !== oldQty) {
            const diff = newQty - oldQty;
            dbCache.transactions.unshift({
              id: 'tx_' + crypto.randomUUID().slice(0, 8),
              date: new Date().toISOString(),
              type: diff > 0 ? 'INWARD' : 'OUTWARD',
              itemId: itemId,
              itemName: dbCache.inventory[itemIndex].name,
              projectId: dbCache.inventory[itemIndex].projectId,
              quantity: Math.abs(diff),
              unit: dbCache.inventory[itemIndex].unit,
              unitRate: dbCache.inventory[itemIndex].standardPrice,
              subsidizedRate: dbCache.inventory[itemIndex].subsidizedPrice,
              totalValue: Math.abs(diff) * dbCache.inventory[itemIndex].subsidizedPrice,
              challanNo: 'MANUAL-EDIT',
              vehicleNo: 'N/A',
              receivedBy: 'Manual Adjustment',
              notes: `Stock quantity edited from ${oldQty} to ${newQty}`
            });
          }

          saveDatabase();
          return sendJson(res, 200, { success: true, item: dbCache.inventory[itemIndex] });
        }

        if (method === 'DELETE') {
          dbCache.inventory.splice(itemIndex, 1);
          saveDatabase();
          return sendJson(res, 200, { success: true, message: 'Item deleted' });
        }
      }

      // 7. SHORTCUT: Fast Stock Delta Adjustment
      if (pathname.match(/^\/api\/inventory\/([^/]+)\/quick-adjust$/) && method === 'POST') {
        const matches = pathname.match(/^\/api\/inventory\/([^/]+)\/quick-adjust$/);
        const itemId = matches[1];
        const body = await parseJsonBody(req);
        const delta = Number(body.delta);

        if (isNaN(delta) || delta === 0) {
          return sendJson(res, 400, { error: 'Valid numeric delta is required' });
        }

        const item = dbCache.inventory.find(i => i.id === itemId);
        if (!item) {
          return sendJson(res, 404, { error: 'Item not found' });
        }

        const previousQty = Number(item.quantity) || 0;
        const newQty = Math.max(0, previousQty + delta);
        item.quantity = newQty;
        item.lastRestocked = new Date().toISOString();

        const txType = delta > 0 ? 'INWARD' : 'OUTWARD';
        dbCache.transactions.unshift({
          id: 'tx_' + crypto.randomUUID().slice(0, 8),
          date: new Date().toISOString(),
          type: txType,
          itemId: item.id,
          itemName: item.name,
          projectId: item.projectId,
          quantity: Math.abs(delta),
          unit: item.unit,
          unitRate: item.standardPrice,
          subsidizedRate: item.subsidizedPrice,
          totalValue: Math.abs(delta) * item.subsidizedPrice,
          challanNo: body.challanNo || (delta > 0 ? 'QUICK-ADD' : 'QUICK-ISSUE'),
          vehicleNo: body.vehicleNo || 'Quick Shortcut',
          receivedBy: body.receivedBy || 'Site Operator',
          notes: body.reason || `Quick shortcut adjustment (${delta > 0 ? '+' : ''}${delta})`
        });

        saveDatabase();
        return sendJson(res, 200, {
          success: true,
          item,
          previousQty,
          newQty,
          delta
        });
      }

      // 8. SHORTCUT: 1-Click Quick Add From Presets Catalog
      if (pathname === '/api/inventory/quick-add-preset' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { presetId, projectId, quantity } = body;

        if (!presetId || !projectId) {
          return sendJson(res, 400, { error: 'presetId and projectId are required' });
        }

        const preset = presetsCache.find(p => p.id === presetId);
        if (!preset) {
          return sendJson(res, 404, { error: 'Preset material not found' });
        }

        const stdPrice = body.customStandardPrice !== undefined
          ? Number(body.customStandardPrice)
          : preset.defaultStandardPrice;

        const subPrice = body.customSubsidizedPrice !== undefined
          ? Number(body.customSubsidizedPrice)
          : preset.defaultSubsidizedPrice;

        const qty = Number(quantity) || 10;

        const existing = dbCache.inventory.find(
          i => i.projectId === projectId && i.name.toLowerCase() === preset.name.toLowerCase()
        );

        if (existing) {
          existing.quantity = Number(existing.quantity) + qty;
          existing.lastRestocked = new Date().toISOString();
          existing.standardPrice = stdPrice;
          existing.subsidizedPrice = subPrice;

          dbCache.transactions.unshift({
            id: 'tx_' + crypto.randomUUID().slice(0, 8),
            date: new Date().toISOString(),
            type: 'INWARD',
            itemId: existing.id,
            itemName: existing.name,
            projectId: projectId,
            quantity: qty,
            unit: existing.unit,
            unitRate: stdPrice,
            subsidizedRate: subPrice,
            totalValue: qty * subPrice,
            challanNo: body.challanNo || 'PRESET-ADD',
            vehicleNo: 'Supplier Direct',
            receivedBy: body.receivedBy || 'Site Supervisor',
            notes: `Added ${qty} ${existing.unit} via Preset Quick-Add`
          });

          saveDatabase();
          return sendJson(res, 200, {
            success: true,
            item: existing,
            isNew: false,
            message: `Updated existing stock of ${preset.name} (+${qty})`
          });
        }

        const newItem = {
          id: 'item_' + crypto.randomUUID().slice(0, 8),
          projectId,
          name: preset.name,
          sku: preset.id.replace('pre_', '').toUpperCase() + '-' + Math.floor(100 + Math.random() * 900),
          category: preset.category,
          unit: preset.unit,
          quantity: qty,
          minStockAlert: preset.defaultMinAlert || 10,
          standardPrice: stdPrice,
          subsidizedPrice: subPrice,
          subsidyType: 'flat',
          subsidyValue: stdPrice - subPrice,
          subsidyScheme: preset.subsidyScheme || 'Standard Builder Discount',
          subsidyStatus: 'Approved',
          deliveryETA: 'In Stock',
          supplier: body.supplier || 'Authorized Manufacturer Dealer',
          supplierContact: body.supplierContact || '',
          locationInSite: body.locationInSite || 'Main Site Storage Bay',
          lastRestocked: new Date().toISOString(),
          notes: preset.description || ''
        };

        dbCache.inventory.unshift(newItem);

        dbCache.transactions.unshift({
          id: 'tx_' + crypto.randomUUID().slice(0, 8),
          date: new Date().toISOString(),
          type: 'INWARD',
          itemId: newItem.id,
          itemName: newItem.name,
          projectId: projectId,
          quantity: qty,
          unit: newItem.unit,
          unitRate: stdPrice,
          subsidizedRate: subPrice,
          totalValue: qty * subPrice,
          challanNo: body.challanNo || 'PRESET-INIT',
          vehicleNo: 'Supplier Direct',
          receivedBy: body.receivedBy || 'Site Supervisor',
          notes: `Added new material from catalog (${preset.name})`
        });

        saveDatabase();
        return sendJson(res, 201, {
          success: true,
          item: newItem,
          isNew: true,
          message: `Added new material: ${preset.name}`
        });
      }

      // 9. SHORTCUT: Site-to-Site Stock Transfer
      if (pathname === '/api/transactions/transfer' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { sourceItemId, targetProjectId, transferQty } = body;
        const qty = Number(transferQty);

        if (!sourceItemId || !targetProjectId || isNaN(qty) || qty <= 0) {
          return sendJson(res, 400, { error: 'Valid source item, destination project, and positive quantity required' });
        }

        const sourceItem = dbCache.inventory.find(i => i.id === sourceItemId);
        if (!sourceItem) {
          return sendJson(res, 404, { error: 'Source inventory item not found' });
        }

        if (sourceItem.quantity < qty) {
          return sendJson(res, 400, {
            error: `Insufficient stock. Only ${sourceItem.quantity} ${sourceItem.unit} available at source site.`
          });
        }

        const targetProj = dbCache.projects.find(p => p.id === targetProjectId);
        if (!targetProj) {
          return sendJson(res, 404, { error: 'Destination project site not found' });
        }

        sourceItem.quantity = Number(sourceItem.quantity) - qty;

        let targetItem = dbCache.inventory.find(
          i => i.projectId === targetProjectId && i.name.toLowerCase() === sourceItem.name.toLowerCase()
        );

        if (targetItem) {
          targetItem.quantity = Number(targetItem.quantity) + qty;
          targetItem.lastRestocked = new Date().toISOString();
        } else {
          targetItem = {
            id: 'item_' + crypto.randomUUID().slice(0, 8),
            projectId: targetProjectId,
            name: sourceItem.name,
            sku: sourceItem.sku,
            category: sourceItem.category,
            unit: sourceItem.unit,
            quantity: qty,
            minStockAlert: sourceItem.minStockAlert,
            standardPrice: sourceItem.standardPrice,
            subsidizedPrice: sourceItem.subsidizedPrice,
            subsidyType: sourceItem.subsidyType,
            subsidyValue: sourceItem.subsidyValue,
            subsidyScheme: sourceItem.subsidyScheme,
            subsidyStatus: sourceItem.subsidyStatus || 'Approved',
            deliveryETA: 'Transferred',
            supplier: sourceItem.supplier,
            supplierContact: sourceItem.supplierContact,
            locationInSite: body.targetLocation || 'Site Receiving Bay',
            lastRestocked: new Date().toISOString(),
            notes: `Transferred from ${sourceItem.projectId}`
          };
          dbCache.inventory.unshift(targetItem);
        }

        const tx = {
          id: 'tx_' + crypto.randomUUID().slice(0, 8),
          date: new Date().toISOString(),
          type: 'TRANSFER',
          itemId: sourceItem.id,
          itemName: sourceItem.name,
          projectId: sourceItem.projectId,
          toProjectId: targetProjectId,
          quantity: qty,
          unit: sourceItem.unit,
          unitRate: sourceItem.standardPrice,
          subsidizedRate: sourceItem.subsidizedPrice,
          totalValue: qty * sourceItem.subsidizedPrice,
          challanNo: body.challanNo || 'TRF-' + Math.floor(1000 + Math.random() * 9000),
          vehicleNo: body.vehicleNo || 'Site Logistics Truck',
          receivedBy: body.receivedBy || targetProj.supervisorName || 'Site Incharge',
          notes: body.notes || `Inter-site transfer of ${qty} ${sourceItem.unit}`
        };

        dbCache.transactions.unshift(tx);
        saveDatabase();

        return sendJson(res, 200, {
          success: true,
          message: `Successfully transferred ${qty} ${sourceItem.unit} to ${targetProj.name}`,
          sourceItem,
          targetItem,
          transaction: tx
        });
      }

      // 10. Quick Inward & Outward
      if (pathname === '/api/transactions/inward' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { itemId, quantity, challanNo, vehicleNo, receivedBy, notes } = body;
        const qty = Number(quantity);

        if (!itemId || isNaN(qty) || qty <= 0) {
          return sendJson(res, 400, { error: 'Valid item and positive quantity required' });
        }

        const item = dbCache.inventory.find(i => i.id === itemId);
        if (!item) {
          return sendJson(res, 404, { error: 'Material item not found' });
        }

        item.quantity = Number(item.quantity) + qty;
        item.lastRestocked = new Date().toISOString();

        if (body.standardPrice) item.standardPrice = Number(body.standardPrice);
        if (body.subsidizedPrice) item.subsidizedPrice = Number(body.subsidizedPrice);

        const tx = {
          id: 'tx_' + crypto.randomUUID().slice(0, 8),
          date: new Date().toISOString(),
          type: 'INWARD',
          itemId: item.id,
          itemName: item.name,
          projectId: item.projectId,
          quantity: qty,
          unit: item.unit,
          unitRate: item.standardPrice,
          subsidizedRate: item.subsidizedPrice,
          totalValue: qty * item.subsidizedPrice,
          challanNo: challanNo || 'INW-' + Math.floor(1000 + Math.random() * 9000),
          vehicleNo: vehicleNo || 'Supplier Delivery',
          receivedBy: receivedBy || 'Store Incharge',
          notes: notes || 'Stock received'
        };

        dbCache.transactions.unshift(tx);
        saveDatabase();

        return sendJson(res, 200, { success: true, item, transaction: tx });
      }

      if (pathname === '/api/transactions/outward' && method === 'POST') {
        const body = await parseJsonBody(req);
        const { itemId, quantity, challanNo, receivedBy, notes } = body;
        const qty = Number(quantity);

        if (!itemId || isNaN(qty) || qty <= 0) {
          return sendJson(res, 400, { error: 'Valid item and positive quantity required' });
        }

        const item = dbCache.inventory.find(i => i.id === itemId);
        if (!item) {
          return sendJson(res, 404, { error: 'Material item not found' });
        }

        if (item.quantity < qty) {
          return sendJson(res, 400, { error: `Cannot issue ${qty}. Current stock is only ${item.quantity} ${item.unit}.` });
        }

        item.quantity = Number(item.quantity) - qty;

        const tx = {
          id: 'tx_' + crypto.randomUUID().slice(0, 8),
          date: new Date().toISOString(),
          type: 'OUTWARD',
          itemId: item.id,
          itemName: item.name,
          projectId: item.projectId,
          quantity: qty,
          unit: item.unit,
          unitRate: item.standardPrice,
          subsidizedRate: item.subsidizedPrice,
          totalValue: qty * item.subsidizedPrice,
          challanNo: challanNo || 'ISSUE-' + Math.floor(1000 + Math.random() * 9000),
          vehicleNo: 'Site Consumption',
          receivedBy: receivedBy || 'Work Foreman',
          notes: notes || 'Issued for site execution'
        };

        dbCache.transactions.unshift(tx);
        saveDatabase();

        return sendJson(res, 200, { success: true, item, transaction: tx });
      }

      // 11. Settings update
      if (pathname === '/api/settings' && method === 'POST') {
        const body = await parseJsonBody(req);
        dbCache.settings = { ...dbCache.settings, ...body };
        saveDatabase();
        return sendJson(res, 200, { success: true, settings: dbCache.settings });
      }

      // 12. Export to CSV (Inventory, Transactions, Employees, Payroll)
      if (pathname === '/api/export/csv') {
        const type = parsedUrl.query.type || 'inventory';
        let csv = '';

        if (type === 'inventory') {
          csv = 'Project ID,Project Name,Item ID,Item Name,Category,Unit,Quantity,Min Alert,Standard Unit Rate,Subsidized Unit Rate,Total Standard Cost,Total Subsidized Cost,Net Subsidy Savings,Subsidy Scheme,Subsidy Status,Delivery Status,Supplier,Location in Site\n';
          dbCache.inventory.forEach(item => {
            const proj = dbCache.projects.find(p => p.id === item.projectId);
            const projName = proj ? proj.name : item.projectId;
            const stdVal = item.quantity * item.standardPrice;
            const subVal = item.quantity * item.subsidizedPrice;
            const savings = stdVal - subVal;

            csv += `"${item.projectId}","${projName}","${item.id}","${item.name}","${item.category}","${item.unit}",${item.quantity},${item.minStockAlert},${item.standardPrice},${item.subsidizedPrice},${stdVal},${subVal},${savings},"${item.subsidyScheme || ''}","${item.subsidyStatus || 'Approved'}","${item.deliveryETA || 'In Stock'}","${item.supplier || ''}","${item.locationInSite || ''}"\n`;
          });

          res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="inventory_report_${new Date().toISOString().split('T')[0]}.csv"`
          });
          return res.end(csv);
        }

        if (type === 'transactions') {
          csv = 'Date,Type,Challan No,Material Name,Project,To Project,Quantity,Unit,Standard Rate,Subsidized Rate,Total Value,Vehicle No,Received By,Notes\n';
          dbCache.transactions.forEach(tx => {
            const p = dbCache.projects.find(proj => proj.id === tx.projectId);
            const toP = tx.toProjectId ? dbCache.projects.find(proj => proj.id === tx.toProjectId) : null;
            csv += `"${tx.date}","${tx.type}","${tx.challanNo || ''}","${tx.itemName}","${p ? p.name : tx.projectId}","${toP ? toP.name : (tx.toProjectId || '')}",${tx.quantity},"${tx.unit}",${tx.unitRate},${tx.subsidizedRate},${tx.totalValue},"${tx.vehicleNo || ''}","${tx.receivedBy || ''}","${tx.notes || ''}"\n`;
          });

          res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="transactions_log_${new Date().toISOString().split('T')[0]}.csv"`
          });
          return res.end(csv);
        }

        if (type === 'employees') {
          csv = 'Employee ID,Name,Phone,Role,Wage Type,Wage Rate,Assigned Site,Status,Joining Date,ID Proof,Emergency Contact,Notes\n';
          dbCache.employees.forEach(emp => {
            const p = dbCache.projects.find(proj => proj.id === emp.assignedProjectId);
            csv += `"${emp.id}","${emp.name}","${emp.phone}","${emp.role}","${emp.wageType}",${emp.wageRate},"${p ? p.name : (emp.assignedProjectId || 'Unassigned')}","${emp.status}","${emp.joiningDate || ''}","${emp.idProof || ''}","${emp.emergencyContact || ''}","${emp.notes || ''}"\n`;
          });

          res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="workforce_directory_${new Date().toISOString().split('T')[0]}.csv"`
          });
          return res.end(csv);
        }

        if (type === 'payroll') {
          csv = 'Payment ID,Date,Employee Name,Site Project,Payment Type,Amount,Period,Payment Mode,Transaction Ref,Notes\n';
          dbCache.salaryPayments.forEach(pay => {
            const p = dbCache.projects.find(proj => proj.id === pay.projectId);
            csv += `"${pay.id}","${pay.date}","${pay.employeeName}","${p ? p.name : (pay.projectId || '')}","${pay.type}",${pay.amount},"${pay.period || ''}","${pay.paymentMode || ''}","${pay.transactionRef || ''}","${pay.notes || ''}"\n`;
          });

          res.writeHead(200, {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="salary_payroll_report_${new Date().toISOString().split('T')[0]}.csv"`
          });
          return res.end(csv);
        }
      }

      // 13. Backup
      if (pathname === '/api/backup') {
        if (method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="realestate_inventory_backup_${new Date().toISOString().split('T')[0]}.json"`
          });
          return res.end(JSON.stringify(dbCache, null, 2));
        }
        if (method === 'POST') {
          const body = await parseJsonBody(req);
          if (body.projects && body.inventory) {
            dbCache = body;
            saveDatabase();
            return sendJson(res, 200, { success: true, message: 'Database restored successfully' });
          } else {
            return sendJson(res, 400, { error: 'Invalid backup structure' });
          }
        }
      }

      return sendJson(res, 404, { error: 'API route not found' });
    }

    // Static Asset Serving
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Access denied');
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        return res.end('Server Error loading file');
      }
      res.writeHead(200, { 'Content-Type': contentType, ...SECURITY_HEADERS });
      res.end(content);
    });

  } catch (err) {
    console.error('Unhandled server error:', err);
    sendJson(res, 500, { error: 'Internal Server Error', message: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🏗️  Real Estate & Construction Inventory Management App`);
  console.log(`🌐 Server running at: http://localhost:${PORT}`);
  console.log(`⚡ Zero external dependencies, ultra-fast startup`);
  console.log(`=======================================================`);
});
