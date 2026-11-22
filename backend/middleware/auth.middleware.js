const jwt  = require('jsonwebtoken');
const User = require('../models/User');
const { getFirebaseAuth } = require('../config/firebase');

const protect = async (req, res, next) => {
  let token;

  // Expect: Authorization: Bearer <token>
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized — no token provided',
    });
  }

  // 1. Try local MockMate JWT
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded?.id || decoded?.userId || decoded?._id;

    if (userId) {
      req.user = await User.findById(userId).select('-password');
      if (req.user) {
        if (process.env.NODE_ENV === 'production' && req.user.email?.toLowerCase() === 'testuser@gmail.com') {
          return res.status(401).json({ success: false, message: 'This development account is unavailable' });
        }
        return next();
      }
    }
  } catch (jwtErr) {
    // If local JWT verification fails, try Firebase ID token below
  }

  // 2. Try Firebase ID Token
  try {
    const auth = getFirebaseAuth();
    if (auth) {
      const decodedFirebase = await auth.verifyIdToken(token);
      if (decodedFirebase?.email) {
        if (!decodedFirebase.email_verified) {
          return res.status(403).json({ success: false, message: 'Please verify your email address before continuing' });
        }
        if (process.env.NODE_ENV === 'production' && decodedFirebase.email.toLowerCase() === 'testuser@gmail.com') {
          return res.status(401).json({ success: false, message: 'This development account is unavailable' });
        }
        let user = await User.findOne({ email: decodedFirebase.email.toLowerCase() });
        if (!user) {
          user = await User.create({
            _id: decodedFirebase.uid,
            name: decodedFirebase.name || decodedFirebase.email.split('@')[0],
            email: decodedFirebase.email.toLowerCase(),
            isPremium: false,
          });
        }
        if (user) {
          req.user = user;
          return next();
        }
      }
    }
  } catch (fbErr) {
    // Neither valid
  }

  return res.status(401).json({
    success: false,
    message: 'Invalid or expired token',
  });
};

module.exports = protect;
