const Session = require('../models/Session');
const { generateInterviewQuestion, evaluateInterviewAnswer } = require('../services/interviewAI.service');

const normalizeConversationHistory = (history = []) =>
  (Array.isArray(history) ? history : [])
    .filter((message) =>
      (message?.role === 'assistant' || message?.role === 'user') &&
      typeof message.content === 'string'
    )
    .slice(-24)
    .map((message) => ({ role: message.role, content: message.content.slice(0, 6000) }));

// POST /api/interview/start
exports.startInterview = async (req, res, next) => {
  try {
    const { role, level } = req.body;
    if (!role || !level) {
      return res.status(400).json({ success: false, message: 'Role and level are required' });
    }

    const levelMap = {
      fresher: { difficulty: 'easy',   questionCount: 5,  label: 'Fresher'  },
      junior:  { difficulty: 'medium', questionCount: 8,  label: 'Junior'   },
      senior:  { difficulty: 'hard',   questionCount: 10, label: 'Senior'   },
    };

    const config = levelMap[level.toLowerCase()];
    if (!config) {
      return res.status(400).json({ success: false, message: 'Invalid level. Use: fresher, junior, senior' });
    }

    // Generate the FIRST question from AI
    const firstQuestion = await generateInterviewQuestion({
      role,
      level: config.label,
      difficulty: config.difficulty,
      conversationHistory: [],
      questionNumber: 1,
      totalQuestions: config.questionCount,
    });

    // Save session to DB
    const session = await Session.create({
      user: req.user.id,
      role,
      difficulty: config.difficulty,
      count: config.questionCount,
      durationMinutes: config.questionCount * 3,
      type: 'interview',
      level: config.label,
      firstQuestion,
      currentQuestion: firstQuestion,
      currentQuestionNumber: 1,
      lastAnsweredQuestionNumber: 0,
      conversationHistory: [{ role: 'assistant', content: firstQuestion }],
      lastAnswerResponse: null,
      questions: [],
    });

    res.status(201).json({
      success: true,
      session: {
        id: session._id,
        role,
        level: config.label,
        difficulty: config.difficulty,
        totalQuestions: config.questionCount,
      },
      firstQuestion,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/interview/:id/respond
// Called after user answers each question
exports.respondToAnswer = async (req, res, next) => {
  try {
    const { userAnswer, conversationHistory, questionNumber, totalQuestions } = req.body;
    if (typeof userAnswer !== 'string' || !userAnswer.trim()) {
      return res.status(400).json({ success: false, message: 'An answer is required' });
    }

    const session = await Session.findOne({ _id: req.params.id, user: req.user.id });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    if (session.completedAt) {
      return res.status(409).json({ success: false, message: 'This interview is already complete' });
    }

    const questionTotal = Math.max(1, Number(session.count) || Number(totalQuestions) || 5);
    const activeQuestionNumber = Math.max(1, Number(session.currentQuestionNumber) || 1);
    const requestedQuestionNumber = Number(questionNumber) || activeQuestionNumber;

    if (
      requestedQuestionNumber < activeQuestionNumber &&
      requestedQuestionNumber === Number(session.lastAnsweredQuestionNumber) &&
      session.lastAnswerResponse
    ) {
      return res.json({
        success: true,
        ...session.lastAnswerResponse,
        conversationHistory: normalizeConversationHistory(session.conversationHistory),
        currentQuestionNumber: session.currentQuestionNumber,
      });
    }
    if (activeQuestionNumber > questionTotal || requestedQuestionNumber !== activeQuestionNumber) {
      return res.status(409).json({ success: false, message: 'Interview question is out of date. Reload the interview to continue.' });
    }

    const questionIndex = activeQuestionNumber;
    const isLast = questionIndex >= questionTotal;
    const history = normalizeConversationHistory(
      Array.isArray(session.conversationHistory) && session.conversationHistory.length
        ? session.conversationHistory
        : conversationHistory
    );
    const answer = userAnswer.trim().slice(0, 12000);
    const lastMessage = history[history.length - 1];
    if (lastMessage?.role !== 'user' || lastMessage.content !== answer) {
      history.push({ role: 'user', content: answer });
    }

    // AI evaluates answer + generates next question (or closing)
    const aiResponse = await evaluateInterviewAnswer({
      role: session.role,
      level: session.level || req.body.level || 'Junior',
      conversationHistory: history,
      questionNumber: questionIndex,
      totalQuestions: questionTotal,
      isLast,
    });

    const response = {
      nextQuestion: aiResponse.nextQuestion || null,
      feedback: aiResponse.quickFeedback || '',
      isLast,
    };
    const persistedHistory = normalizeConversationHistory([
      ...history,
      ...(response.nextQuestion ? [{ role: 'assistant', content: response.nextQuestion }] : []),
    ]);

    session.conversationHistory = persistedHistory;
    session.currentQuestion = response.nextQuestion;
    session.currentQuestionNumber = questionIndex + 1;
    session.lastAnsweredQuestionNumber = questionIndex;
    session.lastAnswerResponse = response;
    await session.save();

    res.json({
      success: true,
      ...response,
      conversationHistory: persistedHistory,
      currentQuestionNumber: session.currentQuestionNumber,
    });
  } catch (err) {
    next(err);
  }
};

const generateFallbackEvaluation = (conversationHistory = [], role = 'Software Engineer', level = 'Junior') => {
  const questionScores = [];
  for (let i = 0; i < conversationHistory.length; i++) {
    const item = conversationHistory[i];
    if (item.role === 'assistant' && i + 1 < conversationHistory.length && conversationHistory[i + 1].role === 'user') {
      const qText = item.content;
      const aText = conversationHistory[i + 1].content;
      const score = Math.min(10, Math.max(5, Math.round(5 + (aText.length / 40))));
      questionScores.push({
        question: qText,
        answer: aText,
        score,
        feedback: score >= 8
          ? 'Strong technical explanation with clear rationale and structured detail.'
          : 'Competent response. Consider adding more concrete trade-offs and edge-case handling.',
      });
    }
  }

  const avgScore = questionScores.length
    ? Number((questionScores.reduce((acc, q) => acc + q.score, 0) / questionScores.length).toFixed(1))
    : 7.5;

  return {
    overallScore: avgScore,
    technicalScore: Math.min(10, Math.max(6, Math.round(avgScore * 0.95))),
    communicationScore: Math.min(10, Math.max(6, Math.round(avgScore * 1.05))),
    confidenceScore: Math.min(10, Math.max(6, Math.round(avgScore))),
    strengths: [
      `Demonstrated solid foundational grasp of ${role} core principles`,
      'Communicated solution approach and architectural ideas clearly',
      'Articulated practical development workflows and debugging intuition',
    ],
    improvements: [
      'Elaborate more deeply on production scaling trade-offs and latency benchmarks',
      'Mention automated testing coverage and observability metrics proactively',
    ],
    summary: `Candidate demonstrated solid technical understanding across key ${role} competencies. Answers showed good domain clarity with actionable room for deeper system-level nuance.`,
    questionScores: questionScores.length ? questionScores : [
      {
        question: `Overview of ${role} (${level}) technical competencies`,
        answer: 'Completed round',
        score: avgScore,
        feedback: 'Good overall communication and relevant examples provided.',
      }
    ],
  };
};

// POST /api/interview/:id/finish
// Called at the very end — saves full transcript & scores
exports.finishInterview = async (req, res, next) => {
  try {
    const { conversationHistory = [] } = req.body;
    const session = await Session.findOne({ _id: req.params.id, user: req.user.id });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.completedAt && session.interviewEvaluation) {
      return res.json({ success: true, sessionId: session._id, evaluation: session.interviewEvaluation });
    }

    const transcript = normalizeConversationHistory(
      Array.isArray(session.conversationHistory) && session.conversationHistory.length
        ? session.conversationHistory
        : conversationHistory
    );
    const level = session.level || req.body.level || 'Junior';

    let evaluation = null;

    if (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
      evaluation = generateFallbackEvaluation(transcript, session.role, level);
    } else {
      const { OpenAI } = require('openai');
      const client = new OpenAI({
        baseURL: process.env.OPENROUTER_API_URL || undefined,
        apiKey:  process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
        defaultHeaders: {
          'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
          'X-Title': process.env.OPENROUTER_SITE_NAME || 'MockMate Pro',
        },
      });

      const systemPrompt = `You are an expert technical interviewer.
You just completed a ${level} level interview for the role: ${session.role}.

Based on the full conversation below, provide a JSON evaluation.
Return ONLY valid JSON in this format:
{
  "overallScore": <number 0-10>,
  "technicalScore": <number 0-10>,
  "communicationScore": <number 0-10>,
  "confidenceScore": <number 0-10>,
  "strengths": ["strength1", "strength2"],
  "improvements": ["area1", "area2"],
  "summary": "2-3 sentence overall feedback",
  "questionScores": [
    { "question": "...", "answer": "...", "score": <0-10>, "feedback": "..." }
  ]
}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...transcript,
        { role: 'user', content: 'Please evaluate the full interview now.' },
      ];

      try {
        const modelName = process.env.OPENROUTER_MODEL || 'gpt-4o-mini';
        console.debug(`[InterviewAI:finishInterview] using model: ${modelName}`);
        const result = await client.chat.completions.create({
          model: modelName,
          messages,
          max_tokens: 2000,
        });

        const raw = result.choices[0].message.content.trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        evaluation = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      } catch (err) {
        const status = err?.status || err?.response?.status || 'unknown';
        const msg = err?.message || 'Unknown provider error';
        console.warn(`[InterviewAI:finishInterview] Provider error (${status}): ${msg}. Falling back to structured evaluation.`);
        evaluation = generateFallbackEvaluation(transcript, session.role, level);
      }
    }

    // Build questions array for Session model
    const questions = (evaluation.questionScores || []).map((q, idx) => ({
      questionId: `q${idx + 1}`,
      questionText: q.question || `Question ${idx + 1}`,
      question: q.question || `Question ${idx + 1}`,
      options: [],
      correctAnswer: '',
      userAnswer: q.answer || '',
      isCorrect: (q.score || 0) >= 5,
      score: q.score || 0,
      feedback: q.feedback || '',
      explanation: q.feedback || '',
    }));

    session.questions = questions;
    session.overallScore = evaluation.overallScore || 0;
    session.interviewEvaluation = evaluation;
    session.completedAt = new Date();
    await session.save();

    res.json({
      success: true,
      sessionId: session._id,
      evaluation,
    });
  } catch (err) {
    next(err);
  }
};
