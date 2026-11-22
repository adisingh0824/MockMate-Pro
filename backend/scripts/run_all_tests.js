const http = require('http');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { initFirebase, getDb, getFirebaseAuth } = require('../config/firebase');
const Transaction = require('../models/Transaction');
require('../utils/sendEmail').sendOtpEmail = async (_email, _name, otp) => ({
  success: true,
  simulated: true,
  otp,
});
const { app } = require('../server');

if (process.env.NODE_ENV === 'production') {
  throw new Error('The API smoke suite cannot run against a production environment');
}

// Keep this suite deterministic, free of email delivery, and free of paid AI calls.
delete process.env.RESEND_API_KEY;
delete process.env.OPENROUTER_API_KEY;
delete process.env.OPENAI_API_KEY;

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
  const cleanup = { sessionIds: [], transactionIds: [], testEmail: null, testUserId: null };

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
  await initFirebase();
  assert(Boolean(getDb()), 'Firebase Cloud Firestore connection established');

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

    // 4. Auth: Demo Login (read-only)
    console.log('\n📌 Testing Authentication & Profiles');
    const loginRes = await makeRequest(port, { path: '/api/auth/login', method: 'POST' }, {
      email: 'testuser@gmail.com',
      password: 'testpassword@1234',
    });
    assert(loginRes.status === 200 && Boolean(loginRes.data?.token), 'POST /api/auth/login (Demo login)');
    const token = loginRes.data?.token;

    // 5. Auth: Registration & OTP Verification Flow
    const testRegEmail = `candidate_${Date.now()}@example.com`;
    cleanup.testEmail = testRegEmail;
    const regRes = await makeRequest(port, { path: '/api/auth/register', method: 'POST' }, {
      name: 'Automated Tester',
      email: testRegEmail,
      password: 'password12345',
    });
    assert(regRes.status === 200 && regRes.data?.success, 'POST /api/auth/register');
    let devOtp = regRes.data?.devOtp;

    const resendOtpRes = await makeRequest(port, { path: '/api/auth/resend-otp', method: 'POST' }, {
      email: testRegEmail,
    });
    assert(resendOtpRes.status === 200 && Boolean(resendOtpRes.data?.devOtp), 'POST /api/auth/resend-otp');
    if (resendOtpRes.data?.devOtp) devOtp = resendOtpRes.data.devOtp;

    if (devOtp) {
      const verifyRes = await makeRequest(port, { path: '/api/auth/verify-otp', method: 'POST' }, {
        email: testRegEmail,
        otp: devOtp,
      });
      assert(verifyRes.status === 201 && verifyRes.data?.user?.email === testRegEmail, 'POST /api/auth/verify-otp (creates user)');
      assert(typeof verifyRes.data?.token === 'string' && verifyRes.data.token.length > 20, 'POST /api/auth/verify-otp (returns JWT for auto-login)');
      cleanup.testUserId = verifyRes.data?.user?.id;
    }

    const forgotPasswordRes = await makeRequest(port, { path: '/api/auth/forgot-password', method: 'POST' }, {
      email: testRegEmail,
    });
    assert(forgotPasswordRes.status === 200 && Boolean(forgotPasswordRes.data?.devOtp), 'POST /api/auth/forgot-password');

    const updatedTestPassword = 'reset-password-test-12345';
    const resetPasswordRes = await makeRequest(port, { path: '/api/auth/reset-password', method: 'POST' }, {
      email: testRegEmail,
      otp: forgotPasswordRes.data?.devOtp,
      password: updatedTestPassword,
    });
    assert(resetPasswordRes.status === 200, 'POST /api/auth/reset-password (updates account password)');

    const oldPasswordLogin = await makeRequest(port, { path: '/api/auth/login', method: 'POST' }, {
      email: testRegEmail,
      password: 'password12345',
    });
    assert(oldPasswordLogin.status === 401, 'POST /api/auth/login (rejects password replaced by reset)');

    const newPasswordLogin = devOtp ? await makeRequest(port, { path: '/api/auth/login', method: 'POST' }, {
      email: testRegEmail,
      password: updatedTestPassword,
    }) : null;
    if (devOtp) {
      assert(newPasswordLogin.status === 200 && Boolean(newPasswordLogin.data?.token), 'POST /api/auth/login (accepts reset password)');
    }
    const sessionToken = newPasswordLogin?.data?.token || token;

    // 6. Auth: Get and update the disposable profile, never the demo profile.
    const meRes = await makeRequest(port, {
      path: '/api/auth/me',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    assert(meRes.status === 200, 'GET /api/auth/me');
    const updateRes = await makeRequest(port, {
      path: '/api/auth/me',
      method: 'PATCH',
      headers: { Authorization: `Bearer ${sessionToken}` },
    }, { name: 'Automated Tester Updated' });
    assert(updateRes.status === 200 && updateRes.data?.user?.name === 'Automated Tester Updated', 'PATCH /api/auth/me');

    // 7. Sessions: Roles and Config
    console.log('\n📌 Testing Practice Sessions & AI Questions');
    const rolesRes = await makeRequest(port, {
      path: '/api/sessions/roles',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    assert(rolesRes.status === 200 && Array.isArray(rolesRes.data?.roles) && rolesRes.data.roles.length > 0, 'GET /api/sessions/roles');

    const configRes = await makeRequest(port, {
      path: '/api/sessions/config',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    assert(configRes.status === 200 && configRes.data?.config?.difficulties?.length > 0, 'GET /api/sessions/config');

    const invalidDifficultyRes = await makeRequest(port, {
      path: '/api/sessions/start',
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    }, { role: 'Full Stack Developer', difficulty: 'impossible', count: 5 });
    assert(invalidDifficultyRes.status === 400, 'POST /api/sessions/start (rejects unknown difficulty)');

    const freeCompanySessionRes = await makeRequest(port, {
      path: '/api/sessions/start',
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    }, { role: 'Software Engineer', company: 'Google', difficulty: 'medium', count: 5 });
    assert(freeCompanySessionRes.status === 403, 'POST /api/sessions/start (protects premium company tracks)');

    const invalidTypeRes = await makeRequest(port, {
      path: '/api/sessions/start',
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    }, { role: 'Full Stack Developer', difficulty: 'medium', count: 5, type: 'unsupported' });
    assert(invalidTypeRes.status === 400, 'POST /api/sessions/start (rejects unknown session type)');

    const legacyTypeRes = await makeRequest(port, {
      path: '/api/sessions/start',
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    }, { role: 'Backend Developer', difficulty: 'easy', count: 2, type: 'interview' });
    assert(legacyTypeRes.status === 201 && legacyTypeRes.data?.session?.type === 'practice', 'POST /api/sessions/start (normalizes legacy MCQ interview type)');
    if (legacyTypeRes.data?.session?.id) cleanup.sessionIds.push(legacyTypeRes.data.session.id);

    // 8. Sessions: Start Practice Session (with count: 5)
    const startSessionRes = await makeRequest(port, {
      path: '/api/sessions/start',
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
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
    if (sessionId) cleanup.sessionIds.push(sessionId);

    // 10. Sessions: Get Session Details
    const getSessionRes = await makeRequest(port, {
      path: `/api/sessions/${sessionId}`,
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    assert(getSessionRes.status === 200 && getSessionRes.data?.session?._id === sessionId, 'GET /api/sessions/:id');
    assert(
      (getSessionRes.data?.session?.questions || []).every((question) =>
        !Object.hasOwn(question, 'correctAnswer') && !Object.hasOwn(question, 'explanation')),
      'GET /api/sessions/:id (Hides answer keys before completion)'
    );

    // 11. Sessions: Save and restore the in-progress answer draft.
    const questions = startSessionRes.data?.session?.questions || [];
    const answers = questions.map((q) => ({
      questionId: q.questionId,
      userAnswer: q.options?.[0] || 'A',
    }));
    const draftRes = await makeRequest(port, {
      path: `/api/sessions/${sessionId}/answers`,
      method: 'PATCH',
      headers: { Authorization: `Bearer ${sessionToken}` },
    }, { answers });
    assert(draftRes.status === 200, 'PATCH /api/sessions/:id/answers (Saves answer draft)');
    const restoredRes = await makeRequest(port, {
      path: `/api/sessions/${sessionId}`,
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    assert(
      restoredRes.status === 200 &&
      restoredRes.data?.session?.questions?.every((question, index) => question.userAnswer === answers[index]?.userAnswer),
      'GET /api/sessions/:id (Restores answer draft)'
    );

    // 12. Sessions: Submit Session Answers
    const submitRes = await makeRequest(port, {
      path: `/api/sessions/${sessionId}/submit`,
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    }, { answers });
    assert(
      submitRes.status === 200 &&
      submitRes.data?.result?.overallScore !== undefined &&
      submitRes.data.result.completedAt,
      'POST /api/sessions/:id/submit (Evaluates & saves score)'
    );

    // 13. Sessions: History
    const historyRes = await makeRequest(port, {
      path: '/api/sessions/history',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    assert(historyRes.status === 200 && Array.isArray(historyRes.data?.sessions), 'GET /api/sessions/history');

    // 14. Companies: List
    console.log('\n📌 Testing Companies & Modules');
    const companiesRes = await makeRequest(port, {
      path: '/api/companies',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    assert(companiesRes.status === 200 && Array.isArray(companiesRes.data?.companies) && companiesRes.data.companies.length >= 3, 'GET /api/companies');

    // 15. Plans: List
    console.log('\n📌 Testing Subscription Plans & Payments');
    const plansRes = await makeRequest(port, {
      path: '/api/plans',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    assert(plansRes.status === 200 && Array.isArray(plansRes.data?.plans) && plansRes.data.plans.length === 3, 'GET /api/plans');

    // 16. Payments: Transaction History
    const txRes = await makeRequest(port, {
      path: '/api/payments/transaction-history',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    assert(txRes.status === 200 && Array.isArray(txRes.data?.transactions), 'GET /api/payments/transaction-history');

    const pendingTransaction = await Transaction.create({
      user: cleanup.testUserId,
      planId: 'pro',
      planName: 'Pro',
      planPrice: '₹599',
      planPeriod: '/month',
      razorpayOrderId: `test_order_${Date.now()}`,
      amount: 59900,
      currency: 'INR',
      status: 'pending',
    });
    cleanup.transactionIds.push(pendingTransaction._id);
    const cancelTransactionRes = await makeRequest(port, {
      path: `/api/payments/cancel-transaction/${pendingTransaction._id}`,
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    assert(cancelTransactionRes.status === 200 && cancelTransactionRes.data?.transaction?.status === 'cancelled', 'POST /api/payments/cancel-transaction/:id');
    const cancelAgainRes = await makeRequest(port, {
      path: `/api/payments/cancel-transaction/${pendingTransaction._id}`,
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    assert(cancelAgainRes.status === 400, 'POST /api/payments/cancel-transaction/:id (rejects repeated cancellation)');

    // 17. Live Interview Simulation Flow
    console.log('\n📌 Testing Live Interview Simulation Flow');
    const startInterviewRes = await makeRequest(port, {
      path: '/api/interview/start',
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
    }, {
      role: 'Frontend Developer',
      level: 'junior',
    });
    assert(startInterviewRes.status === 201 && Boolean(startInterviewRes.data?.firstQuestion), 'POST /api/interview/start (Starts interview round)');
    const interviewId = startInterviewRes.data?.session?.id;
    if (interviewId) cleanup.sessionIds.push(interviewId);

    // 18. Live Interview: Respond to question
    const respondRes = await makeRequest(port, {
      path: `/api/interview/${interviewId}/respond`,
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
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

    // 19. Live Interview: Finish interview
    const finishRes = await makeRequest(port, {
      path: `/api/interview/${interviewId}/finish`,
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken}` },
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
    try {
      const db = getDb();
      const batch = db.batch();
      cleanup.sessionIds.forEach((id) => batch.delete(db.collection('sessions').doc(id)));
      cleanup.transactionIds.forEach((id) => batch.delete(db.collection('transactions').doc(id)));

      if (cleanup.testEmail) {
        const [userDocs, otpDocs] = await Promise.all([
          db.collection('users').where('email', '==', cleanup.testEmail).get(),
          db.collection('otps').where('email', '==', cleanup.testEmail).get(),
        ]);
        userDocs.docs.forEach((doc) => batch.delete(doc.ref));
        otpDocs.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();

        const firebaseAuth = getFirebaseAuth();
        try {
          const authUser = cleanup.testUserId
            ? await firebaseAuth.getUser(cleanup.testUserId)
            : await firebaseAuth.getUserByEmail(cleanup.testEmail);
          await firebaseAuth.deleteUser(authUser.uid);
        } catch (err) {
          if (err.code !== 'auth/user-not-found') throw err;
        }
      } else {
        await batch.commit();
      }
    } catch (cleanupError) {
      console.error('Test data cleanup failed:', cleanupError.message);
      failed++;
    }
    await new Promise((resolve) => server.close(resolve));
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
