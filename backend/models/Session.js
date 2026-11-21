const { createFirestoreModel } = require('../config/firestoreAdapter');

const Session = createFirestoreModel('sessions');

module.exports = Session;
