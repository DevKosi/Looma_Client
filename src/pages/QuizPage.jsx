import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/firebaseConfig';
import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiArrowRight, FiCheck, FiClock } from 'react-icons/fi';

export default function QuizPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const accessCode = new URLSearchParams(location.search).get('code');

  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const quizRef = doc(db, 'quizzes', id);
        const quizSnap = await getDoc(quizRef);
        if (!quizSnap.exists()) return navigate('/dashboard');

        const quizData = quizSnap.data();
        if (!quizData.questions || quizData.questions.length === 0) {
          throw new Error('This quiz has no questions');
        }

        setQuiz(quizData);
        setTimeLeft(quizData.timeLimit * 60);
      } catch (err) {
        setError(err.message);
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [id, navigate]);

  useEffect(() => {
    if (!timeLeft || submitted) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, submitted]);

  const handleSelect = (questionId, optionId) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
  };

  const handleNextQuestion = () => {
    if (!quiz || !quiz.questions) return;
    setCurrentQuestion(prev => {
      const next = prev + 1;
      return next < quiz.questions.length ? next : prev;
    });
  };

  const handlePrevQuestion = () => {
    setCurrentQuestion(prev => (prev > 0 ? prev - 1 : 0));
  };

  const handleSubmit = async () => {
    if (!quiz || submitted) return;
    setSubmitted(true);

    let correct = 0;
    quiz.questions.forEach(q => {
      const selected = answers[q.id];
      const correctOption = (q.options || [
        { id: 'true', correct: true },
        { id: 'false', correct: false }
      ]).find(opt => opt.correct);
      if (selected === correctOption?.id) correct += q.points || 1;
    });
    setScore(correct);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      // Fetch user data from Firestore to get registration number
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();

      await addDoc(collection(db, 'quizzes', id, 'submissions'), {
        userId: currentUser.uid,
        regNumber: userData?.regNumber || 'Anonymous',
        fullName: userData?.fullName || 'Unknown',
        department: userData?.department || 'Unknown',
        score: correct,
        total: quiz.questions.length,
        accessCode,
        submittedAt: serverTimestamp(),
        answers,
      });
    } catch (err) {
      console.error('Failed to save result:', err);
    }
  };

  if (loading) return <div className="h-screen flex justify-center items-center">Loading...</div>;

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <FiCheck className="text-green-600 text-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Quiz Completed!</h1>
          <p className="text-gray-600 mt-2 mb-6">
            You scored <span className="text-blue-600 font-bold">{score}</span> out of{' '}
            <span className="font-semibold">{quiz.questions.length}</span>
          </p>
          <button
            onClick={() => navigate('/student-dashboard')}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-lg"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const question = quiz.questions[currentQuestion];
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeColor = timeLeft <= 60 ? 'text-red-600 animate-pulse' : 'text-gray-800';
  const defaultBooleanOptions = [
    { id: 'true', text: 'True', correct: true },
    { id: 'false', text: 'False', correct: false }
  ];
  const displayedOptions = question.options?.length
    ? question.options
    : question.type === 'boolean'
      ? defaultBooleanOptions
      : [];

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{quiz.title}</h1>
            <p className="text-gray-600">{quiz.description}</p>
          </div>
          <div className={`flex items-center bg-gray-100 px-4 py-2 rounded-lg ${timeColor}`}>
            <FiClock className="mr-2" />
            <span className="font-mono">
              {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Navigation boxes */}
        <div className="p-4 border-b flex flex-wrap gap-2">
          {quiz.questions.map((q, index) => (
            <button
              key={q.id}
              onClick={() => setCurrentQuestion(index)}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm ${currentQuestion === index
                  ? 'bg-blue-600 text-white'
                  : answers[q.id]
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-200 text-gray-700'
                }`}
            >
              {index + 1}
            </button>
          ))}
        </div>

        {/* Question area */}
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">{question.text}</h2>
          <div className="space-y-3">
            {displayedOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleSelect(question.id, opt.id)}
                className={`w-full text-left p-4 rounded-lg border transition-all ${answers[question.id] === opt.id
                    ? 'border-blue-500 bg-blue-50 shadow-inner'
                    : 'border-gray-200 hover:bg-gray-100'
                  }`}
              >
                {opt.text}
              </button>
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8">
            <button
              disabled={currentQuestion === 0}
              onClick={handlePrevQuestion}
              className={`flex items-center px-4 py-2 rounded-lg ${currentQuestion === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              <FiArrowLeft className="mr-2" />
              Prev
            </button>

            {currentQuestion < quiz.questions.length - 1 ? (
              <button
                onClick={handleNextQuestion}
                className="flex items-center px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Next
                <FiArrowRight className="ml-2" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Submit Quiz
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

