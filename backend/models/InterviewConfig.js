const { createFirestoreModel } = require('../config/firestoreAdapter');

const InterviewConfig = createFirestoreModel('interviewConfig');

module.exports = InterviewConfig;
