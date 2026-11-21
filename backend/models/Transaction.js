const { createFirestoreModel } = require('../config/firestoreAdapter');

const Transaction = createFirestoreModel('transactions');

module.exports = Transaction;
