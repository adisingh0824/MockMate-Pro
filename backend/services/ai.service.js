// backend/services/ai.service.js
// Uses the standard `openai` npm package pointed at OpenRouter's API URL.
// This avoids ALL constructor errors from @openrouter/sdk.

const OpenAI = require('openai');   // ← standard openai package, NOT @openrouter/sdk

const COMPANY_TOPICS = {
  google:    'data structures, algorithms, system design, OOPs, scalability',
  amazon:    'leadership principles, system design, DSA, distributed systems',
  microsoft: 'data structures, algorithms, OOPs, Azure cloud, system design',
  meta:      'algorithms, graph problems, system design, product sense',
  apple:     'OOPs, Swift/iOS, algorithms, hardware-software integration',
  netflix:   'distributed systems, streaming architecture, system design, DSA',
  flipkart:  'DSA, system design, Java/Python, e-commerce architecture',
  infosys:   'programming basics, DBMS, networking, OOPs, aptitude',
  tcs:       'programming basics, aptitude, DBMS, OOPs, logical reasoning',
};

const buildPrompt = (role, difficulty, count, company = null) => {
  const companyLine = company
    ? `This is specifically for a ${company} interview. Focus on topics: ${
        COMPANY_TOPICS[company.toLowerCase()] ||
        'algorithms, data structures, system design, OOPs'
      }.`
    : 'This is a general technical interview practice set.';

  return `
You are an expert technical interviewer.
${companyLine}

Generate unique ${count} multiple-choice questions for role: "${role}" at difficulty: "${difficulty}".

Return ONLY valid JSON in this exact shape — no markdown, no code fences:
{
  "questions": [
    {
      "questionText": "...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctAnswer": "A",
      "explanation": "Short explanation."
    }
  ]
}

Rules:
- Exactly ${count} questions.
- 4 options per question labelled A, B, C, D.
- correctAnswer must be exactly one of: A, B, C, D.
- No markdown. ONLY raw JSON.
`.trim();
};

const parseJsonResponse = (text) => {
  let trimmed = String(text).trim();
  if (!trimmed) throw new Error('AI response is empty.');

  // Remove common wrappers from LLM responses.
  trimmed = trimmed
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try { return JSON.parse(trimmed); } catch {}

  const oS = trimmed.indexOf('{'), oE = trimmed.lastIndexOf('}');
  const aS = trimmed.indexOf('['), aE = trimmed.lastIndexOf(']');
  const candidates = [];
  if (oS !== -1 && oE > oS) candidates.push(trimmed.slice(oS, oE + 1));
  if (aS !== -1 && aE > aS) candidates.push(trimmed.slice(aS, aE + 1));
  for (const s of candidates) { try { return JSON.parse(s); } catch {} }

  throw new Error('AI response has no parseable JSON.');
};

const toQuestionObjects = (parsed) => {
  if (Array.isArray(parsed?.questions)) return parsed.questions;
  if (Array.isArray(parsed))            return parsed;
  return [];
};

const normalizeQuestion = (q, idx) => {
  const options = Array.isArray(q.options) ? q.options.slice(0, 4) : [];
  const normalizedOptions = options.map((opt, i) => {
    const label = String.fromCharCode(65 + i);
    const value = String(opt).trim();
    return /^[A-D]\./.test(value) ? value : `${label}. ${value}`;
  });
  while (normalizedOptions.length < 4) {
    const label = String.fromCharCode(65 + normalizedOptions.length);
    normalizedOptions.push(`${label}. Option ${label}`);
  }
  const raw = String(q.correctAnswer || 'A').trim().toUpperCase();
  const correctAnswer = ['A', 'B', 'C', 'D'].includes(raw) ? raw : 'A';
  return {
    questionId:   q.questionId || `q${idx + 1}`,
    questionText: q.questionText || q.question || `Question ${idx + 1}`,
    options:      normalizedOptions,
    correctAnswer,
    explanation:  q.explanation || 'No explanation provided.',
  };
};

const logProviderError = (scope, err) => {
  const status = err?.status || err?.response?.status || 'unknown';
  const message = err?.message || 'Unknown provider error';
  console.error(`[AI:${scope}] Provider error (${status}): ${message}`);
};

const requestQuestionsBatch = async ({ client, role, difficulty, count, company }) => {
  const modelName = process.env.OPENROUTER_MODEL || 'gpt-4o-mini';
  console.debug(`[AI] requestQuestionsBatch using model: ${modelName}`);

  const completion = await client.chat.completions.create({
    model: modelName,
    messages: [{ role: 'user', content: buildPrompt(role, difficulty, count, company) }],
    max_tokens: Number(process.env.OPENROUTER_MAX_COMPLETION_TOKENS) || 1800,
    temperature: 0.5,
  });

  const rawText = completion?.choices?.[0]?.message?.content || '';
  const parsed = parseJsonResponse(rawText);
  const rawQs = toQuestionObjects(parsed);
  if (!rawQs.length) throw new Error('AI returned no questions.');
  return rawQs;
};

const FALLBACK_BANK = [
  {
    questionText: 'What is the primary difference between useEffect and useLayoutEffect in React?',
    options: [
      'A. useEffect runs synchronously before paint, useLayoutEffect runs asynchronously after paint',
      'B. useLayoutEffect runs synchronously immediately after DOM mutations before paint, useEffect runs after paint',
      'C. useEffect is only for server-side rendering while useLayoutEffect is for client-side',
      'D. There is no difference; they are aliases for the same underlying hook'
    ],
    correctAnswer: 'B',
    explanation: 'useLayoutEffect fires synchronously after all DOM mutations but before the browser repaints the screen, making it suitable for measuring layout or synchronizing DOM reads/writes.'
  },
  {
    questionText: 'What is the runtime complexity of accessing a key in a Hash Map on average?',
    options: ['A. O(1)', 'B. O(log n)', 'C. O(n)', 'D. O(n log n)'],
    correctAnswer: 'A',
    explanation: 'Hash maps provide average O(1) constant time complexity for key lookups.'
  },
  {
    questionText: 'In Node.js, what is the primary role of the Libuv library?',
    options: [
      'A. Providing template engine rendering for Express',
      'B. Providing a cross-platform asynchronous I/O thread pool and event loop',
      'C. Handling JWT cryptographic signing',
      'D. Parsing incoming multipart/form-data requests'
    ],
    correctAnswer: 'B',
    explanation: 'Libuv is a multi-platform C library that handles the event loop, thread pool, asynchronous file/network I/O in Node.js.'
  },
  {
    questionText: 'What does the ACID acronym stand for in relational databases?',
    options: [
      'A. Atomicity, Consistency, Isolation, Durability',
      'B. Asynchronous, Concurrent, Isolated, Distributed',
      'C. Availability, Consistency, Integrity, Dependency',
      'D. Authorization, Compression, Indexing, Decryption'
    ],
    correctAnswer: 'A',
    explanation: 'ACID guarantees database transaction reliability: Atomicity, Consistency, Isolation, and Durability.'
  },
  {
    questionText: 'Which HTTP status code is most appropriate when a requested resource is throttled due to rate limits?',
    options: ['A. 400 Bad Request', 'B. 403 Forbidden', 'C. 429 Too Many Requests', 'D. 503 Service Unavailable'],
    correctAnswer: 'C',
    explanation: 'HTTP 429 Too Many Requests indicates the client has sent too many requests in a given amount of time (rate limited).'
  },
  {
    questionText: 'What is the fundamental benefit of database indexing using B-Trees?',
    options: [
      'A. Reduces write amplification to zero',
      'B. Reduces search time complexity from O(N) to O(log N)',
      'C. Eliminates the need for foreign key constraints',
      'D. Encrypts disk pages automatically'
    ],
    correctAnswer: 'B',
    explanation: 'B-Tree indexes allow logarithmic O(log N) search, insertion, and deletion times instead of scanning all table records.'
  },
  {
    questionText: 'What is the purpose of React.memo?',
    options: [
      'A. To cache API network requests in localStorage',
      'B. To prevent unnecessary re-renders of a functional component when its props have not changed',
      'C. To memoize expensive calculations inside component render body',
      'D. To handle asynchronous state updates in concurrent mode'
    ],
    correctAnswer: 'B',
    explanation: 'React.memo is a higher-order component that memoizes the rendered output, skipping re-renders if props are shallowly equal.'
  }
];

const generateMcqQuestions = async (role, difficulty, count = 5, company = null) => {
  const safeCount = Math.max(1, Math.min(Number(count) || 5, 30));
  const batchSize = Math.max(1, Math.min(Number(process.env.OPENROUTER_BATCH_SIZE) || 5, 10));

  if (!process.env.OPENROUTER_API_KEY) {
    console.warn(`[AI] OPENROUTER_API_KEY is not set. Using curated question pool for "${role}" (${difficulty}).`);
    return FALLBACK_BANK.slice(0, safeCount).map((q, idx) => ({
      ...normalizeQuestion(q, idx),
      questionId: `q${idx + 1}`,
    }));
  }

  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_API_URL,
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
      'X-Title': process.env.OPENROUTER_SITE_NAME || 'MockMate Pro',
    },
  });

  const allQuestions = [];
  while (allQuestions.length < safeCount) {
    const remaining = safeCount - allQuestions.length;
    const currentBatchSize = Math.min(batchSize, remaining);

    let batchQuestions = [];
    let lastErr = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        batchQuestions = await requestQuestionsBatch({
          client,
          role,
          difficulty,
          count: currentBatchSize,
          company,
        });
        lastErr = null;
        break;
      } catch (err) {
        logProviderError(`requestQuestionsBatch/attempt-${attempt}`, err);
        lastErr = err;
      }
    }

    if (!batchQuestions.length) {
      console.warn(`[AI] AI provider unavailable (${lastErr?.message}). Falling back to curated questions.`);
      return FALLBACK_BANK.slice(0, safeCount).map((q, idx) => ({
        ...normalizeQuestion(q, idx),
        questionId: `q${idx + 1}`,
      }));
    }

    allQuestions.push(...batchQuestions.slice(0, currentBatchSize));
  }

  // Ensure unique question IDs across the full session even if upstream returns duplicates.
  return allQuestions.slice(0, safeCount).map((q, idx) => {
    const normalized = normalizeQuestion(q, idx);
    return {
      ...normalized,
      questionId: `q${idx + 1}`,
    };
  });
};






module.exports = { generateMcqQuestions };