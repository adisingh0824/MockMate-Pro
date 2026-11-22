const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const { initFirebase } = require('./config/firebase');
const { APP_CONSTANTS } = require('./utils/constants');

const app = express();

const corsOrigins = APP_CONSTANTS.CORS_ORIGINS;
app.use(cors({
  origin: corsOrigins,
  credentials: corsOrigins !== '*',
}));
app.use(express.json());

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/sessions', require('./routes/session.routes'));
app.use('/api/plans', require('./routes/plan.routes'));
app.use('/api/companies', require('./routes/company.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/interview', require('./routes/interview.routes'));

app.get('/', (req, res) =>
  res.json({ message: 'MockMate Pro API ✅', version: '2.2.0-firebase' })
);

app.use(require('./middleware/error.middleware'));

const startServer = async () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set before starting the API server');
  }
  await initFirebase();
  console.log('🔥 Firebase Cloud Firestore database connected');

  const PORT = process.env.PORT || 5800;
  const server = app.listen(PORT, () =>
    console.log(`🚀 Server running on port ${PORT} (${APP_CONSTANTS.NODE_ENV})`)
  );
  return server;
};

if (require.main === module) {
  startServer().catch((err) => {
    console.error('❌ Server startup failed:', err.message);
    process.exitCode = 1;
  });
}

module.exports = { app, startServer };
