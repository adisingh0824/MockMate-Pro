const dns = require('dns');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

let mongoMemoryServerInstance = null;

if (process.env.MONGO_URI && process.env.MONGO_URI.startsWith('mongodb+srv://')) {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch {}
}

const seedInitialData = async () => {
  try {
    const User = require('../models/User');
    const Role = require('../models/Role');
    const Plan = require('../models/Plan');
    const InterviewConfig = require('../models/InterviewConfig');
    const Company = require('../models/Company');

    // 1. Ensure demo user exists with known credentials
    const demoEmail = 'testuser@gmail.com';
    const demoUser = await User.findOne({ email: demoEmail });
    if (!demoUser) {
      const hashedPassword = await bcrypt.hash('testpassword@1234', 10);
      await User.create({
        name: 'Demo Candidate',
        email: demoEmail,
        password: hashedPassword,
        isPremium: true,
      });
      console.log('✅ Demo user seeded: testuser@gmail.com / testpassword@1234');
    }

    // 2. Ensure default roles exist
    const rolesCount = await Role.estimatedDocumentCount();
    if (rolesCount === 0) {
      const DEFAULT_ROLES = [
        { name: 'Frontend Developer', slug: 'frontend-developer', sortOrder: 1 },
        { name: 'Backend Developer', slug: 'backend-developer', sortOrder: 2 },
        { name: 'Full Stack Developer', slug: 'full-stack-developer', sortOrder: 3 },
        { name: 'DevOps Engineer', slug: 'devops-engineer', sortOrder: 4 },
        { name: 'Data Analyst', slug: 'data-analyst', sortOrder: 5 },
        { name: 'Data Scientist', slug: 'data-scientist', sortOrder: 6 },
        { name: 'Machine Learning Engineer', slug: 'machine-learning-engineer', sortOrder: 7 },
        { name: 'QA Engineer', slug: 'qa-engineer', sortOrder: 8 },
        { name: 'Product Manager', slug: 'product-manager', sortOrder: 9 },
        { name: 'UI/UX Designer', slug: 'ui-ux-designer', sortOrder: 10 },
      ];
      await Role.insertMany(DEFAULT_ROLES);
      console.log('✅ Default roles initialized');
    }

    // 3. Ensure default interview config exists
    const configExists = await InterviewConfig.findOne({ key: 'default' });
    if (!configExists) {
      await InterviewConfig.create({
        key: 'default',
        difficulties: [
          { value: 'easy', label: 'Easy', description: 'Beginner level', sortOrder: 1 },
          { value: 'medium', label: 'Medium', description: 'Intermediate level', sortOrder: 2 },
          { value: 'hard', label: 'Hard', description: 'Advanced level', sortOrder: 3 },
        ],
        questionCounts: [5, 10, 15, 20, 25],
        defaultDifficulty: 'medium',
        defaultQuestionCount: 5,
      });
      console.log('✅ Default interview config initialized');
    }

    // 4. Ensure default subscription plans exist
    const plansCount = await Plan.estimatedDocumentCount();
    if (plansCount === 0) {
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
        },
      ];
      await Plan.insertMany(DEFAULT_PLANS);
      console.log('✅ Default subscription plans initialized');
    }

    // 5. Ensure default companies exist
    const companyCount = await Company.estimatedDocumentCount();
    if (companyCount === 0) {
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
      await Company.insertMany(DEFAULT_COMPANIES);
      console.log('✅ Default companies initialized');
    }
  } catch (seedErr) {
    console.warn(`⚠️  Data bootstrap notice: ${seedErr.message}`);
  }
};

const connectDB = async () => {
  const configuredUri = process.env.MONGO_URI ? process.env.MONGO_URI.trim() : '';

  // 1. Attempt connection if a remote URI or valid URI is specified
  if (configuredUri && !configuredUri.includes('localhost:27017') && !configuredUri.includes('127.0.0.1:27017')) {
    try {
      console.log('Connecting to configured MongoDB database...');
      const conn = await mongoose.connect(configuredUri, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      await seedInitialData();
      return;
    } catch (error) {
      console.warn(`⚠️  Configured MongoDB connection failed (${error.message}). Falling back to memory engine.`);
    }
  }

  // 2. Fallback to MongoMemoryServer for 100% reliable local/zero-config operation
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    if (!mongoMemoryServerInstance) {
      mongoMemoryServerInstance = await MongoMemoryServer.create();
    }
    const memoryUri = mongoMemoryServerInstance.getUri();
    const conn = await mongoose.connect(memoryUri);
    console.log(`✅ MongoDB In-Memory Connected: ${conn.connection.host} (Offline/Zero-config mode active)`);
    await seedInitialData();
  } catch (err) {
    console.error(`❌ In-Memory MongoDB startup error: ${err.message}`);
  }
};

module.exports = connectDB;
