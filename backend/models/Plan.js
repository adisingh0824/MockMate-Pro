const { createFirestoreModel } = require('../config/firestoreAdapter');

const Plan = createFirestoreModel('plans');

module.exports = Plan;
