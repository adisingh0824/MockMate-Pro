const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

let db = null;
let auth = null;

const initFirebase = async () => {
  if (admin.getApps().length === 0) {
    let serviceAccountPath = path.resolve(__dirname, './firebase-service-account.json');
    if (!fs.existsSync(serviceAccountPath) && process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      serviceAccountPath = path.resolve(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    }

    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
      });
      console.log(`🔥 Firebase Admin initialized for project: ${serviceAccount.project_id}`);
    } else {
      console.warn('⚠️ Firebase service account file not found at:', serviceAccountPath);
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'mockmate-pro-f2f13',
      });
    }
  }

  db = getFirestore();
  auth = getAuth();

  // Bootstrap seed data in Firestore
  await seedFirestoreData();

  return { admin, db, auth };
};

const seedFirestoreData = async () => {
  try {
    if (!db) return;

    // 1. Seed demo user in Firebase Auth & Firestore
    const demoEmail = 'testuser@gmail.com';
    let demoUid = null;
    try {
      const existingUser = await auth.getUserByEmail(demoEmail);
      demoUid = existingUser.uid;
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        const newUser = await auth.createUser({
          email: demoEmail,
          password: 'testpassword@1234',
          displayName: 'Demo Candidate',
        });
        demoUid = newUser.uid;
        console.log('✅ Demo user created in Firebase Auth: testuser@gmail.com');
      }
    }

    if (demoUid) {
      const userDocRef = db.collection('users').doc(demoUid);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        const hashedPassword = await bcrypt.hash('testpassword@1234', 10);
        await userDocRef.set({
          uid: demoUid,
          name: 'Demo Candidate',
          email: demoEmail,
          password: hashedPassword,
          isPremium: true,
          createdAt: new Date().toISOString(),
        });
        console.log('✅ Demo user seeded in Firestore');
      }
    }

    // 2. Default Roles
    const rolesSnapshot = await db.collection('roles').limit(1).get();
    if (rolesSnapshot.empty) {
      const DEFAULT_ROLES = [
        { name: 'Frontend Developer', slug: 'frontend-developer', sortOrder: 1, isActive: true },
        { name: 'Backend Developer', slug: 'backend-developer', sortOrder: 2, isActive: true },
        { name: 'Full Stack Developer', slug: 'full-stack-developer', sortOrder: 3, isActive: true },
        { name: 'DevOps Engineer', slug: 'devops-engineer', sortOrder: 4, isActive: true },
        { name: 'Data Analyst', slug: 'data-analyst', sortOrder: 5, isActive: true },
        { name: 'Data Scientist', slug: 'data-scientist', sortOrder: 6, isActive: true },
        { name: 'Machine Learning Engineer', slug: 'machine-learning-engineer', sortOrder: 7, isActive: true },
        { name: 'QA Engineer', slug: 'qa-engineer', sortOrder: 8, isActive: true },
        { name: 'Product Manager', slug: 'product-manager', sortOrder: 9, isActive: true },
        { name: 'UI/UX Designer', slug: 'ui-ux-designer', sortOrder: 10, isActive: true },
      ];
      const batch = db.batch();
      for (const role of DEFAULT_ROLES) {
        const ref = db.collection('roles').doc(role.slug);
        batch.set(ref, role);
      }
      await batch.commit();
      console.log('✅ Default roles initialized in Firestore');
    }

    // 3. Default Interview Config
    const configDocRef = db.collection('interviewConfig').doc('default');
    const configDoc = await configDocRef.get();
    if (!configDoc.exists) {
      await configDocRef.set({
        key: 'default',
        difficulties: [
          { value: 'easy', label: 'Easy', description: 'Beginner level', sortOrder: 1, isActive: true },
          { value: 'medium', label: 'Medium', description: 'Intermediate level', sortOrder: 2, isActive: true },
          { value: 'hard', label: 'Hard', description: 'Advanced level', sortOrder: 3, isActive: true },
        ],
        questionCounts: [5, 10, 15, 20, 25],
        defaultDifficulty: 'medium',
        defaultQuestionCount: 5,
      });
      console.log('✅ Default interview config initialized in Firestore');
    }

    // 4. Default Subscription Plans
    const plansSnapshot = await db.collection('plans').limit(1).get();
    if (plansSnapshot.empty) {
      const DEFAULT_PLANS = [
        {
          planId: 'basic',
          name: 'Basic',
          price: '₹299',
          period: '/month',
          badge: null,
          features: [
            '5 scheduled interviews/month',
            'Company-specific questions',
            'AI feedback report',
            'Email reminders',
          ],
          cta: 'Get Basic',
          highlight: false,
          sortOrder: 1,
          isActive: true,
        },
        {
          planId: 'pro',
          name: 'Pro',
          price: '₹599',
          period: '/month',
          badge: 'Most Popular',
          features: [
            'Unlimited scheduled interviews',
            'Company-specific questions',
            'Detailed AI feedback report',
            'Email & SMS reminders',
            'Resume-based questions',
            'Priority support',
          ],
          cta: 'Get Pro',
          highlight: true,
          sortOrder: 2,
          isActive: true,
        },
        {
          planId: 'yearly',
          name: 'Pro Yearly',
          price: '₹4,999',
          period: '/year',
          badge: 'Best Value',
          features: [
            'Everything in Pro',
            '2 months free',
            'Exclusive company guides',
            'Mock panel interviews',
            'Career coaching session',
          ],
          cta: 'Get Yearly',
          highlight: false,
          sortOrder: 3,
          isActive: true,
        },
      ];
      const batch = db.batch();
      for (const plan of DEFAULT_PLANS) {
        const ref = db.collection('plans').doc(plan.planId);
        batch.set(ref, plan);
      }
      await batch.commit();
      console.log('✅ Default subscription plans initialized in Firestore');
    }

    // 5. Default Companies
    const companiesSnapshot = await db.collection('companies').limit(1).get();
    if (companiesSnapshot.empty) {
      const DEFAULT_COMPANIES = [
        {
          name: 'Google',
          slug: 'google',
          logo: '🔵',
          color: 'from-blue-50 to-indigo-50',
          border: 'border-blue-100',
          sortOrder: 1,
          roles: [
            { title: 'Software Engineer (SDE-1)', level: 'Entry', questions: 8, sortOrder: 1 },
            { title: 'Software Engineer (SDE-2)', level: 'Mid', questions: 10, sortOrder: 2 },
            { title: 'Senior Software Engineer', level: 'Senior', questions: 10, sortOrder: 3 },
            { title: 'Product Manager', level: 'Mid', questions: 8, sortOrder: 4 },
          ],
        },
        {
          name: 'Amazon',
          slug: 'amazon',
          logo: '🟠',
          color: 'from-orange-50 to-amber-50',
          border: 'border-orange-100',
          sortOrder: 2,
          roles: [
            { title: 'SDE-1', level: 'Entry', questions: 8, sortOrder: 1 },
            { title: 'SDE-2', level: 'Mid', questions: 10, sortOrder: 2 },
            { title: 'SDE-3', level: 'Senior', questions: 10, sortOrder: 3 },
            { title: 'Data Engineer', level: 'Mid', questions: 8, sortOrder: 4 },
          ],
        },
        {
          name: 'Microsoft',
          slug: 'microsoft',
          logo: '🟦',
          color: 'from-sky-50 to-blue-50',
          border: 'border-sky-100',
          sortOrder: 3,
          roles: [
            { title: 'Software Engineer', level: 'Entry', questions: 8, sortOrder: 1 },
            { title: 'Senior SDE', level: 'Senior', questions: 10, sortOrder: 2 },
            { title: 'Cloud Architect', level: 'Senior', questions: 10, sortOrder: 3 },
          ],
        },
      ];
      const batch = db.batch();
      for (const comp of DEFAULT_COMPANIES) {
        const ref = db.collection('companies').doc(comp.slug);
        batch.set(ref, comp);
      }
      await batch.commit();
      console.log('✅ Default companies initialized in Firestore');
    }
  } catch (err) {
    console.warn(`⚠️ Firestore seeding notice: ${err.message}`);
  }
};

const getDb = () => {
  if (!db) {
    db = getFirestore();
  }
  return db;
};

const getFirebaseAuth = () => {
  if (!auth) {
    auth = getAuth();
  }
  return auth;
};

module.exports = {
  initFirebase,
  getDb,
  getFirebaseAuth,
  admin,
};
