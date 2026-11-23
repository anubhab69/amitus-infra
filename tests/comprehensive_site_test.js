// Automated End-to-End Security & Functional Verification Suite
// Amitus Infra Management System

const http = require('http');

const BASE_URL = 'http://localhost:3000';
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedTests++;
  }
}

function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = { ...headers };
    let bodyStr = null;

    if (data) {
      bodyStr = typeof data === 'string' ? data : JSON.stringify(data);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = http.request(url, { method, headers: reqHeaders }, res => {
      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(rawData);
        } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json,
          text: rawData
        });
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('🛡️  AMITUS INFRA — SECURITY & FUNCTIONAL TEST SUITE');
  console.log('======================================================\n');

  try {
    // ----------------------------------------------------
    // TEST 1: OWASP Security Headers on Static Delivery
    // ----------------------------------------------------
    console.log('1. Testing OWASP Security Headers...');
    const homeRes = await makeRequest('GET', '/');
    assert(homeRes.statusCode === 200, 'Home page returns HTTP 200 OK');
    assert(homeRes.headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff present');
    assert(homeRes.headers['x-frame-options'] === 'SAMEORIGIN', 'X-Frame-Options: SAMEORIGIN present');
    assert(homeRes.headers['x-xss-protection'] === '1; mode=block', 'X-XSS-Protection present');
    assert(homeRes.headers['referrer-policy'] === 'strict-origin-when-cross-origin', 'Referrer-Policy present');

    // ----------------------------------------------------
    // TEST 2: Unauthenticated Public Data Redaction
    // ----------------------------------------------------
    console.log('\n2. Testing Public Data Redaction (Unauthenticated)...');
    const pubData = await makeRequest('GET', '/api/data');
    assert(pubData.statusCode === 200, 'Public /api/data returns HTTP 200');
    assert(pubData.data.authenticated === false, 'data.authenticated is strictly FALSE');
    assert(Array.isArray(pubData.data.projects) && pubData.data.projects.length > 0, 'Public project showcase is visible');
    assert(Array.isArray(pubData.data.inventory) && pubData.data.inventory.length === 0, 'Inventory stock is strictly REDACTED ([])');
    assert(Array.isArray(pubData.data.salaryPayments) && pubData.data.salaryPayments.length === 0, 'Salary payments are strictly REDACTED ([])');
    assert(Array.isArray(pubData.data.vendorBills) && pubData.data.vendorBills.length === 0, 'Vendor dues/bills are strictly REDACTED ([])');

    // ----------------------------------------------------
    // TEST 3: Protected Mutation Access Control (Unauthorized)
    // ----------------------------------------------------
    console.log('\n3. Testing Protected Mutation Access Control...');
    const unauthAdd = await makeRequest('POST', '/api/inventory', { name: 'Unauthorized Cement', quantity: 100 });
    assert(unauthAdd.statusCode === 401, 'POST /api/inventory without token blocked with 401');

    const unauthCred = await makeRequest('POST', '/api/auth/update-credentials', { username: 'hacker' });
    assert(unauthCred.statusCode === 401, 'POST /api/auth/update-credentials without token blocked with 401');

    // ----------------------------------------------------
    // TEST 4: Director Authentication & Full Enterprise Access
    // ----------------------------------------------------
    console.log('\n4. Testing Director Authentication & Enterprise Privileges...');
    const dirLogin = await makeRequest('POST', '/api/auth/login', { username: 'amitus', password: 'amitus2001' });
    assert(dirLogin.statusCode === 200, 'Director login with password succeeds (HTTP 200)');
    assert(dirLogin.data.success === true, 'dirLogin.data.success is true');
    assert(dirLogin.data.role === 'director', 'Director role confirmed');
    const dirToken = dirLogin.data.token;
    assert(typeof dirToken === 'string' && dirToken.length === 64, 'High-entropy 64-char hex session token issued');

    // Test Director Data Load
    const dirData = await makeRequest('GET', '/api/data', null, { Authorization: `Bearer ${dirToken}` });
    assert(dirData.statusCode === 200, 'Director /api/data returns HTTP 200');
    assert(dirData.data.authenticated === true, 'Director authenticated flag is TRUE');
    assert(dirData.data.role === 'director', 'Role is director');
    assert(Array.isArray(dirData.data.inventory) && dirData.data.inventory.length > 0, 'Full inventory stock loaded for Director');
    assert(Array.isArray(dirData.data.flats) && dirData.data.flats.length > 0, 'Flat booking inventory loaded for Director');

    // Test Director PIN Login
    const dirPinLogin = await makeRequest('POST', '/api/auth/login', { username: 'amitus', pin: '77877' });
    assert(dirPinLogin.statusCode === 200, 'Director login via 5-digit PIN (77877) succeeds');

    // ----------------------------------------------------
    // TEST 5: Site Supervisor Authentication & Role Boundary
    // ----------------------------------------------------
    console.log('\n5. Testing Site Supervisor Field Role Boundary...');
    const supLogin = await makeRequest('POST', '/api/auth/login', { username: 'supervisor', pin: '1234' });
    assert(supLogin.statusCode === 200, 'Supervisor login via PIN (1234) succeeds (HTTP 200)');
    assert(supLogin.data.role === 'supervisor', 'Supervisor role confirmed');
    const supToken = supLogin.data.token;

    // Test Supervisor Data Filtering
    const supData = await makeRequest('GET', '/api/data', null, { Authorization: `Bearer ${supToken}` });
    assert(supData.statusCode === 200, 'Supervisor /api/data returns HTTP 200');
    assert(supData.data.role === 'supervisor', 'Supervisor role verified in data payload');
    assert(Array.isArray(supData.data.inventory), 'Supervisor receives site inventory');
    assert(supData.data.salaryPayments.length === 0, 'Supervisor CANNOT see salary disbursements');
    assert(supData.data.vendorBills.length === 0, 'Supervisor CANNOT see supplier debts');

    // Test Supervisor Attempt to Change Credentials (Forbidden)
    const supChangeCred = await makeRequest('POST', '/api/auth/update-credentials', { pin: '99999' }, { Authorization: `Bearer ${supToken}` });
    assert(supChangeCred.statusCode === 403, 'Supervisor attempt to update credentials rejected with 403 Forbidden');

    // ----------------------------------------------------
    // TEST 6: Google Sign-In Endpoint
    // ----------------------------------------------------
    console.log('\n6. Testing Google Sign-In Authorization...');
    const googleLogin = await makeRequest('POST', '/api/auth/google', { email: 'amitusinfra2014@gmail.com' });
    assert(googleLogin.statusCode === 200, 'Authorized Director Google email succeeds');
    assert(googleLogin.data.role === 'director', 'Google authentication assigns Director role');

    const unauthorizedGoogle = await makeRequest('POST', '/api/auth/google', { email: 'unauthorized_stranger@gmail.com' });
    assert(unauthorizedGoogle.statusCode === 403, 'Unauthorized Google email rejected with 403 Forbidden');

    // ----------------------------------------------------
    // TEST 7: Brute Force Rate Limiting
    // ----------------------------------------------------
    console.log('\n7. Testing Brute Force Rate Limiter...');
    // We send 5 wrong PIN attempts with a dedicated test header
    const testIpHeader = { 'x-forwarded-for': '203.0.113.195' };
    for (let i = 1; i <= 5; i++) {
      await makeRequest('POST', '/api/auth/login', { username: 'amitus', pin: '00000' }, testIpHeader);
    }
    // The 6th attempt must be locked out with HTTP 429
    const blockedAttempt = await makeRequest('POST', '/api/auth/login', { username: 'amitus', pin: '00000' }, testIpHeader);
    assert(blockedAttempt.statusCode === 429, '6th consecutive bad attempt blocked with HTTP 429 Too Many Requests');
    assert(blockedAttempt.data.error.includes('Too many failed attempts'), 'Rate limit lock message received');

    // ----------------------------------------------------
    // TEST 8: Session Logout & Invalidation
    // ----------------------------------------------------
    console.log('\n8. Testing Session Invalidation (Logout)...');
    const logoutRes = await makeRequest('POST', '/api/auth/logout', null, { Authorization: `Bearer ${dirToken}` });
    assert(logoutRes.statusCode === 200, 'POST /api/auth/logout succeeds');

    const verifyAfterLogout = await makeRequest('POST', '/api/auth/verify', null, { Authorization: `Bearer ${dirToken}` });
    assert(verifyAfterLogout.statusCode === 401, 'Logged out token is invalidated and rejected with 401');

    console.log('\n======================================================');
    console.log(`🎯 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('======================================================\n');

    process.exit(failedTests > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTestSuite();
