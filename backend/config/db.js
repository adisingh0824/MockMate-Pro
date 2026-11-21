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

// Connect to the database before starting the server to avoid query buffering issues
const connectDB = async () => {
  const configuredUri = process.env.MONGO_URI ? process.env.MONGO_URI.trim() : '';

  if (configuredUri) {
    // Try a real MongoDB connection first
    try {
      console.log('Connecting to configured MongoDB database...');
      const timeout = (configuredUri.includes('localhost') || configuredUri.includes('127.0.0.1')) ? 1500 : 5000;
      const conn = await mongoose.connect(configuredUri, { serverSelectionTimeoutMS: timeout });
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      await seedInitialData();
      return;
    } catch (error) {
      console.warn(`⚠️  Configured MongoDB connection failed (${error.message}).`);
    }
  }

  // No valid URI or connection failed – decide fallback based on environment
  if (process.env.NODE_ENV !== 'production') {
    // Development fallback: use mongodb-memory-server with a persistent dbPath
    // so that data (new user accounts etc.) survives server restarts.
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const path = require('path');
      const fs   = require('fs');

      // Store DB files next to this config directory so data persists across restarts
      const dbPath = path.resolve(__dirname, '../data/db');
      if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });

      // Remove stale lock file left by a previous ungraceful shutdown (0-byte lock).
      // A live mongod holds a non-empty lock; 0 bytes means the previous process died.
      const lockFile = path.join(dbPath, 'mongod.lock');
      if (fs.existsSync(lockFile)) {
        const lockSize = fs.statSync(lockFile).size;
        if (lockSize === 0) {
          fs.unlinkSync(lockFile);
          console.log('🔓 Removed stale mongod.lock (previous process ended ungracefully)');
        }
      }

      if (!mongoMemoryServerInstance) {
        mongoMemoryServerInstance = await MongoMemoryServer.create({
          instance: {
            dbPath,
            storageEngine: 'wiredTiger',
          },
        });
      }
      const memoryUri = mongoMemoryServerInstance.getUri();
      const conn = await mongoose.connect(memoryUri);
      console.log(`✅ MongoDB (Persistent Dev Mode) Connected: ${conn.connection.host}`);
      await seedInitialData();
    } catch (err) {
      console.error(`❌ In-Memory MongoDB startup error: ${err.message}`);
      throw err;
    }
  } else {
    const errorMsg = 'No MONGO_URI provided or database connection failed in production.';
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }
};

module.exports = connectDB;
