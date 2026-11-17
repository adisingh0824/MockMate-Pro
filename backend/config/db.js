const dns = require('dns');
const mongoose = require('mongoose');

if (process.env.MONGO_URI && process.env.MONGO_URI.startsWith('mongodb+srv://')) {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
}

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.warn('⚠️  MONGO_URI is not set in backend/.env. Please configure your MongoDB Atlas connection string.');
    return;
  }
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Error: ${error.message}`);
  }
};
module.exports = connectDB;