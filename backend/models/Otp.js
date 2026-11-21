const { createFirestoreModel } = require('../config/firestoreAdapter');

const Otp = createFirestoreModel('otps');

module.exports = Otp;
