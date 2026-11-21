const http = require('http');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectDB = require('../config/db');
const { app } = require('../server');
const mongoose = require('mongoose');

// Simple JSON request helper
const makeRequest = (port, options, body = null) => {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: '127.0.0.1',
      port,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try {
          parsed = data ? JSON.parse(data) : {};
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, data: parsed });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const runSuite = async () => {
  console.log('🧪 Starting MockMate Pro Test Suite...\n');
  let passed = 0;
  let failed = 0;

  const assert = (condition, title, details = '') => {
    if (condition) {
      console.log(`  ✅ PASS: ${title}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${title} ${details ? `(${details})` : ''}`);
      failed++;
    }
  };

  // 1. Establish DB Connection
  await connectDB();
  assert(mongoose.connection.readyState === 1, 'MongoDB connection established');

  // 2. Start HTTP server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`  🌐 Test server listening on http://127.0.0.1:${port}\n`);

  try {
    // 3. Health Check
    console.log('📌 Testing System & Health');
    const health = await makeRequest(port, { path: '/' });
    assert(health.status === 200 && health.data?.message?.includes('MockMate Pro API'), 'GET / (Health check)');

    // 4. Auth: Demo Login
    console.log('\n📌 Testing Authentication & Profiles');
    const loginRes = await makeRequest(port, { path: '/api/auth/login', method: 'POST' }, {
      email: 'testuser@gmail.com',
      password: 'testpassword@1234',
    });
    assert(loginRes.status === 200 && Boolean(loginRes.data?.token), 'POST /api/auth/login (Demo login)');
    const token = loginRes.data?.token;

    // 5. Auth: Get Profile
    const meRes = await makeRequest(port, {
      path: '/api/auth/me',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(meRes.status === 200 && meRes.data?.user?.email === 'testuser@gmail.com', 'GET /api/auth/me');

    // 6. Auth: Update Profile
    const updateRes = await makeRequest(port, {
      path: '/api/auth/me',
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    }, { name: 'Demo Candidate Updated' });
    assert(updateRes.status === 200 && updateRes.data?.user?.name === 'Demo Candidate Updated', 'PATCH /api/auth/me');

    // 7. Auth: Registration & OTP Verification Flow
    const testRegEmail = `candidate_${Date.now()}@example.com`;
    const regRes = await makeRequest(port, { path: '/api/auth/register', method: 'POST' }, {
      name: 'Automated Tester',
      email: testRegEmail,
      password: 'password12345',
    });
    assert(regRes.status === 200 && regRes.data?.success, 'POST /api/auth/register');
    const devOtp = regRes.data?.devOtp;

    if (devOtp) {
      const verifyRes = await makeRequest(port, { path: '/api/auth/verify-otp', method: 'POST' }, {
        email: testRegEmail,
        otp: devOtp,
      });
      assert(verifyRes.status === 201 && verifyRes.data?.user?.email === testRegEmail, 'POST /api/auth/verify-otp (creates user)');
      assert(typeof verifyRes.data?.token === 'string' && verifyRes.data.token.length > 20, 'POST /api/auth/verify-otp (returns JWT for auto-login)');
    }

    // 8. Sessions: Roles and Config
    console.log('\n📌 Testing Practice Sessions & AI Questions');
    const rolesRes = await makeRequest(port, {
      path: '/api/sessions/roles',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(rolesRes.status === 200 && Array.isArray(rolesRes.data?.roles) && rolesRes.data.roles.length > 0, 'GET /api/sessions/roles');

    const configRes = await makeRequest(port, {
      path: '/api/sessions/config',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(configRes.status === 200 && configRes.data?.config?.difficulties?.length > 0, 'GET /api/sessions/config');

    // 9. Sessions: Start Practice Session (with count: 5)
    const startSessionRes = await makeRequest(port, {
      path: '/api/sessions/start',
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }, {
      role: 'Full Stack Developer',
      difficulty: 'medium',
      count: 5,
      durationMinutes: 15,
      type: 'practice',
    });
    assert(
      startSessionRes.status === 201 &&
      Array.isArray(startSessionRes.data?.session?.questions) &&
      startSessionRes.data.session.questions.length === 5,
      'POST /api/sessions/start (Generates 5 questions)'
    );
    const sessionId = startSessionRes.data?.session?.id;

    // 10. Sessions: Get Session Details
    const getSessionRes = await makeRequest(port, {
      path: `/api/sessions/${sessionId}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(getSessionRes.status === 200 && getSessionRes.data?.session?._id === sessionId, 'GET /api/sessions/:id');

    // 11. Sessions: Submit Session Answers
    const questions = startSessionRes.data?.session?.questions || [];
    const answers = questions.map((q) => ({
      questionId: q.questionId,
      userAnswer: q.correctAnswer || 'A',
    }));
    const submitRes = await makeRequest(port, {
      path: `/api/sessions/${sessionId}/submit`,
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }, { answers });
    assert(
      submitRes.status === 200 &&
      submitRes.data?.result?.overallScore !== undefined &&
      submitRes.data.result.completedAt,
      'POST /api/sessions/:id/submit (Evaluates & saves score)'
    );

    // 12. Sessions: History
    const historyRes = await makeRequest(port, {
      path: '/api/sessions/history',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(historyRes.status === 200 && Array.isArray(historyRes.data?.sessions), 'GET /api/sessions/history');

    // 13. Companies: List
    console.log('\n📌 Testing Companies & Modules');
    const companiesRes = await makeRequest(port, {
      path: '/api/companies',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(companiesRes.status === 200 && Array.isArray(companiesRes.data?.companies) && companiesRes.data.companies.length >= 3, 'GET /api/companies');

    // 14. Plans: List
    console.log('\n📌 Testing Subscription Plans & Payments');
    const plansRes = await makeRequest(port, {
      path: '/api/plans',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(plansRes.status === 200 && Array.isArray(plansRes.data?.plans) && plansRes.data.plans.length === 3, 'GET /api/plans');

    // 15. Payments: Transaction History
    const txRes = await makeRequest(port, {
      path: '/api/payments/transaction-history',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(txRes.status === 200 && Array.isArray(txRes.data?.transactions), 'GET /api/payments/transaction-history');

    // 16. Live Interview Simulation Flow
    console.log('\n📌 Testing Live Interview Simulation Flow');
    const startInterviewRes = await makeRequest(port, {
      path: '/api/interview/start',
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }, {
      role: 'Frontend Developer',
      level: 'junior',
    });
    assert(startInterviewRes.status === 201 && Boolean(startInterviewRes.data?.firstQuestion), 'POST /api/interview/start (Starts interview round)');
    const interviewId = startInterviewRes.data?.session?.id;

    // 17. Live Interview: Respond to question
    const respondRes = await makeRequest(port, {
      path: `/api/interview/${interviewId}/respond`,
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }, {
      userAnswer: 'I have worked extensively with React hooks, context, state optimization and Redux toolkit in production.',
      conversationHistory: [
        { role: 'assistant', content: startInterviewRes.data?.firstQuestion },
      ],
      questionNumber: 1,
      totalQuestions: 5,
      level: 'Junior',
    });
    assert(respondRes.status === 200 && respondRes.data?.success, 'POST /api/interview/:id/respond (Real-time reaction & follow-up)');

    // 18. Live Interview: Finish interview
    const finishRes = await makeRequest(port, {
      path: `/api/interview/${interviewId}/finish`,
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }, {
      conversationHistory: [
        { role: 'assistant', content: startInterviewRes.data?.firstQuestion },
        { role: 'user', content: 'I have built responsive SPAs with React, TypeScript and Tailwind CSS.' },
        { role: 'assistant', content: respondRes.data?.nextQuestion || 'How do you handle performance bottlenecks?' },
        { role: 'user', content: 'I use React Profiler, React.memo, useCallback, and dynamic imports with code splitting.' },
      ],
      level: 'Junior',
    });
    assert(
      finishRes.status === 200 &&
      finishRes.data?.evaluation?.overallScore !== undefined &&
      Array.isArray(finishRes.data?.evaluation?.strengths) &&
      Array.isArray(finishRes.data?.evaluation?.improvements),
      'POST /api/interview/:id/finish (Generates full rubric scorecard)'
    );

  } catch (error) {
    console.error('Unhandled test execution error:', error);
    failed++;
  } finally {
    server.close();
    await mongoose.disconnect();
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
