const { createFirestoreModel } = require('../config/firestoreAdapter');

const Role = createFirestoreModel('roles');

module.exports = Role;
