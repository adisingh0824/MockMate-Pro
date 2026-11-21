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

const CURATED_QUESTIONS_BY_TRACK = {
  frontend: [
    {
      questionText: 'What is the primary difference between useEffect and useLayoutEffect in React?',
      options: [
        'A. useEffect runs synchronously before paint, useLayoutEffect runs asynchronously after paint',
        'B. useLayoutEffect runs synchronously immediately after DOM mutations before paint, useEffect runs after paint',
        'C. useEffect is only for server-side rendering while useLayoutEffect is for client-side',
        'D. There is no difference; they are aliases for the same underlying hook',
      ],
      correctAnswer: 'B',
      explanation: 'useLayoutEffect fires synchronously after all DOM mutations but before the browser repaints the screen, making it suitable for measuring layout or synchronizing DOM reads/writes.',
    },
    {
      questionText: 'What is the purpose of React.memo?',
      options: [
        'A. To cache API network requests in localStorage',
        'B. To prevent unnecessary re-renders of a functional component when its props have not changed',
        'C. To memoize expensive calculations inside component render body',
        'D. To handle asynchronous state updates in concurrent mode',
      ],
      correctAnswer: 'B',
      explanation: 'React.memo is a higher-order component that memoizes the rendered output, skipping re-renders if props are shallowly equal.',
    },
    {
      questionText: 'How does the browser event loop prioritize Microtasks versus Macrotasks (Task Queue)?',
      options: [
        'A. Macrotasks always run before Microtasks',
        'B. All queued Microtasks are executed to completion before the next Macrotask is processed',
        'C. Microtasks and Macrotasks run in parallel on separate browser threads',
        'D. Microtasks only run when the user interacts with the UI',
      ],
      correctAnswer: 'B',
      explanation: 'After every macrotask completes, the JavaScript runtime exhausts the microtask queue (Promise callbacks, queueMicrotask) before rendering or pulling the next macrotask.',
    },
    {
      questionText: 'Which CSS property enables GPU acceleration for animations and transforms without triggering layout reflows?',
      options: [
        'A. will-change / transform: translateZ(0)',
        'B. position: relative',
        'C. display: flex',
        'D. box-sizing: border-box',
      ],
      correctAnswer: 'A',
      explanation: 'transform and opacity can be composited directly on the GPU, avoiding the CPU layout and paint pipeline.',
    },
    {
      questionText: 'What is the key purpose of the useCallback hook in React?',
      options: [
        'A. To execute side effects immediately when a component unmounts',
        'B. To memoize a callback function instance between renders, preventing reference inequality bugs in children',
        'C. To asynchronously fetch data from REST APIs',
        'D. To mutate DOM nodes directly',
      ],
      correctAnswer: 'B',
      explanation: 'useCallback returns a memoized version of the callback that only changes if one of the dependencies has changed.',
    },
    {
      questionText: 'In modern Web Performance, what does Largest Contentful Paint (LCP) measure?',
      options: [
        'A. The time taken to establish the first TLS handshake with the server',
        'B. The render time of the largest image or text block visible within the viewport',
        'C. The time between user click and response execution',
        'D. The total size of JavaScript bundles downloaded',
      ],
      correctAnswer: 'B',
      explanation: 'LCP is a Core Web Vital that marks the point in the page load timeline when the main content has likely loaded.',
    },
    {
      questionText: 'What is the primary vulnerability prevented by implementing Content Security Policy (CSP)?',
      options: [
        'A. Cross-Site Scripting (XSS)',
        'B. SQL Injection',
        'C. Distributed Denial of Service (DDoS)',
        'D. Buffer Overflow',
      ],
      correctAnswer: 'A',
      explanation: 'CSP restricts the sources from which scripts, styles, and other resources can be loaded and executed, mitigating XSS attacks.',
    },
    {
      questionText: 'What happens when you update state in React 18 during a timeout or promise resolution?',
      options: [
        'A. Automatic batching groups state updates together into a single re-render',
        'B. Each state setter triggers a separate synchronous re-render',
        'C. It throws an unhandled rejection error',
        'D. The component unmounts and remounts immediately',
      ],
      correctAnswer: 'A',
      explanation: 'React 18 introduces automatic batching for all state updates, including those inside promises, setTimeout, and native event handlers.',
    },
  ],
  backend: [
    {
      questionText: 'In Node.js, what is the primary role of the Libuv library?',
      options: [
        'A. Providing template engine rendering for Express',
        'B. Providing a cross-platform asynchronous I/O thread pool and event loop',
        'C. Handling JWT cryptographic signing',
        'D. Parsing incoming multipart/form-data requests',
      ],
      correctAnswer: 'B',
      explanation: 'Libuv is a multi-platform C library that handles the event loop, thread pool, asynchronous file/network I/O in Node.js.',
    },
    {
      questionText: 'What does the ACID acronym stand for in relational databases?',
      options: [
        'A. Atomicity, Consistency, Isolation, Durability',
        'B. Asynchronous, Concurrent, Isolated, Distributed',
        'C. Availability, Consistency, Integrity, Dependency',
        'D. Authorization, Compression, Indexing, Decryption',
      ],
      correctAnswer: 'A',
      explanation: 'ACID guarantees database transaction reliability: Atomicity, Consistency, Isolation, and Durability.',
    },
    {
      questionText: 'What is the fundamental benefit of database indexing using B-Trees?',
      options: [
        'A. Reduces write amplification to zero',
        'B. Reduces search time complexity from O(N) to O(log N)',
        'C. Eliminates the need for foreign key constraints',
        'D. Encrypts disk pages automatically',
      ],
      correctAnswer: 'B',
      explanation: 'B-Tree indexes allow logarithmic O(log N) search, insertion, and deletion times instead of scanning all table records.',
    },
    {
      questionText: 'Which HTTP status code is most appropriate when a requested resource is throttled due to rate limits?',
      options: ['A. 400 Bad Request', 'B. 403 Forbidden', 'C. 429 Too Many Requests', 'D. 503 Service Unavailable'],
      correctAnswer: 'C',
      explanation: 'HTTP 429 Too Many Requests indicates the client has sent too many requests in a given amount of time (rate limited).',
    },
    {
      questionText: 'What is the main advantage of connection pooling in backend database drivers?',
      options: [
        'A. Reuses existing authenticated database connections to eliminate TCP/TLS handshake latency',
        'B. Automatically translates SQL queries into NoSQL queries',
        'C. Eliminates the need for indexes in tables',
        'D. Prevents SQL injection vulnerabilities',
      ],
      correctAnswer: 'A',
      explanation: 'Connection pooling maintains a cache of database connections, eliminating the high overhead of establishing new TCP/TLS connections for every query.',
    },
    {
      questionText: 'What pattern is best suited to guarantee idempotency in payment and order processing APIs?',
      options: [
        'A. Using unique Idempotency Keys stored with transaction status in an atomic cache or database table',
        'B. Relying on HTTP GET requests for state mutations',
        'C. Disabling database transactions',
        'D. Increasing server timeout to 10 minutes',
      ],
      correctAnswer: 'A',
      explanation: 'An idempotency key uniquely identifies the request so repeated network retries return the original cached response without re-executing charges.',
    },
    {
      questionText: 'How does Redis achieve single-threaded high performance for data operations?',
      options: [
        'A. In-memory data storage, non-blocking multiplexed I/O (epoll/kqueue), and avoidance of thread synchronization locks',
        'B. Compiling queries into GPU assembly at runtime',
        'C. Writing all data synchronously to spinning hard disks before acknowledging',
        'D. Relying on client-side CPU execution',
      ],
      correctAnswer: 'A',
      explanation: 'Redis operates in RAM and uses an event-driven multiplexed event loop, bypassing costly thread context switches and locking mechanisms.',
    },
    {
      questionText: 'In distributed systems, what does the CAP theorem state?',
      options: [
        'A. A distributed data store can simultaneously provide at most two of Consistency, Availability, and Partition Tolerance',
        'B. All microservices must use the same relational database engine',
        'C. Network latency can never exceed processing time',
        'D. Cloud deployments must span at least three continents',
      ],
      correctAnswer: 'A',
      explanation: 'Under network partitions, a distributed system must choose between consistency (rejecting writes/reads) or availability (accepting writes/reads that might be stale).',
    },
  ],
  general: [
    {
      questionText: 'What is the runtime complexity of accessing a key in a Hash Map on average?',
      options: ['A. O(1)', 'B. O(log n)', 'C. O(n)', 'D. O(n log n)'],
      correctAnswer: 'A',
      explanation: 'Hash maps provide average O(1) constant time complexity for key lookups.',
    },
    {
      questionText: 'What is the time complexity of searching an element in a balanced Binary Search Tree (AVL / Red-Black Tree)?',
      options: ['A. O(1)', 'B. O(log N)', 'C. O(N)', 'D. O(N^2)'],
      correctAnswer: 'B',
      explanation: 'In a balanced binary search tree, the height is bounded by O(log N), guaranteeing logarithmic search time.',
    },
    {
      questionText: 'Which data structure is fundamentally used for Breadth-First Search (BFS) graph traversal?',
      options: ['A. Stack', 'B. Queue', 'C. Priority Queue', 'D. Hash Table'],
      correctAnswer: 'B',
      explanation: 'Breadth-First Search uses a First-In-First-Out (FIFO) queue to visit all neighbors at the present depth level before moving to the next level.',
    },
    {
      questionText: 'What is the difference between a Process and a Thread in operating systems?',
      options: [
        'A. Processes share memory space by default, while threads have isolated memory spaces',
        'B. A process has its own independent address space, while threads of the same process share the same memory space',
        'C. Threads can only run on single-core CPUs',
        'D. Processes do not consume CPU time',
      ],
      correctAnswer: 'B',
      explanation: 'Processes have independent virtual memory address spaces, while threads within the same process share code, data, and open file descriptors.',
    },
    {
      questionText: 'What is the primary function of a reverse proxy like Nginx?',
      options: [
        'A. To execute database queries directly for client browsers',
        'B. To sit in front of backend servers, handling SSL termination, load balancing, compression, and request routing',
        'C. To compile client-side React code at runtime',
        'D. To replace DNS servers globally',
      ],
      correctAnswer: 'B',
      explanation: 'Reverse proxies intercept incoming client traffic, offloading SSL/TLS termination, balancing load across worker instances, and caching static assets.',
    },
    {
      questionText: 'Which sorting algorithm has a worst-case time complexity of O(N log N) and is stable?',
      options: ['A. QuickSort', 'B. MergeSort', 'C. HeapSort', 'D. SelectionSort'],
      correctAnswer: 'B',
      explanation: 'MergeSort guarantees O(N log N) time complexity in all cases (worst, average, best) and preserves the relative order of equal elements (stable).',
    },
    {
      questionText: 'What is a JSON Web Token (JWT) signature used for?',
      options: [
        'A. To encrypt the payload so its contents are hidden from the client',
        'B. To verify that the sender of the JWT is who it says it is and to ensure the message wasn\'t changed along the way',
        'C. To compress the JSON payload into binary format',
        'D. To store the user\'s password in plain text',
      ],
      correctAnswer: 'B',
      explanation: 'The signature is created by hashing the header and payload with a secret key. It verifies data integrity and authenticity, but does not encrypt the payload.',
    },
    {
      questionText: 'What is the main goal of CI/CD (Continuous Integration / Continuous Delivery)?',
      options: [
        'A. To automate building, testing, and deployment to deliver software updates frequently and reliably',
        'B. To eliminate the need for writing unit tests',
        'C. To monitor production databases only during business hours',
        'D. To replace version control systems like Git',
      ],
      correctAnswer: 'A',
      explanation: 'CI/CD automates code integration, testing, and deployment pipelines, reducing manual error and accelerating release velocity.',
    },
  ],
};

const getCuratedQuestions = (role = '', difficulty = 'medium', count = 5, company = null) => {
  const safeCount = Math.max(1, Math.min(Number(count) || 5, 30));
  const roleLower = String(role).toLowerCase();

  let selectedPool = [];
  if (roleLower.includes('front') || roleLower.includes('react') || roleLower.includes('ui') || roleLower.includes('web')) {
    selectedPool = [...CURATED_QUESTIONS_BY_TRACK.frontend, ...CURATED_QUESTIONS_BY_TRACK.general, ...CURATED_QUESTIONS_BY_TRACK.backend];
  } else if (roleLower.includes('back') || roleLower.includes('node') || roleLower.includes('api') || roleLower.includes('devops') || roleLower.includes('system') || roleLower.includes('data')) {
    selectedPool = [...CURATED_QUESTIONS_BY_TRACK.backend, ...CURATED_QUESTIONS_BY_TRACK.general, ...CURATED_QUESTIONS_BY_TRACK.frontend];
  } else {
    selectedPool = [...CURATED_QUESTIONS_BY_TRACK.general, ...CURATED_QUESTIONS_BY_TRACK.backend, ...CURATED_QUESTIONS_BY_TRACK.frontend];
  }

  const result = [];
  for (let i = 0; i < safeCount; i++) {
    const template = selectedPool[i % selectedPool.length];
    const qIndex = i + 1;
    result.push({
      questionId: `q${qIndex}`,
      questionText: `${company ? `[${company}] ` : ''}${template.questionText}`,
      options: template.options,
      correctAnswer: template.correctAnswer,
      explanation: template.explanation,
    });
  }

  return result.map((q, idx) => ({
    ...normalizeQuestion(q, idx),
    questionId: `q${idx + 1}`,
  }));
};

const generateMcqQuestions = async (role, difficulty, count = 5, company = null) => {
  const safeCount = Math.max(1, Math.min(Number(count) || 5, 30));
  const batchSize = Math.max(1, Math.min(Number(process.env.OPENROUTER_BATCH_SIZE) || 5, 10));

  if (!process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
    console.warn(`[AI] OPENROUTER_API_KEY is not set. Using curated question pool for "${role}" (${difficulty}, count: ${safeCount}).`);
    return getCuratedQuestions(role, difficulty, safeCount, company);
  }

  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENROUTER_API_URL || undefined,
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
      return getCuratedQuestions(role, difficulty, safeCount, company);
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