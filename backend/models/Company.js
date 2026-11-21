const { createFirestoreModel } = require('../config/firestoreAdapter');

const Company = createFirestoreModel('companies');

module.exports = Company;
