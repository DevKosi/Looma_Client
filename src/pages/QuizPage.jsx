import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/firebaseConfig';
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiArrowLeft, 
  FiArrowRight, 
  FiCheck, 
  FiClock, 
  FiAlertTriangle, 
  FiPlay,
  FiPause,
  FiFlag,
  FiCheckCircle,
  FiXCircle
} from 'react-icons/fi';
import { validateSubmissionData, testCalculations } from '../utils/debugHelpers';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

export default function QuizPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const accessCode = new URLSearchParams(location.search).get('code');
  const { isDark } = useTheme();

  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submissionError, setSubmissionError] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

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
    if (!timeLeft || submitted || isPaused) return;
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
  }, [timeLeft, submitted, isPaused]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
      
      // Debug calculation process
      const calcResults = testCalculations(correct, totalQuestions, quiz.timeLimit, timeLeft);
      
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
      
      // Validate submission data before sending
      const validation = validateSubmissionData(submissionData);
      
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex justify-center items-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-500 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">Loading Quiz</h2>
          <p className="text-gray-500 dark:text-gray-400">Please wait while we prepare your assessment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex justify-center items-center p-4">
        <div className="text-center max-w-md">
          <div className="bg-red-100 dark:bg-red-900/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <FiAlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">Error Loading Quiz</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/student-dashboard')}
            className="btn-primary"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex justify-center items-center p-4">
        <div className="text-center max-w-md">
          <div className="bg-green-100 dark:bg-green-900/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <FiCheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">Quiz Submitted!</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Your score: <span className="font-semibold text-primary-600 dark:text-primary-400">{score}/{quiz.questions.length}</span>
          </p>
          {submissionError && (
            <div className="status-error p-3 rounded-lg mb-4 text-sm">
              <FiAlertTriangle className="inline mr-2" />
              {submissionError}
            </div>
          )}
          <button
            onClick={() => navigate('/student-dashboard')}
            className="btn-primary"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentQ = quiz.questions[currentQuestion];
  const answeredQuestions = Object.keys(answers).length;
  const progress = (answeredQuestions / quiz.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-soft border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Back Button */}
            <button
              onClick={() => navigate('/student-dashboard')}
              className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <FiArrowLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </button>

            {/* Quiz Title */}
            <div className="text-center flex-1">
              <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200 truncate">
                {quiz.title}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Question {currentQuestion + 1} of {quiz.questions.length}
              </p>
            </div>

            {/* Theme Toggle */}
            <div className="flex items-center space-x-4">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Progress: {answeredQuestions}/{quiz.questions.length} answered
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {Math.round(progress)}% complete
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-primary-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Timer */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <FiClock className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <span className="text-lg font-mono font-semibold text-gray-800 dark:text-gray-200">
                  {formatTime(timeLeft)}
                </span>
              </div>
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {isPaused ? (
                  <>
                    <FiPlay className="w-4 h-4" />
                    <span className="text-sm">Resume</span>
                  </>
                ) : (
                  <>
                    <FiPause className="w-4 h-4" />
                    <span className="text-sm">Pause</span>
                  </>
                )}
              </button>
            </div>

            <button
              onClick={() => setShowConfirmSubmit(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
            >
              <FiFlag className="w-4 h-4" />
              <span>Submit Quiz</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card p-6 sm:p-8">
          {/* Question */}
          <div className="mb-8">
            <div className="flex items-start space-x-3 mb-6">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center font-semibold text-sm">
                {currentQuestion + 1}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 leading-relaxed">
                  {currentQ.question}
                </h2>
                
                {/* Options */}
                <div className="space-y-3">
                  {currentQ.options ? (
                    currentQ.options.map((option, index) => (
                      <motion.button
                        key={option.id}
                        onClick={() => handleSelect(currentQ.id, option.id)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                          answers[currentQ.id] === option.id
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            answers[currentQ.id] === option.id
                              ? 'border-primary-500 bg-primary-500'
                              : 'border-gray-300 dark:border-gray-500'
                          }`}>
                            {answers[currentQ.id] === option.id && (
                              <FiCheck className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <span className="font-medium">{option.text}</span>
                        </div>
                      </motion.button>
                    ))
                  ) : (
                    // True/False question
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { id: 'true', text: 'True' },
                        { id: 'false', text: 'False' }
                      ].map((option) => (
                        <motion.button
                          key={option.id}
                          onClick={() => handleSelect(currentQ.id, option.id)}
                          className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                            answers[currentQ.id] === option.id
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="flex items-center justify-center space-x-2">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              answers[currentQ.id] === option.id
                                ? 'border-primary-500 bg-primary-500'
                                : 'border-gray-300 dark:border-gray-500'
                            }`}>
                              {answers[currentQ.id] === option.id && (
                                <FiCheck className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <span className="font-medium">{option.text}</span>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-600">
            <button
              onClick={handlePrevQuestion}
              disabled={currentQuestion === 0}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                currentQuestion === 0
                  ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <FiArrowLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <div className="flex items-center space-x-2">
              {quiz.questions.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentQuestion(index)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    index === currentQuestion
                      ? 'bg-primary-500'
                      : answers[quiz.questions[index].id]
                        ? 'bg-green-500'
                        : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  aria-label={`Go to question ${index + 1}`}
                />
              ))}
            </div>

            <button
              onClick={handleNextQuestion}
              disabled={currentQuestion === quiz.questions.length - 1}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                currentQuestion === quiz.questions.length - 1
                  ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span>Next</span>
              <FiArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Submit Modal */}
      <AnimatePresence>
        {showConfirmSubmit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full"
            >
              <div className="text-center">
                <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiAlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Submit Quiz?
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  You have answered {answeredQuestions} out of {quiz.questions.length} questions. 
                  Are you sure you want to submit your quiz?
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowConfirmSubmit(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowConfirmSubmit(false);
                      handleSubmit();
                    }}
                    className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Submit Quiz
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

