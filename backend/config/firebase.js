const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const DEFAULT_SERVICE_ACCOUNT = {
  type: "service_account",
  project_id: "mockmate-pro-f2f13",
  private_key_id: "d3428a75b38290c2d39f0577fcea5e0c7fc7e199",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCiJrjV3ngXFdyY\nIPRfL5dO8xnes7Uv9ED79NgPoi5uUzYH9nP1Xq8ZVDG+3bZBcH2Nq52qUKVxc/bU\nYbC0qaf2bYgJ0UpvY7L5UXp9MRVIeuS0yqpczvCLNZS70F/XgOxilp+RffDGWhih\nUkhHmdMYGKdXvJiprxI7jAU6qrgMkbskR1Zg8pj9iIB8nb7PZU0zuGYrQZKwYFv+\nsn6wPFrtYUih/tr34N6gVFCuIs8JnsEz3vD0Jmb9yP7BLwto3FU6oA0Pi+ZH2VF2\nSOC47Tz/j+k4qPGF3VM+GSO37AS6V7LdlDVVI+DToJAnbAyGGT0zQwuyUIFVC3la\nLeSpA5/nAgMBAAECggEAKUuoRhtmxSZVrE60PaueosYpv/xPeBuCE0jLX8vjfEhn\n2cZLyOEowdAd7SiE2oyeBR8AQ9hPEiJA6dzJRnFwq8NAYpOxG8Yt1e4IvmpqK6/U\noDB/C6zOOP3X168dQYJ9cSxADisfTzyxyh/s9YM47gmVULRgwtIp2A10ZXkF73kj\n+FKaCit9oaNWygIkOdPUQrxYLQmtnpCT37TxiHnaiTJRg4D7M9eoGKNEa8xBWrS5\nVm6RDXTBD2Uiug5iLEe4xA9qNjrC+oiV1de/cA943CQKU4bjYkfQMS+NKY2GMHV1\nNrZuG/6vtuVY8lVdBn8WNlwsLViDtkiBjxHLyop50QKBgQDRyNYv0BbiRtr0AOb/\nehRAYBBjmZnR87W7JzBCnTwJ0Yyr6zHMWbeNTr+GI3Li/TZOYUjBV1m8CaDWCPPE\nw77TGY0OeHb/fbZaEj8D+lBjMVm9W9ReBtkPMyhsdiChT3l5GslOKwPrleOk7Pqi\nojUIoo+OvFQhfQr2n1Eyo4bCFwKBgQDF34ZPxmsW36V3eujgU2/VDnvcWyF1QS80\nLMiUOyKRCXkcFYdrSwn1vPz1cPpXDCNtMuVWm/OA5vKij/O8VtDoyFVCKOih9pHq\nkbq2q7eziQnYRtvwloTsAon55EKVnI2wwjkOWMdYxMQD37DK7bqkxYzZ2RIVpCvb\nxCjAV47CsQKBgQCHco6oLEi6LFluNa7vwJiWv++U/zWLkzkA71p/iBmdlUioL6Dl\nef/DItcR+o1Q9YA8tx9MheOQPv8zcnBB2Mi6b8LdVvYuG7LDEQjSvqlsgg6Y7lN9\nqho3cCZncRW8UR3zDVJwP+G2F/71G3Tv0J9BRgQ+emYvgRa1CURZ169IXQKBgAiu\nLJs1Th9bwkuChdLJdj93ejGJgec9688zI7109qg8LSbxPtaTHSW9m688vI6zBp7U\nu8DX6I/AEebVv9CEUnfTygGz/7iTM4WBzRoUYGOs4FSvjxh30e70kY7313/utTyK\n2KvrcxtOznaJCp1sXmK6E9q+rg9q+02RxmPhs26RAoGAMAvkSnPwoLB3M+s8govJ\nd4rGy8TX78wdS3JWP2vya8Bqjnn50q8kw52V1qyHz1Y7WnvLekorpYMXUi1DKQhv\nD074NOZaKWgBkashakvsRykkiVdWJh8AbupRJqm/V4xPvJiAESZCAiovbC0lHACj\nlQ530Zi7gyF8e+EWkHxSDS4=\n-----END PRIVATE KEY-----\n",
  client_email: "firebase-adminsdk-fbsvc@mockmate-pro-f2f13.iam.gserviceaccount.com",
  client_id: "110718453760846374075",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40mockmate-pro-f2f13.iam.gserviceaccount.com",
  universe_domain: "googleapis.com"
};

let db = null;
let auth = null;

const initFirebase = async () => {
  if (admin.getApps().length === 0) {
    let serviceAccount = null;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      } catch {}
    }

    if (!serviceAccount) {
      let serviceAccountPath = path.resolve(__dirname, './firebase-service-account.json');
      if (!fs.existsSync(serviceAccountPath) && process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        serviceAccountPath = path.resolve(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      }
      if (fs.existsSync(serviceAccountPath)) {
        try {
          serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        } catch {}
      }
    }

    if (!serviceAccount) {
      serviceAccount = DEFAULT_SERVICE_ACCOUNT;
    }

    admin.initializeApp({
      credential: admin.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id || 'mockmate-pro-f2f13',
    });
    console.log(`🔥 Firebase Admin initialized for project: ${serviceAccount.project_id || 'mockmate-pro-f2f13'}`);
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
