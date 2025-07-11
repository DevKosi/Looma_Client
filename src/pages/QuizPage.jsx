import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/firebaseConfig';
import React, { useEffect, useState } from 'react';
import { FiArrowLeft, FiArrowRight, FiCheck, FiClock, FiAlertTriangle } from 'react-icons/fi';

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
  const [submissionError, setSubmissionError] = useState(null);

  // Shuffle function to randomize questions
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const quizRef = doc(db, 'quizzes', id);
        const quizSnap = await getDoc(quizRef);
        
        if (!quizSnap.exists()) {
          throw new Error('Quiz not found');
        }

        const quizData = quizSnap.data();
        
        if (!quizData.questions || quizData.questions.length === 0) {
          throw new Error('This quiz has no questions available');
        }

        // Get the number of questions to render (default to all if not specified)
        const questionsToRender = quizData.questionsToRender || quizData.questions.length;
        
        // Shuffle questions and take only the required number
        const shuffledQuestions = shuffleArray(quizData.questions);
        const selectedQuestions = shuffledQuestions.slice(0, Math.min(questionsToRender, quizData.questions.length));
        
        // Shuffle options within each question to prevent position-based cheating
        const questionsWithShuffledOptions = selectedQuestions.map(question => ({
          ...question,
          options: question.options ? shuffleArray(question.options) : question.options
        }));

        setQuiz({
          ...quizData,
          questions: questionsWithShuffledOptions,
          originalQuestionCount: quizData.questions.length
        });
        setTimeLeft(quizData.timeLimit * 60);
      } catch (err) {
        console.error('Quiz fetch error:', err);
        setError(err.message || 'Failed to load quiz');
        setTimeout(() => navigate('/student-dashboard'), 3000);
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
    setSubmissionError(null);

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
      if (!currentUser) {
        throw new Error('User not authenticated. Please log in again.');
      }

      // Fetch user data from Firestore to get registration number
      console.log('Fetching user data for:', currentUser.uid);
      console.log('Current user auth data:', {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName
      });
      
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      
      if (!userDoc.exists()) {
        throw new Error('User profile not found. Please contact support.');
      }

      const userData = userDoc.data();
      console.log('User data retrieved from Firestore:', userData);

      if (!userData || !userData.regNumber) {
        throw new Error('Registration number not found in profile. Please update your profile.');
      }

      // Calculate percentage and time spent
      const totalQuestions = quiz.questions.length;
      const percentage = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
      const timeSpentInSeconds = Math.max(0, (quiz.timeLimit * 60) - (timeLeft || 0));
      
      const submissionData = {
        userId: currentUser.uid,
        regNumber: userData.regNumber,
        fullName: userData.fullName || 'Unknown',
        department: userData.department || 'Unknown',
        email: userData.email || currentUser.email || 'No email provided',
        score: correct,
        total: totalQuestions,
        percentage: percentage,
        accessCode: accessCode || 'direct',
        submittedAt: serverTimestamp(),
        answers,
        quizTitle: quiz.title,
        timeSpent: timeSpentInSeconds,
      };

      console.log('Submitting data:', submissionData);
      console.log('Calculated values - Score:', correct, 'Total:', totalQuestions, 'Percentage:', percentage, 'Time Spent:', timeSpentInSeconds);
      
      const docRef = await addDoc(collection(db, 'quizzes', id, 'submissions'), submissionData);
      console.log('Submission successful with ID:', docRef.id);
      
    } catch (err) {
      console.error('Submission error:', err);
      setSubmissionError(err.message || 'Failed to submit quiz. Please try again.');
      setSubmitted(false); // Allow retry
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex justify-center items-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex justify-center items-center bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <FiAlertTriangle className="text-red-600 text-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Quiz Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-sm text-gray-500 mb-4">Redirecting to dashboard...</p>
          <button
            onClick={() => navigate('/student-dashboard')}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-lg"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (submitted && !submissionError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <FiCheck className="text-green-600 text-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Quiz Completed!</h1>
          <p className="text-gray-600 mt-2 mb-2">
            You scored <span className="text-blue-600 font-bold">{score}</span> out of{' '}
            <span className="font-semibold">{quiz.questions.length}</span>
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Percentage: <span className="font-semibold">{Math.round((score / quiz.questions.length) * 100)}%</span>
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

        {/* Submission error display */}
        {submissionError && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <FiAlertTriangle className="text-red-600 mr-2" />
              <div>
                <p className="text-red-800 font-medium">Submission Failed</p>
                <p className="text-red-600 text-sm">{submissionError}</p>
                <button
                  onClick={() => setSubmissionError(null)}
                  className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
                >
                  Try submitting again
                </button>
              </div>
            </div>
          </div>
        )}

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

