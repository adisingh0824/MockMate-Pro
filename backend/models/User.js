const { createFirestoreModel } = require('../config/firestoreAdapter');

const User = createFirestoreModel('users');

module.exports = User;
