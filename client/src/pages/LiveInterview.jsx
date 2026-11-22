import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { interviewAPI, sessionAPI } from '../services/api';
import toast from 'react-hot-toast';

// ── Voice Activity Detection (silence = 1.8s) ───────────────────
const SILENCE_MS   = 1800;   // stop listening after 1.8s silence
const NO_RESPONSE_MS = 60_000; // repeat question after 1 minute of no response
// ── States ───────────────────────────────────────────────────────
const STATES = {
  LOADING:    'loading',     // AI generating first question
  AI_SPEAK:   'ai_speaking', // AI question is being read aloud (TTS)
  LISTENING:  'listening',   // mic ON, user speaking
  PROCESSING: 'processing',  // sending to AI
  FEEDBACK:   'feedback',    // brief AI reaction shown
  DONE:       'done',        // interview complete
};

const LiveInterview = () => {
  const { id } = useParams();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [session, setSession]             = useState(location.state?.session || null);
  const [firstQuestion, setFirstQuestion] = useState(location.state?.firstQuestion || '');

  // ── state ──────────────────────────────────────────────────────
  const [uiState, setUiState]             = useState(STATES.LOADING);
  const [currentQuestion, setCurrentQ]   = useState('');
  const [currentQNum, setCurrentQNum]    = useState(1);
  const [userTranscript, setTranscript]  = useState('');
  const [interimText, setInterim]        = useState('');
  const [aiFeedback, setAiFeedback]      = useState('');
  const [conversationHistory, setHistory] = useState([]);
  const [micAllowed, setMicAllowed]      = useState(false);
  const [dots, setDots]                  = useState('');

  // ── refs ───────────────────────────────────────────────────────
  const recognitionRef  = useRef(null);
  const silenceTimer    = useRef(null);
  const noResponseTimer = useRef(null);
  const utteranceRef    = useRef(null);
  const transcriptRef   = useRef('');
  const currentQuestionRef = useRef('');
  const handleAnswerRef = useRef(null);
  const startListeningRef = useRef(null);
  const finishInterviewRef = useRef(null);

  const totalQ = session?.totalQuestions || 5;

  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
  }, [currentQuestion]);

  // Animated dots for "AI is thinking"
  useEffect(() => {
    if (uiState !== STATES.PROCESSING && uiState !== STATES.LOADING) return;
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(t);
  }, [uiState]);

  // ── TTS: AI speaks the question ────────────────────────────────
  const speakText = useCallback((text, onDone) => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate  = 0.92;
    utter.pitch = 1.0;
    // prefer a natural-sounding voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Google UK English Female') ||
      v.name.includes('Samantha') ||
      v.name.includes('Karen') ||
      v.name.includes('Female')
    );
    if (preferred) utter.voice = preferred;
    utter.onend = () => onDone && onDone();
    utteranceRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, []);

  const clearNoResponseTimeout = useCallback(() => {
    if (noResponseTimer.current) {
      clearTimeout(noResponseTimer.current);
      noResponseTimer.current = null;
    }
  }, []);

  const scheduleNoResponseTimeout = useCallback(() => {
    clearNoResponseTimeout();
    noResponseTimer.current = setTimeout(() => {
      if (transcriptRef.current.trim().length > 2) return;

      recognitionRef.current?.abort();

      const repeatText = `I did not hear your response. I will repeat the question. ${
        currentQuestionRef.current || 'Please introduce yourself.'
      }`;

      setUiState(STATES.AI_SPEAK);
      speakText(repeatText, () => {
        setUiState(STATES.LISTENING);
        startListeningRef.current?.();
      });
    }, NO_RESPONSE_MS);
  }, [clearNoResponseTimeout, speakText]);

  // ── STT: Start mic ─────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported. Use Chrome or Edge.');
      setMicAllowed(false);
      setUiState(STATES.LISTENING);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.lang            = 'en-IN';  // Indian English
    rec.maxAlternatives = 1;

    transcriptRef.current = '';
    setTranscript('');
    setInterim('');

    rec.onresult = (e) => {
      let interim = '';
      let final   = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + ' ';
        else interim += t;
      }
      if (final) {
        transcriptRef.current += final;
        setTranscript(transcriptRef.current);
      }
      setInterim(interim);

      // Any speech activity resets the no-response timeout.
      scheduleNoResponseTimeout();

      // Reset silence timer every time user speaks
      clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => {
        if (transcriptRef.current.trim().length > 3) {
          rec.stop();
        }
      }, SILENCE_MS);
    };

    rec.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        toast.error(`Mic error: ${e.error}`);
      }
    };

    rec.onend = () => {
      clearTimeout(silenceTimer.current);
      clearNoResponseTimeout();
      const answer = transcriptRef.current.trim();
      if (answer.length > 2) {
        handleAnswerRef.current?.(answer);
      } else {
        // Nothing captured — show manual fallback
        setUiState(STATES.LISTENING);
      }
    };

    recognitionRef.current = rec;
    rec.start();
    setUiState(STATES.LISTENING);
    scheduleNoResponseTimeout();
  }, [clearNoResponseTimeout, scheduleNoResponseTimeout]);

  // ── Stop mic manually ─────────────────────────────────────────
  const stopListening = () => {
    clearTimeout(silenceTimer.current);
    clearNoResponseTimeout();
    recognitionRef.current?.stop();
  };

  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  // ── Restore session if page reloaded ───────────────────────────
  useEffect(() => {
    if (session) return;
    let mounted = true;
    sessionAPI.getSession(id)
      .then(async (res) => {
        if (!mounted) return;
        const s = res.data?.session;
        if (!s) {
          navigate('/interview-setup');
          return;
        }
        if (s.completedAt) {
          navigate(`/feedback/${id}`, { state: { result: s } });
          return;
        }
        const totalQuestions = Number(s.count) || 5;
        if ((Number(s.lastAnsweredQuestionNumber) || 0) >= totalQuestions) {
          try {
            const { data } = await interviewAPI.finish(id, {});
            if (data?.success) {
              navigate(`/feedback/${data.sessionId}`, { state: { evaluation: data.evaluation } });
              return;
            }
          } catch {
            toast.error('Could not restore the completed interview. Please try again from History.');
          }
          navigate('/history');
          return;
        }
        const restoredHistory = Array.isArray(s.conversationHistory) && s.conversationHistory.length
          ? s.conversationHistory
          : [{ role: 'assistant', content: s.firstQuestion || `Could you describe your experience in ${s.role}?` }];
        const restoredQuestion = s.currentQuestion || [...restoredHistory].reverse()
          .find((message) => message.role === 'assistant')?.content || `Could you describe your experience in ${s.role}?`;

        setHistory(restoredHistory);
        setCurrentQNum(Number(s.currentQuestionNumber) || 1);
        setFirstQuestion(restoredQuestion);
        setSession({
          id: s._id,
          role: s.role,
          difficulty: s.difficulty,
          level: s.level || (s.difficulty === 'hard' ? 'Senior' : s.difficulty === 'medium' ? 'Junior' : 'Fresher'),
          totalQuestions,
        });
      })
      .catch(() => {
        if (!mounted) return;
        navigate('/interview-setup');
      });
    return () => { mounted = false; };
  }, [id, session, firstQuestion, navigate]);

  // ── Show first question once loaded ───────────────────────────
  useEffect(() => {
    if (!session || !firstQuestion) {
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Your browser does not support microphone access.');
      setMicAllowed(false);
      setCurrentQ(firstQuestion);
      setHistory((history) => history.length ? history : [{ role: 'assistant', content: firstQuestion }]);
      setUiState(STATES.LISTENING);
    } else {
      navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
        .then(() => {
          setMicAllowed(true);
          setCurrentQ(firstQuestion);
          setHistory((history) => history.length ? history : [{ role: 'assistant', content: firstQuestion }]);
          setUiState(STATES.AI_SPEAK);
          speakText(firstQuestion, () => {
            setUiState(STATES.LISTENING);
            startListening();
          });
        })
        .catch((e) => {
          console.error('Microphone permission error:', e);
          toast.error('Microphone access denied. Please allow mic in browser settings.');
          setMicAllowed(false);
          setCurrentQ(firstQuestion);
          setHistory((history) => history.length ? history : [{ role: 'assistant', content: firstQuestion }]);
          setUiState(STATES.LISTENING);
        });
    }

    return () => {
      window.speechSynthesis.cancel();
      clearTimeout(silenceTimer.current);
      clearNoResponseTimeout();
      recognitionRef.current?.abort();
    };
  }, [clearNoResponseTimeout, navigate, session, firstQuestion, speakText, startListening]);

  // ── Handle user answer → send to AI ───────────────────────────
  const handleAnswer = useCallback(async (answer) => {
    if (!answer?.trim()) return;

    window.speechSynthesis.cancel();
    clearNoResponseTimeout();
    setUiState(STATES.PROCESSING);
    setTranscript(answer);
    setInterim('');

    const updatedHistory = [
      ...conversationHistory,
      { role: 'user', content: answer },
    ];
    setHistory(updatedHistory);

    try {
      const { data } = await interviewAPI.respond(id, {
        userAnswer: answer,
        conversationHistory: updatedHistory,
        questionNumber: currentQNum,
        totalQuestions: totalQ,
        level: session?.level || 'Junior',
      });

      if (!data.success) throw new Error(data.message);

      const newHistory = data.conversationHistory || [
        ...updatedHistory,
        ...(data.nextQuestion ? [{ role: 'assistant', content: data.nextQuestion }] : []),
      ];
      setHistory(newHistory);
      setAiFeedback(data.feedback || '');
      setUiState(STATES.FEEDBACK);

      // Show brief feedback for 2s, then speak next question
      setTimeout(() => {
        if (data.isLast || !data.nextQuestion) {
          finishInterviewRef.current?.(newHistory);
        } else {
          const nextNum = Number(data.currentQuestionNumber) || currentQNum + 1;
          setCurrentQNum(nextNum);
          setCurrentQ(data.nextQuestion);
          setTranscript('');
          setInterim('');
          setUiState(STATES.AI_SPEAK);
          speakText(data.nextQuestion, () => {
            startListeningRef.current?.();
          });
        }
      }, 2000);
    } catch {
      setHistory(conversationHistory);
      setTranscript('');
      transcriptRef.current = '';
      toast.error('AI failed to respond. Please try again.');
      setUiState(STATES.LISTENING);
    }
  }, [clearNoResponseTimeout, conversationHistory, currentQNum, id, session, totalQ, speakText]);

  useEffect(() => {
    handleAnswerRef.current = handleAnswer;
  }, [handleAnswer]);

  // ── Finish — get full evaluation ──────────────────────────────
  const finishInterview = useCallback(async (history) => {
    setUiState(STATES.DONE);
    try {
      const { data } = await interviewAPI.finish(id, {
        conversationHistory: history || conversationHistory,
        level: session?.level || 'Junior',
      });
      if (!data.success) throw new Error(data.message);
      navigate(`/feedback/${data.sessionId}`, { state: { evaluation: data.evaluation } });
    } catch {
      toast.error('Could not save results. Redirecting to dashboard.');
      navigate('/dashboard');
    }
  }, [conversationHistory, id, navigate, session]);

  useEffect(() => {
    finishInterviewRef.current = finishInterview;
  }, [finishInterview]);

  // ── Manual text submit (fallback when mic fails) ──────────────
  const manualInputRef = useRef(null);
  const handleManualSubmit = () => {
    const val = manualInputRef.current?.value?.trim();
    if (!val) return toast.error('Please type your answer first');
    if (recognitionRef.current) recognitionRef.current.abort();
    handleAnswer(val);
    if (manualInputRef.current) manualInputRef.current.value = '';
  };

  // ── Progress ──────────────────────────────────────────────────
  const progress = Math.round((Math.max(0, currentQNum) / totalQ) * 100);

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <Navbar />

      {/* Progress Bar */}
      <div className="w-full h-1 bg-stone-800">
        <div
          className="h-full bg-brand-700 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-4">
          <div>
            <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">Technical Assessment</p>
            <h1 className="text-sm font-bold text-white capitalize">
              {session?.role || 'Interview'} · {session?.level || 'Junior'}
            </h1>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-stone-500">Progress</span>
            <p className="text-base font-bold text-brand-400">
              {currentQNum === 0 ? 'Intro' : `Q${currentQNum}`}{' '}
              <span className="text-stone-500 text-xs font-normal">/ {totalQ}</span>
            </p>
          </div>
        </div>

        {/* Interviewer Status */}
        <div className="flex flex-col items-center gap-3 py-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${
            uiState === STATES.AI_SPEAK   ? 'bg-brand-700 border-brand-500 text-white' :
            uiState === STATES.LISTENING  ? 'bg-emerald-950 border-emerald-600 text-emerald-400' :
            uiState === STATES.PROCESSING ? 'bg-stone-800 border-stone-700 text-stone-300' :
            uiState === STATES.FEEDBACK   ? 'bg-stone-800 border-stone-700 text-white' :
                                            'bg-stone-900 border-stone-800 text-stone-500'
          }`}>
            <span className="text-xs font-bold tracking-wider uppercase">
              {uiState === STATES.AI_SPEAK   ? 'Audio' :
               uiState === STATES.LISTENING  ? 'Mic' :
               uiState === STATES.PROCESSING ? 'Eval' :
               uiState === STATES.FEEDBACK   ? 'Note' :
               uiState === STATES.DONE       ? 'Done' : 'Wait'}
            </span>
          </div>

          <p className={`text-xs font-semibold tracking-wide ${
            uiState === STATES.AI_SPEAK   ? 'text-brand-400' :
            uiState === STATES.LISTENING  ? 'text-emerald-400' :
            uiState === STATES.PROCESSING ? 'text-amber-400' :
            uiState === STATES.FEEDBACK   ? 'text-stone-300' :
                                            'text-stone-400'
          }`}>
            {uiState === STATES.LOADING    ? `Initializing evaluation environment${dots}` :
             uiState === STATES.AI_SPEAK   ? 'Interviewer is speaking...' :
             uiState === STATES.LISTENING  ? 'Microphone active — speak your answer' :
             uiState === STATES.PROCESSING ? `Processing response${dots}` :
             uiState === STATES.FEEDBACK   ? 'Reviewing points...' :
             uiState === STATES.DONE       ? 'Compiling scorecard...' : ''}
          </p>
        </div>

        {/* Current Question Card */}
        {currentQuestion && (
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-xs">
            <p className="text-[10px] text-brand-400 font-bold uppercase tracking-wider mb-2">
              {currentQNum === 0 ? 'Introduction' : `Question ${currentQNum}`}
            </p>
            <p className="text-stone-100 text-sm leading-relaxed">{currentQuestion}</p>
          </div>
        )}

        {/* AI Quick Feedback */}
        {uiState === STATES.FEEDBACK && aiFeedback && (
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 flex-shrink-0" />
            <p className="text-stone-300 text-xs leading-relaxed">{aiFeedback}</p>
          </div>
        )}

        {/* User Transcript (live) */}
        {(uiState === STATES.LISTENING || uiState === STATES.PROCESSING) && (
          <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 min-h-[72px]">
            <p className="text-[10px] uppercase font-bold text-stone-500 mb-1.5">Recorded Response</p>
            <p className="text-stone-200 text-xs leading-relaxed">
              {userTranscript}
              <span className="text-stone-500 italic ml-1">{interimText}</span>
              {!userTranscript && !interimText && uiState === STATES.LISTENING && (
                <span className="text-stone-600 italic">Listening for speech...</span>
              )}
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col gap-2.5">
          {uiState === STATES.LISTENING && (
            <button
              onClick={stopListening}
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span className="w-2 h-2 bg-white rounded-full" />
              Complete Answer & Submit
            </button>
          )}

          {uiState === STATES.LISTENING && !micAllowed && (
            <div className="flex gap-2">
              <input
                ref={manualInputRef}
                type="text"
                placeholder="Type your response here..."
                className="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-brand-700"
                onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
              />
              <button
                onClick={handleManualSubmit}
                className="px-4 py-2 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-lg text-xs transition-all cursor-pointer"
              >
                Submit
              </button>
            </div>
          )}

          {(uiState === STATES.LISTENING || uiState === STATES.AI_SPEAK) && currentQNum > 1 && (
            <button
              onClick={() => {
                window.speechSynthesis.cancel();
                recognitionRef.current?.abort();
                finishInterview(conversationHistory);
              }}
              className="w-full py-2 text-xs text-stone-500 hover:text-rose-400 transition-colors"
            >
              End assessment early
            </button>
          )}
        </div>

        {/* Conversation log (collapsed) */}
        {conversationHistory.length > 2 && (
          <details className="bg-stone-900 border border-stone-800 rounded-xl p-4">
            <summary className="text-[11px] font-semibold text-stone-500 cursor-pointer select-none">
              Transcript history ({conversationHistory.length} exchanges)
            </summary>
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pt-2 border-t border-stone-800">
              {conversationHistory.map((m, i) => (
                <div
                  key={i}
                  className={`text-xs rounded p-2.5 ${
                    m.role === 'assistant'
                      ? 'bg-stone-800/80 text-stone-200 border-l-2 border-brand-700'
                      : 'bg-stone-900 text-stone-400'
                  }`}
                >
                  <span className="font-bold text-stone-500 mr-1.5 uppercase text-[10px]">
                    {m.role === 'assistant' ? 'Interviewer' : 'Candidate'}:
                  </span>
                  {m.content}
                </div>
              ))}
            </div>
          </details>
        )}

      </div>
    </div>
  );
};

export default LiveInterview;
