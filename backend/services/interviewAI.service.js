const { OpenAI } = require('openai');

const getClient = () => {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    baseURL: process.env.OPENROUTER_API_URL || undefined,
    apiKey,
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
      'X-Title': process.env.OPENROUTER_SITE_NAME || 'MockMate Pro',
    },
  });
};

const logProviderError = (scope, err) => {
  const status = err?.status || err?.response?.status || 'unknown';
  const message = err?.message || 'Unknown provider error';
  console.error(`[InterviewAI:${scope}] Provider error (${status}): ${message}`);
  if (err?.response?.data) console.error(`[InterviewAI:${scope}] provider data:`, err.response.data);
};

const parseInterviewAiResponse = (raw) => {
  const text = String(raw || '').trim();
  if (!text) throw new Error('AI response is empty.');

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('[InterviewAI] Failed JSON parse, raw response:', text);
    }
  }

  const nextQuestionMatch = text.match(/(?:next question|follow[- ]up question|question)\s*[:\-]\s*["']?([^"'\n]+)["']?/i);
  const quickFeedbackMatch = text.match(/quickFeedback\s*[:=]\s*["']([^"']+)["']/i);
  if (nextQuestionMatch || quickFeedbackMatch) {
    return {
      nextQuestion: nextQuestionMatch?.[1]?.trim() || null,
      quickFeedback: quickFeedbackMatch?.[1]?.trim() || '',
    };
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const questionLine = lines.find((line) => line.endsWith('?')) || lines[0] || null;
  const feedbackLines = lines.filter((line) => line !== questionLine);

  if (!questionLine) {
    console.warn('[InterviewAI] Unexpected raw response without a question:', text);
  }

  return {
    nextQuestion: questionLine,
    quickFeedback: feedbackLines.join(' ').trim(),
  };
};

/**
 * Generates the first or a follow-up question
 */
async function generateInterviewQuestion({ role, level, difficulty, conversationHistory, questionNumber, totalQuestions }) {
  const client = getClient();

  const defaultQuestions = [
    `Could you describe your experience as a ${role} and explain how you approach structuring complex applications?`,
    `How do you handle state management, debugging, and performance bottlenecks in your everyday workflow?`,
    `Can you discuss a challenging technical bug or outage you resolved recently and what you learned from it?`,
    `How do you balance writing maintainable, well-tested code against rapid delivery deadlines?`
  ];

  if (!client) {
    return defaultQuestions[(questionNumber - 1) % defaultQuestions.length];
  }

  const systemPrompt = `You are a professional, human-like interviewer conducting a ${level} level technical interview for the role: ${role}.

RULES:
- Ask ONE clear, specific question at a time
- If this is NOT the first question, base your question on the candidate's previous answer (follow-up, go deeper, or shift topic)
- For ${level} level: ${
    difficulty === 'easy'   ? 'ask beginner-friendly conceptual questions' :
    difficulty === 'medium' ? 'ask practical scenario-based questions' :
                              'ask advanced system design and leadership questions'
  }
- Keep the question concise (2-3 sentences max)
- Sound natural like a real human interviewer
- Current question: ${questionNumber} of ${totalQuestions}
- DO NOT add any preamble like "Sure!" or "Great!". Just ask the question directly.
- DO NOT number the question.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    ...(conversationHistory.length === 0
      ? [{ role: 'user', content: `Start the interview. Ask me the first question for ${role} at ${level} level.` }]
      : [{ role: 'user', content: 'Please ask the next interview question based on my previous answer.' }]),
  ];

  try {
    const modelName = process.env.OPENROUTER_MODEL || 'gpt-4o-mini';
    console.debug(`[InterviewAI] generateInterviewQuestion using model: ${modelName}`);

    const result = await client.chat.completions.create({
      model: modelName,
      messages,
      max_tokens: 300,
    });

    return result.choices[0].message.content.trim();
  } catch (err) {
    logProviderError('generateInterviewQuestion', err);
    console.warn(`[InterviewAI] Falling back to structured question pool.`);
    return defaultQuestions[(questionNumber - 1) % defaultQuestions.length];
  }
}

/**
 * Evaluates user answer + generates next question OR closing statement
 */
async function evaluateInterviewAnswer({ role, level, conversationHistory, userAnswer, questionNumber, totalQuestions, isLast }) {
  const client = getClient();

  if (!client) {
    if (isLast) {
      return {
        nextQuestion: null,
        quickFeedback: 'Thank you for walking through that thoroughly. That concludes our interview round today.',
      };
    }
    return {
      nextQuestion: `That provides good context. Could you elaborate on how you would test and monitor that in a production deployment?`,
      quickFeedback: 'Good explanation on the design trade-offs.',
    };
  }

  const systemPrompt = `You are a professional interviewer for ${role} (${level} level).
The candidate just answered a question.

${isLast
  ? `This was the LAST question (${questionNumber} of ${totalQuestions}).
     Give a warm, natural closing like a real interviewer would: thank them, say you'll share feedback shortly.
     Return JSON: { "nextQuestion": null, "quickFeedback": "closing message" }`
  : `You have ${totalQuestions - questionNumber} questions remaining.
     Based on their answer:
     - Give a brief natural reaction (1 sentence, like a real interviewer: "Interesting..." or "Good point...")
     - Then ask a follow-up or next question
     Return JSON: { "nextQuestion": "your next question here", "quickFeedback": "brief reaction" }`
}

Return ONLY valid JSON. No extra text.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userAnswer },
  ];

  if (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
    if (isLast) {
      return {
        nextQuestion: null,
        quickFeedback: 'Thank you for walking through that thoroughly. That concludes our interview round today.',
      };
    }
    return {
      nextQuestion: `That provides good context. Could you elaborate on how you would test and monitor that in a production deployment?`,
      quickFeedback: 'Good explanation on the design trade-offs.',
    };
  }

  try {
    const modelName = process.env.OPENROUTER_MODEL || 'gpt-4o-mini';
    console.debug(`[InterviewAI] evaluateInterviewAnswer using model: ${modelName}`);

    const result = await client.chat.completions.create({
      model: modelName,
      messages,
      max_tokens: 400,
    });

    const raw = String(result.choices?.[0]?.message?.content || '').trim();
    return parseInterviewAiResponse(raw);
  } catch (err) {
    logProviderError('evaluateInterviewAnswer', err);
    if (isLast) {
      return {
        nextQuestion: null,
        quickFeedback: 'Thank you for sharing your perspective. That concludes our discussion today.',
      };
    }
    return {
      nextQuestion: `That makes sense. How would you handle scaling this as the data or traffic volume grows 10x?`,
      quickFeedback: 'Clear explanation of the core principles.',
    };
  }
}

module.exports = { generateInterviewQuestion, evaluateInterviewAnswer };