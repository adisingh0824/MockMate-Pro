



const jwt            = require('jsonwebtoken');
const bcrypt         = require('bcryptjs');
const { randomInt }  = require('crypto');
const User           = require('../models/User');
const Otp            = require('../models/Otp');
const { sendOtpEmail } = require('../utils/sendEmail');
const { AUTH_CONSTANTS, APP_CONSTANTS } = require('../utils/constants');


// Helper — generate 6-digit OTP
const generateOtp = () => {
  const min = 10 ** (AUTH_CONSTANTS.OTP_LENGTH - 1);
  const max = (10 ** AUTH_CONSTANTS.OTP_LENGTH) - 1;
  return randomInt(min, max + 1).toString();
};

// Helper — generate signed JWT
const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: APP_CONSTANTS.JWT_EXPIRES_IN,
  });

const otpExpiry = () => new Date(
  Date.now() + AUTH_CONSTANTS.OTP_EXPIRY_SECONDS * 1000
).toISOString();

const isOtpExpired = (record) => {
  const expiresAt = record.expiresAt || (record.createdAt
    ? new Date(new Date(record.createdAt).getTime() + AUTH_CONSTANTS.OTP_EXPIRY_SECONDS * 1000).toISOString()
    : null);
  const expiryTime = expiresAt ? new Date(expiresAt).getTime() : NaN;
  return !Number.isFinite(expiryTime) || expiryTime <= Date.now();
};


// ── POST /api/auth/register ───────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required',
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be at least 2 characters',
      });
    }

    if (!/^[\w.-]+@[\w.-]+\.\w{2,}$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'This email is already registered. Please login.',
      });
    }

    const salt           = await bcrypt.genSalt(AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);

    const otp = generateOtp();

    await Otp.deleteMany({ email: email.toLowerCase(), purpose: 'registration' });

    await Otp.create({
      email:    email.toLowerCase(),
      name:     name.trim(),
      password: hashedPassword,
      otp,
      purpose:  'registration',
      expiresAt: otpExpiry(),
    });

    let emailResult = { simulated: true, otp };
    try {
      emailResult = await sendOtpEmail(email, name.trim(), otp);
    } catch (emailErr) {
      console.warn('⚠️ sendOtpEmail error caught in register controller:', emailErr.message);
      if (process.env.NODE_ENV === 'production') {
        await Otp.deleteOne({ email: email.toLowerCase(), purpose: 'registration' });
        return res.status(503).json({
          success: false,
          message: 'Email delivery is unavailable. Please try again later.',
        });
      }
      emailResult = { simulated: true, otp, deliveryError: emailErr.message };
    }

    if (process.env.NODE_ENV === 'production' && emailResult?.simulated) {
      await Otp.deleteOne({ email: email.toLowerCase(), purpose: 'registration' });
      return res.status(503).json({
        success: false,
        message: 'Email delivery is unavailable. Please try again later.',
      });
    }

    return res.status(200).json({
      success: true,
      message: (emailResult?.simulated || emailResult?.deliveryError)
        ? `Verification code: ${otp} (enter code below to complete registration)`
        : `OTP sent to ${email}. Please verify to complete registration.`,
      devOtp: (emailResult?.simulated || emailResult?.deliveryError) ? otp : undefined,
    });
  } catch (err) {
    next(err);
  }
};


// ── POST /api/auth/verify-otp ─────────────────────────────
exports.verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required',
      });
    }

    const otpRecord = await Otp.findOne({ email: email.toLowerCase(), purpose: 'registration' });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'OTP expired or not found. Please register again.',
      });
    }

    if (isOtpExpired(otpRecord)) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new code.' });
    }

    if (otpRecord.attempts >= AUTH_CONSTANTS.OTP_MAX_ATTEMPTS) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({
        success: false,
        message: 'Too many wrong attempts. Please register again.',
      });
    }

    if (otpRecord.otp !== otp.toString().trim()) {
      await Otp.findByIdAndUpdate(otpRecord._id, { $inc: { attempts: 1 } });
      const remaining = Math.max(AUTH_CONSTANTS.OTP_MAX_ATTEMPTS - (otpRecord.attempts + 1), 0);
      return res.status(400).json({
        success: false,
        message: `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      });
    }

    // ✅ OTP correct — create or retrieve user account safely in Firestore & Firebase Auth
    let user = await User.findOne({ email: otpRecord.email });
    if (!user) {
      let firebaseUid = null;
      try {
        const { getFirebaseAuth } = require('../config/firebase');
        const fbAuth = getFirebaseAuth();
        try {
          const fbUser = await fbAuth.getUserByEmail(otpRecord.email);
          firebaseUid = fbUser.uid;
          if (!fbUser.emailVerified) {
            await fbAuth.updateUser(firebaseUid, { emailVerified: true });
          }
        } catch (e) {
          if (e.code === 'auth/user-not-found') {
            const newFbUser = await fbAuth.createUser({
              email: otpRecord.email,
              displayName: otpRecord.name,
              emailVerified: true,
            });
            firebaseUid = newFbUser.uid;
          }
        }
      } catch (fbErr) {
        // Firebase Auth sync is non-blocking
      }

      user = await User.create({
        ...(firebaseUid ? { _id: firebaseUid } : {}),
        name:     otpRecord.name,
        email:    otpRecord.email,
        password: otpRecord.password,  // already hashed
        isPremium: false,
      });
    }

    await Otp.deleteMany({ email: otpRecord.email, purpose: 'registration' });

    // Generate JWT so the client can auto-login immediately after verification
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account created! You are now logged in.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isPremium: user.isPremium,
      },
    });
  } catch (err) {
    next(err);
  }
};


// ── POST /api/auth/resend-otp ─────────────────────────────
exports.resendOtp = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const otpRecord = await Otp.findOne({ email: email.toLowerCase(), purpose: 'registration' });
    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'No pending registration found. Please register again.',
      });
    }

    const newOtp = generateOtp();

    await Otp.deleteOne({ email: email.toLowerCase(), purpose: 'registration' });
    await Otp.create({
      email:    otpRecord.email,
      name:     otpRecord.name,
      password: otpRecord.password,
      otp:      newOtp,
      purpose:  'registration',
      expiresAt: otpExpiry(),
    });

    let emailResult = { simulated: true, otp: newOtp };
    try {
      emailResult = await sendOtpEmail(otpRecord.email, otpRecord.name, newOtp);
    } catch (emailErr) {
      console.warn('⚠️ sendOtpEmail error caught in resendOtp controller:', emailErr.message);
      if (process.env.NODE_ENV === 'production') {
        await Otp.deleteOne({ email: otpRecord.email, purpose: 'registration' });
        return res.status(503).json({
          success: false,
          message: 'Email delivery is unavailable. Please try again later.',
        });
      }
      emailResult = { simulated: true, otp: newOtp, deliveryError: emailErr.message };
    }

    if (process.env.NODE_ENV === 'production' && emailResult?.simulated) {
      await Otp.deleteOne({ email: otpRecord.email, purpose: 'registration' });
      return res.status(503).json({
        success: false,
        message: 'Email delivery is unavailable. Please try again later.',
      });
    }

    return res.status(200).json({
      success: true,
      message: (emailResult?.simulated || emailResult?.deliveryError)
        ? `New verification code: ${newOtp}`
        : `New OTP sent to ${email}.`,
      devOtp: (emailResult?.simulated || emailResult?.deliveryError) ? newOtp : undefined,
    });
  } catch (err) {
    next(err);
  }
};


// ── POST /api/auth/forgot-password ────────────────────────
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email',
      });
    }

    const otp = generateOtp();

    await Otp.deleteMany({ email: email.toLowerCase(), purpose: 'reset_password' });
    await Otp.create({
      email: email.toLowerCase(),
      name: user.name,
      ...(user.password ? { password: user.password } : {}),
      otp,
      purpose: 'reset_password',
      expiresAt: otpExpiry(),
    });

    let emailResult = { simulated: true, otp };
    try {
      emailResult = await sendOtpEmail(user.email, user.name, otp);
    } catch (emailErr) {
      console.warn('⚠️ sendOtpEmail error caught in forgotPassword controller:', emailErr.message);
      if (process.env.NODE_ENV === 'production') {
        await Otp.deleteOne({ email: user.email.toLowerCase(), purpose: 'reset_password' });
        return res.status(503).json({
          success: false,
          message: 'Email delivery is unavailable. Please try again later.',
        });
      }
      emailResult = { simulated: true, otp, deliveryError: emailErr.message };
    }

    if (process.env.NODE_ENV === 'production' && emailResult?.simulated) {
      await Otp.deleteOne({ email: user.email.toLowerCase(), purpose: 'reset_password' });
      return res.status(503).json({
        success: false,
        message: 'Email delivery is unavailable. Please try again later.',
      });
    }

    return res.status(200).json({
      success: true,
      message: (emailResult?.simulated || emailResult?.deliveryError)
        ? `Password reset code: ${otp}`
        : `Password reset OTP sent to ${user.email}`,
      devOtp: (emailResult?.simulated || emailResult?.deliveryError) ? otp : undefined,
    });
  } catch (err) {
    next(err);
  }
};


// ── POST /api/auth/reset-password ────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, password } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP and new password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const otpRecord = await Otp.findOne({
      email: email.toLowerCase(),
      purpose: 'reset_password',
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Reset OTP expired or not found. Please request again.',
      });
    }

    if (isOtpExpired(otpRecord)) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: 'Reset code expired. Please request a new code.' });
    }

    if (otpRecord.attempts >= AUTH_CONSTANTS.OTP_MAX_ATTEMPTS) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(429).json({
        success: false,
        message: 'Too many wrong attempts. Please request a new reset OTP.',
      });
    }

    if (otpRecord.otp !== otp.toString().trim()) {
      await Otp.findByIdAndUpdate(otpRecord._id, { $inc: { attempts: 1 } });
      const remaining = Math.max(AUTH_CONSTANTS.OTP_MAX_ATTEMPTS - (otpRecord.attempts + 1), 0);
      return res.status(400).json({
        success: false,
        message: `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      });
    }

    const salt = await bcrypt.genSalt(AUTH_CONSTANTS.BCRYPT_SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    // Keep Firebase Auth and the application profile in sync when this account
    // has a Firebase identity. Backend-only accounts continue to work normally.
    try {
      const { getFirebaseAuth } = require('../config/firebase');
      const firebaseAuth = getFirebaseAuth();
      const firebaseUser = await firebaseAuth.getUserByEmail(user.email);
      await firebaseAuth.updateUser(firebaseUser.uid, { password, emailVerified: true });
    } catch (firebaseError) {
      if (firebaseError.code !== 'auth/user-not-found') {
        return next(firebaseError);
      }
    }

    await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { password: hashedPassword },
      { runValidators: true }
    );

    await Otp.deleteOne({ _id: otpRecord._id });

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. Please login with your new password.',
    });
  } catch (err) {
    next(err);
  }
};


// ── POST /api/auth/login ──────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    if (process.env.NODE_ENV === 'production' && email.toLowerCase() === 'testuser@gmail.com') {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const isMatch = user.password ? await bcrypt.compare(password, user.password) : false;
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user._id, name: user.name, email: user.email, isPremium: user.isPremium },
    });
  } catch (err) {
    next(err);
  }
};


// ── POST /api/auth/firebase-sync ──────────────────────────
exports.firebaseSync = async (req, res, next) => {
  try {
    const { email, name, idToken } = req.body;
    if (!email || !idToken) {
      return res.status(400).json({
        success: false,
        message: 'Email and Firebase ID token are required',
      });
    }

    if (process.env.NODE_ENV === 'production' && email.toLowerCase() === 'testuser@gmail.com') {
      return res.status(401).json({ success: false, message: 'This development account is unavailable' });
    }

    const { getFirebaseAuth } = require('../config/firebase');
    const decoded = await getFirebaseAuth().verifyIdToken(idToken);
    if (!decoded.email || decoded.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(401).json({ success: false, message: 'Firebase identity does not match the supplied email' });
    }
    if (!decoded.email_verified) {
      return res.status(403).json({ success: false, message: 'Please verify your email address before continuing' });
    }

    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      user = await User.create({
        _id: decoded.uid,
        name: (name || '').trim() || email.split('@')[0],
        email: email.toLowerCase(),
        isPremium: false,
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isPremium: user.isPremium,
      },
    });
  } catch (err) {
    next(err);
  }
};


// ── GET /api/auth/me ──────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isPremium: user.isPremium,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
};


// ── PATCH /api/auth/me ───────────────────────────────────
exports.updateMe = async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be at least 2 characters',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name: name.trim() },
      { returnDocument: 'after', runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isPremium: user.isPremium,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
};
