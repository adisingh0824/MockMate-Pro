const Role = require('../models/Role');
const InterviewConfig = require('../models/InterviewConfig');

const DEFAULT_ROLES = [
  { name: 'Frontend Developer', slug: 'frontend-developer', sortOrder: 1 },
  { name: 'Backend Developer', slug: 'backend-developer', sortOrder: 2 },
  { name: 'Full Stack Developer', slug: 'full-stack-developer', sortOrder: 3 },
  { name: 'DevOps Engineer', slug: 'devops-engineer', sortOrder: 4 },
  { name: 'Data Analyst', slug: 'data-analyst', sortOrder: 5 },
  { name: 'Data Scientist', slug: 'data-scientist', sortOrder: 6 },
  { name: 'Machine Learning Engineer', slug: 'machine-learning-engineer', sortOrder: 7 },
  { name: 'QA Engineer', slug: 'qa-engineer', sortOrder: 8 },
  { name: 'Product Manager', slug: 'product-manager', sortOrder: 9 },
  { name: 'UI/UX Designer', slug: 'ui-ux-designer', sortOrder: 10 },
];


const bootstrapRolesIfEmpty = async () => {
	const count = await Role.estimatedDocumentCount();
	if (count > 0) return;
	await Role.insertMany(DEFAULT_ROLES);
};

const DEFAULT_INTERVIEW_CONFIG = {
  key: 'default',
  difficulties: [
    { value: 'easy', label: 'Easy', description: 'Beginner level', sortOrder: 1 },
    { value: 'medium', label: 'Medium', description: 'Intermediate level', sortOrder: 2 },
    { value: 'hard', label: 'Hard', description: 'Advanced level', sortOrder: 3 },
  ],
  questionCounts: [20, 25, 30],
  defaultDifficulty: 'medium',
  defaultQuestionCount: 25,
};

const bootstrapInterviewConfigIfMissing = async () => {
  const existing = await InterviewConfig.findOne({ key: 'default' });
  if (existing) return;
  await InterviewConfig.create(DEFAULT_INTERVIEW_CONFIG);
};

// GET /api/sessions/roles
exports.getRoles = async (req, res, next) => {
	try {
		await bootstrapRolesIfEmpty();

		const roles = await Role.find({ isActive: true })
			.sort({ sortOrder: 1, name: 1 })
			.select('name -_id');

		res.status(200).json({
			success: true,
			roles: roles.map((role) => role.name),
		});
	} catch (err) {
		next(err);
	}
};

// GET /api/sessions/config
exports.getSessionConfig = async (req, res, next) => {
  try {
    await bootstrapInterviewConfigIfMissing();

    const config = await InterviewConfig.findOne({ key: 'default' })
      .select('difficulties questionCounts defaultDifficulty defaultQuestionCount -_id');

    const difficulties = (config?.difficulties || [])
      .filter((item) => item.isActive !== false)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      .map((item) => ({
        value: item.value,
        label: item.label,
        description: item.description,
      }));

    const questionCounts = [...(config?.questionCounts || [])]
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
      .sort((a, b) => a - b);

    res.status(200).json({
      success: true,
      config: {
        difficulties,
        questionCounts,
        defaultDifficulty: config?.defaultDifficulty || 'medium',
        defaultQuestionCount: Number(config?.defaultQuestionCount) || 25,
      },
    });
  } catch (err) {
    next(err);
  }
};

const Session = require('../models/Session');
const { generateMcqQuestions } = require('../services/ai.service');

const toAnswerLetter = (answerValue = '') => {
  const trimmed = String(answerValue).trim();
  if (['A', 'B', 'C', 'D'].includes(trimmed)) return trimmed;
  const match = trimmed.match(/^([A-D])\./i);
  return match ? match[1].toUpperCase() : trimmed.toUpperCase();
};

const isLiveInterviewSession = (session) => Boolean(
  session?.type === 'interview' &&
  (Array.isArray(session.conversationHistory) || session.firstQuestion || session.currentQuestion)
);

// POST /api/sessions/start
// In exports.startSession — change this block:
exports.startSession = async (req, res, next) => {
  try {
    const { role, difficulty, count, durationMinutes, type, company } = req.body;

    const safeRole = typeof role === 'string' ? role.trim().slice(0, 100) : '';
    const safeDifficulty = typeof difficulty === 'string' ? difficulty.trim().toLowerCase() : '';
    if (!safeRole || !safeDifficulty) {
      return res.status(400).json({ success: false, message: 'Role and difficulty are required' });
    }
    if (!['easy', 'medium', 'hard'].includes(safeDifficulty)) {
      return res.status(400).json({ success: false, message: 'Difficulty must be easy, medium, or hard' });
    }
    if (type && !['practice', 'interview'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Session type must be practice' });
    }

    const requestedCount = Number(count);
    const requestedDuration = Number(durationMinutes);
    const safeCount = Math.max(1, Math.min(Number.isFinite(requestedCount) && requestedCount > 0 ? Math.floor(requestedCount) : 5, 30));
    const safeDuration = Math.max(1, Math.min(Number.isFinite(requestedDuration) && requestedDuration > 0 ? Math.floor(requestedDuration) : 20, 180));
    // Older clients used `interview` for this multiple-choice endpoint. Keep
    // accepting that value, but persist it as practice so resume/history use
    // the matching MCQ flow. Live simulations use /api/interview/start.
    const safeType = 'practice';
    const safeCompany = company ? String(company).trim().slice(0, 120) : null;

    const generatedQuestions = await generateMcqQuestions(
      safeRole, safeDifficulty, safeCount, safeCompany
    );

    const session = await Session.create({
      user: req.user.id, role: safeRole, difficulty: safeDifficulty,
      count: safeCount, durationMinutes: safeDuration,
      type: safeType,
      company: safeCompany,  // ← save to DB
      questions: generatedQuestions.map((q, idx) => ({
        questionId: q.questionId || `q${idx + 1}`,
        question: q.questionText, questionText: q.questionText,
        options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation,
      })),
    });

    res.status(201).json({ success: true, session: {
      id: session.id, role: session.role, difficulty: session.difficulty,
      type: session.type, company: session.company,
      durationMinutes: session.durationMinutes, createdAt: session.createdAt,
      questions: session.questions.map(({ correctAnswer, explanation, ...question }) => question),
    }});
  } catch (err) { next(err); }
};

// GET /api/sessions/history
exports.getHistory = async (req, res, next) => {
  try {
    const sessions = await Session.find({ user: req.user.id })
      .sort('-createdAt')
      .limit(20);

    const safeSessions = sessions.map((session) => {
      const flowType = session.type === 'interview' && !isLiveInterviewSession(session) ? 'practice' : session.type;
      if (session.completedAt || !Array.isArray(session.questions)) return { ...session, type: flowType };
      return {
        ...session,
        type: flowType,
        questions: session.questions.map(({ correctAnswer, explanation, ...question }) => question),
      };
    });
    
    res.status(200).json({
      success: true,
      sessions: safeSessions
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/sessions/:id
exports.getSession = async (req, res, next) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, user: req.user.id });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    const responseSession = {
      ...session,
      type: session.type === 'interview' && !isLiveInterviewSession(session) ? 'practice' : session.type,
    };
    if (!session.completedAt && Array.isArray(session.questions)) {
      responseSession.questions = session.questions.map(({ correctAnswer, explanation, ...question }) => question);
    }
    res.status(200).json({ success: true, session: responseSession });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/sessions/:id/answers — save an in-progress practice draft
exports.saveSessionAnswers = async (req, res, next) => {
  try {
    const { answers } = req.body;
    if (!Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: 'Answers must be an array' });
    }

    const session = await Session.findOne({ _id: req.params.id, user: req.user.id });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.completedAt) {
      return res.status(409).json({ success: false, message: 'This session is already complete' });
    }
    if (isLiveInterviewSession(session)) {
      return res.status(400).json({ success: false, message: 'Interview answers are saved through the interview flow' });
    }

    const answerMap = new Map();
    answers.forEach((item) => {
      const questionId = item?.questionId || item?.id || item?._id;
      if (questionId && typeof item.userAnswer === 'string') {
        answerMap.set(String(questionId), item.userAnswer);
      }
    });

    let savedCount = 0;
    session.questions = (session.questions || []).map((question, index) => {
      const questionId = String(question.questionId || question._id || `q${index + 1}`);
      const selected = answerMap.get(questionId) || '';
      const userAnswer = question.options?.includes(selected) ? selected : '';
      if (userAnswer) savedCount += 1;
      return { ...question, questionId, userAnswer };
    });
    await session.save();

    res.status(200).json({ success: true, savedCount });
  } catch (err) {
    next(err);
  }
};

// POST /api/sessions/:id/submit
exports.submitSession = async (req, res, next) => {
  try {
    const { answers } = req.body;
    
    const session = await Session.findOne({ _id: req.params.id, user: req.user.id });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    if (session.completedAt) {
      return res.status(200).json({ success: true, result: session });
    }

    const answerMap = new Map();
    if (Array.isArray(answers)) {
      answers.forEach((item) => {
        if (item && (item.questionId || item.id || item._id)) {
          const qId = item.questionId || item.id || item._id;
          answerMap.set(String(qId), item.userAnswer || '');
        }
      });
    } else if (answers && typeof answers === 'object') {
      Object.entries(answers).forEach(([key, val]) => {
        answerMap.set(String(key), typeof val === 'object' ? val?.userAnswer || '' : String(val));
      });
    }

    let correctCount = 0;

    session.questions = (session.questions || []).map((questionDoc, idx) => {
      const question = typeof questionDoc?.toObject === 'function' ? questionDoc.toObject() : (questionDoc || {});
      const fallbackId = question.questionId || `q${idx + 1}`;
      const incomingAnswer = answerMap.get(String(fallbackId)) || '';
      const selected = toAnswerLetter(incomingAnswer);
      const correct = toAnswerLetter(question.correctAnswer);
      const isCorrect = selected === correct;

      if (isCorrect) correctCount += 1;

      return {
        ...question,
        questionId: fallbackId,
        userAnswer: selected,
        isCorrect,
        score: isCorrect ? 10 : 0,
        feedback: isCorrect
          ? `Correct. ${question.explanation || ''}`.trim()
          : `Incorrect. Correct answer: ${correct}. ${question.explanation || ''}`.trim(),
      };
    });

    session.overallScore = session.questions.length
      ? Number(((correctCount / session.questions.length) * 10).toFixed(1))
      : 0;
    session.completedAt = new Date();
    await session.save();

    res.status(200).json({ success: true, result: session });
  } catch (err) {
    next(err);
  }
};
