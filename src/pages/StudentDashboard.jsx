import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { runTransaction, serverTimestamp } from 'firebase/firestore';
import { getUserPosition, calculateUserStats } from '../utils/leaderboardService';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

import { 
  FiLogOut, FiBook, FiAward, FiUser, 
  FiSearch, FiCheckCircle, FiBarChart2, 
  FiLock, FiX, FiChevronDown, FiClock,
  FiCheck, FiTrendingUp
} from 'react-icons/fi';

export default function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [userResults, setUserResults] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [userPosition, setUserPosition] = useState(null);
  const [loading, setLoading] = useState({ 
    user: true, 
    quizzes: true, 
    results: false,
    position: false 
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [activeTab, setActiveTab] = useState('quizzes');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [departments, setDepartments] = useState([]);
  const [showDepartments, setShowDepartments] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const navigate = useNavigate();
  const { isDark } = useTheme();

  // Fetch user data and quizzes
  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          navigate('/login');
          return;
        }

        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          navigate('/login');
          return;
        }

        const userData = userSnap.data();
        setUser(userData);

        const quizzesQuery = query(
          collection(db, 'quizzes'),
          where('status', '==', 'approved')
        );

        const quizzesSnapshot = await getDocs(quizzesQuery);
        const quizzesData = quizzesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setQuizzes(quizzesData);
        const uniqueDepartments = [...new Set(quizzesData.map(q => q.department))];
        setDepartments(uniqueDepartments);

      } catch (error) {
        console.error("Error fetching data:", error);
        setNotification({
          type: 'error',
          message: 'Failed to load quizzes. Please try again.'
        });
      } finally {
        setLoading(prev => ({ ...prev, user: false, quizzes: false }));
      }
    };

    fetchData();
  }, [navigate]);

  // Fetch user results and statistics
  const fetchUserResults = async () => {
    if (!user?.uid) return;
    
    setLoading(prev => ({ ...prev, results: true }));
    try {
      const allResults = [];
      
      // Get user's submissions from all quizzes
      const quizzesSnapshot = await getDocs(collection(db, 'quizzes'));
      
      for (const quizDoc of quizzesSnapshot.docs) {
        const submissionsQuery = query(
          collection(db, 'quizzes', quizDoc.id, 'submissions'),
          where('userId', '==', user.uid)
        );
        const submissionsSnapshot = await getDocs(submissionsQuery);
        
        submissionsSnapshot.docs.forEach(submissionDoc => {
          const submission = submissionDoc.data();
          allResults.push({
            id: submissionDoc.id,
            quizId: quizDoc.id,
            quizTitle: quizDoc.data().title,
            quizDepartment: quizDoc.data().department,
            ...submission,
            submittedAt: submission.submittedAt?.toDate?.() || new Date(submission.submittedAt)
          });
        });
      }

      // Sort by submission date (newest first)
      allResults.sort((a, b) => b.submittedAt - a.submittedAt);
      
      setUserResults(allResults);
      
      // Calculate user statistics
      const stats = calculateUserStats(allResults);
      setUserStats(stats);
      
    } catch (error) {
      console.error('Error fetching user results:', error);
    } finally {
      setLoading(prev => ({ ...prev, results: false }));
    }
  };

  // Fetch user position in leaderboards
  const fetchUserPosition = async () => {
    if (!user?.uid || !user?.department) return;
    
    setLoading(prev => ({ ...prev, position: true }));
    try {
      const position = await getUserPosition(user.uid, user.department);
      setUserPosition(position);
    } catch (error) {
      console.error('Error fetching user position:', error);
    } finally {
      setLoading(prev => ({ ...prev, position: false }));
    }
  };

  // Load additional data when user changes or tabs are accessed
  useEffect(() => {
    if (user && (activeTab === 'results' || activeTab === 'leaderboard')) {
      if (activeTab === 'results' && userResults.length === 0) {
        fetchUserResults();
      }
      if (activeTab === 'leaderboard' && !userPosition) {
        fetchUserPosition();
      }
    }
  }, [user, activeTab]);

  const filteredQuizzes = quizzes.filter(quiz => {
    const matchesSearch = quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         quiz.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = departmentFilter === 'all' || quiz.department === departmentFilter;
    return matchesSearch && matchesDepartment;
  });

  const handleTakeQuiz = (quiz) => {
    setSelectedQuiz(quiz);
    setAccessCode('');
    setModalError(null);
    setVerificationStatus(null);
    setShowModal(true);
  };

 // Optimized verification sequence
const verifyAccessCode = async () => {
  const cleanCode = accessCode.trim();
  console.log("[DEBUG] Verifying access code:", cleanCode);

  try {
    if (!selectedQuiz?.id) throw new Error("NO_QUIZ_SELECTED");
    if (!cleanCode) throw new Error("EMPTY_CODE");

    const codeRef = doc(db, "quizzes", selectedQuiz.id, "codes", cleanCode);
    const codeSnap = await getDoc(codeRef);

    if (!codeSnap.exists()) throw new Error("CODE_NOT_FOUND");

    const codeData = codeSnap.data();
    console.log("[DEBUG] Code data:", codeData);
    console.log("[DEBUG] Current user object:", user);

    if (codeData.used) throw new Error("CODE_ALREADY_USED");

    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.uid) throw new Error("USER_NOT_READY");

    // ✅ Safely mark code as used
    await updateDoc(codeRef, {
      used: true,
      usedBy: currentUser.uid,
      usedAt: serverTimestamp(),
    });

    console.log("[DEBUG] Code verified and marked as used — navigating to quiz");
    setVerificationStatus("success");
    setModalError("Code verified successfully! Redirecting...");

    setTimeout(() => {
      navigate(`/quiz/${selectedQuiz.id}?code=${cleanCode}`);
    }, 1000);

  } catch (error) {
    console.error("[DEBUG] Verification failed:", error.message);

    const errorMap = {
      "NO_QUIZ_SELECTED": "No quiz selected",
      "EMPTY_CODE": "Please enter an access code",
      "CODE_NOT_FOUND": "Invalid access code",
      "CODE_ALREADY_USED": "This code has already been used",
      "USER_NOT_READY": "User not authenticated. Please reload the page.",
      "permission-denied": "Authentication error",
    };

    setModalError(errorMap[error.message] || "Failed to verify code");
    setVerificationStatus("error");
  }
};

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  if (loading.user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 relative">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-soft sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <FiBook className="text-blue-600 dark:text-blue-400" size={20} />
            </div>
            <div>
              <h1 className="font-bold text-gray-800 dark:text-gray-200">Student Dashboard</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {user?.department} • {user?.regNumber}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium"
            >
              <FiLogOut /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 shadow-soft">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('quizzes')}
              className={`px-4 py-3 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'quizzes' ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <FiBook size={16} /> Available Quizzes
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`px-4 py-3 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'results' ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <FiBarChart2 size={16} /> My Results
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`px-4 py-3 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'leaderboard' ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <FiAward size={16} /> Leaderboard
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-3 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'profile' ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <FiUser size={16} /> My Profile
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`p-3 rounded-md mb-6 ${
                notification.type === 'error' 
                  ? 'bg-red-50 text-red-700' 
                  : 'bg-green-50 text-green-700'
              }`}
            >
              {notification.message}
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab === 'quizzes' && (
          <>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiSearch className="text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search quizzes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowDepartments(!showDepartments)}
                  className="flex items-center justify-between gap-2 px-4 py-2 w-full md:w-64 border border-gray-300 rounded-lg bg-white"
                >
                  <span>
                    {departmentFilter === 'all' ? 'All Departments' : departmentFilter}
                  </span>
                  <FiChevronDown className={`transition-transform ${showDepartments ? 'rotate-180' : ''}`} />
                </button>

                {showDepartments && (
                  <div className="absolute z-10 mt-1 w-full md:w-64 bg-white border border-gray-300 rounded-lg shadow-lg">
                    <button
                      onClick={() => {
                        setDepartmentFilter('all');
                        setShowDepartments(false);
                      }}
                      className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${
                        departmentFilter === 'all' ? 'bg-blue-50 text-blue-600' : ''
                      }`}
                    >
                      All Departments
                    </button>
                    {departments.map(dept => (
                      <button
                        key={dept}
                        onClick={() => {
                          setDepartmentFilter(dept);
                          setShowDepartments(false);
                        }}
                        className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${
                          departmentFilter === dept ? 'bg-blue-50 text-blue-600' : ''
                        }`}
                      >
                        {dept}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quizzes Grid */}
            {loading.quizzes ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-sm p-6 h-48 animate-pulse"></div>
                ))}
              </div>
            ) : filteredQuizzes.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <FiBook className="mx-auto text-gray-400" size={48} />
                <h3 className="text-lg font-medium text-gray-700 mt-4">
                  {searchTerm || departmentFilter !== 'all' 
                    ? 'No matching quizzes found' 
                    : 'No quizzes available yet'}
                </h3>
                <p className="text-gray-500 mt-1">
                  {searchTerm || departmentFilter !== 'all'
                    ? 'Try adjusting your search or filter'
                    : 'Check back later for new quizzes'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredQuizzes.map((quiz) => (
                  <motion.div
                    key={quiz.id}
                    whileHover={{ y: -5 }}
                    className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 hover:border-blue-200 transition-all"
                  >
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-800 rounded-full flex items-center gap-1">
                          <FiCheckCircle size={12} /> Approved
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                            {quiz.department}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <FiClock size={12} /> {quiz.timeLimit} min
                          </span>
                        </div>
                      </div>

                      <h3 className="font-bold text-gray-800 mb-2 line-clamp-2">
                        {quiz.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                        {quiz.description}
                      </p>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {quiz.questions?.length || 0} questions
                        </span>
                        <button
                          onClick={() => handleTakeQuiz(quiz)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          <FiLock size={14} /> Take Quiz
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'results' && (
          <div className="space-y-6">
            {/* Statistics Cards */}
            {userStats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Quizzes</p>
                      <p className="text-2xl font-bold text-gray-900">{userStats.totalQuizzes}</p>
                    </div>
                    <FiBook className="text-blue-500" size={24} />
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Average Score</p>
                      <p className="text-2xl font-bold text-gray-900">{userStats.averagePercentage}%</p>
                    </div>
                    <FiBarChart2 className="text-green-500" size={24} />
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Best Score</p>
                      <p className="text-2xl font-bold text-gray-900">{userStats.highestScore}</p>
                    </div>
                    <FiAward className="text-yellow-500" size={24} />
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Current Streak</p>
                      <p className="text-2xl font-bold text-gray-900">{userStats.recentStreak}</p>
                    </div>
                    <FiTrendingUp className="text-purple-500" size={24} />
                  </div>
                </div>
              </div>
            )}

            {/* Results Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <FiBarChart2 className="text-blue-500" />
                  Quiz Results ({userResults.length})
                </h2>
              </div>
              
              {loading.results ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading your results...</p>
                </div>
              ) : userResults.length === 0 ? (
                <div className="p-8 text-center">
                  <FiBarChart2 className="mx-auto text-4xl text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No Quiz Results Yet</h3>
                  <p className="text-gray-500">Take your first quiz to see your results here!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quiz</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {userResults.map((result, index) => (
                        <tr key={result.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{result.quizTitle}</div>
                              <div className="text-sm text-gray-500">{result.quizDepartment}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {result.score}/{result.total}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-1 max-w-20">
                                <div className={`h-2 rounded-full mr-2 ${
                                  (result.percentage || 0) >= 70 ? 'bg-green-200' :
                                  (result.percentage || 0) >= 50 ? 'bg-yellow-200' : 'bg-red-200'
                                }`}>
                                  <div 
                                    className={`h-2 rounded-full ${
                                      (result.percentage || 0) >= 70 ? 'bg-green-500' :
                                      (result.percentage || 0) >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${Math.min(result.percentage || 0, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                              <span className="text-sm font-medium text-gray-900 ml-2">
                                {result.percentage || 0}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {result.submittedAt.toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              (result.percentage || 0) >= 90 ? 'bg-green-100 text-green-800' :
                              (result.percentage || 0) >= 80 ? 'bg-blue-100 text-blue-800' :
                              (result.percentage || 0) >= 70 ? 'bg-yellow-100 text-yellow-800' :
                              (result.percentage || 0) >= 50 ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {(result.percentage || 0) >= 90 ? 'Excellent' :
                               (result.percentage || 0) >= 80 ? 'Very Good' :
                               (result.percentage || 0) >= 70 ? 'Good' :
                               (result.percentage || 0) >= 50 ? 'Fair' : 'Needs Improvement'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-800 flex items-center gap-2">
                  <FiAward className="text-yellow-500" />
                  Leaderboard Preview
                </h3>
                <p className="text-gray-500 text-sm">
                  See how you rank against your peers
                </p>
              </div>
              <button
                onClick={() => navigate('/leaderboard')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                View Full Leaderboard
              </button>
            </div>

            {loading.position ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg animate-pulse">
                  <div className="h-4 bg-gray-300 rounded mb-2"></div>
                  <div className="h-8 bg-gray-300 rounded mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded"></div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg animate-pulse">
                  <div className="h-4 bg-gray-300 rounded mb-2"></div>
                  <div className="h-8 bg-gray-300 rounded mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded"></div>
                </div>
              </div>
            ) : userPosition ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
                  <h4 className="font-semibold text-gray-800 mb-2">Department Ranking</h4>
                  <p className="text-2xl font-bold text-yellow-600">
                    #{userPosition.department.rank || 'Unranked'} of {userPosition.department.totalParticipants || 0}
                  </p>
                  <p className="text-sm text-gray-600">
                    {userPosition.department.rank ? 'Your current position' : 'Take quizzes to get ranked'}
                  </p>
                  {userPosition.department.stats && (
                    <div className="mt-2 text-xs text-gray-500">
                      Avg: {userPosition.department.stats.averagePercentage}% • 
                      Quizzes: {userPosition.department.stats.totalQuizzes}
                    </div>
                  )}
                </div>
                <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-gray-800 mb-2">Global Ranking</h4>
                  <p className="text-2xl font-bold text-blue-600">
                    #{userPosition.global.rank || 'Unranked'} of {userPosition.global.totalParticipants || 0}
                  </p>
                  <p className="text-sm text-gray-600">
                    {userPosition.global.rank ? 'Compete with all students' : 'Take quizzes to get ranked'}
                  </p>
                  {userPosition.global.stats && (
                    <div className="mt-2 text-xs text-gray-500">
                      Avg: {userPosition.global.stats.averagePercentage}% • 
                      Points: {userPosition.global.stats.totalPoints}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Department Ranking</h4>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {userPosition?.department?.hasData ? 'Loading...' : 'No Data'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {userPosition?.department?.hasData ? 'Calculating your position...' : 'Take quizzes to see your position'}
                  </p>
                </div>
                <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Global Ranking</h4>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {userPosition?.global?.hasData ? 'Loading...' : 'No Data'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {userPosition?.global?.hasData ? 'Calculating your position...' : 'Take quizzes to see your position'}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-center text-gray-600">
                🏆 Take more quizzes to improve your ranking and compete for the top spot!
              </p>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Profile Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-sm overflow-hidden">
              <div className="px-6 py-8 text-white">
                <div className="flex items-center space-x-6">
                  <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                    <FiUser className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{user?.fullName || 'Student'}</h2>
                    <p className="text-blue-100 mt-1">{user?.regNumber}</p>
                    <p className="text-blue-200 text-sm">{user?.department} Department</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Information */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Personal Information */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FiUser className="text-blue-500" />
                  Personal Information
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Full Name</label>
                      <p className="text-gray-900 font-semibold">{user?.fullName || 'Not provided'}</p>
                    </div>
                    <FiUser className="text-gray-400" />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Registration Number</label>
                      <p className="text-gray-900 font-semibold">{user?.regNumber || 'Not provided'}</p>
                    </div>
                    <FiBook className="text-gray-400" />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Department</label>
                      <p className="text-gray-900 font-semibold">{user?.department || 'Not provided'}</p>
                    </div>
                    <FiBook className="text-gray-400" />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-600">Email Address</label>
                      <p className="text-gray-900 font-semibold">{user?.email || 'Not provided'}</p>
                    </div>
                    <FiUser className="text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Academic Summary */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FiBarChart2 className="text-green-500" />
                  Academic Summary
                </h3>
                
                {userStats ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-green-600">Quizzes Completed</label>
                        <p className="text-green-900 font-bold text-xl">{userStats.totalQuizzes}</p>
                      </div>
                      <FiBook className="text-green-500 w-6 h-6" />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-blue-600">Average Score</label>
                        <p className="text-blue-900 font-bold text-xl">{userStats.averagePercentage}%</p>
                      </div>
                      <FiBarChart2 className="text-blue-500 w-6 h-6" />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-yellow-600">Best Performance</label>
                        <p className="text-yellow-900 font-bold text-xl">{userStats.highestScore}</p>
                      </div>
                      <FiAward className="text-yellow-500 w-6 h-6" />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-purple-600">Current Streak</label>
                        <p className="text-purple-900 font-bold text-xl">{userStats.recentStreak}</p>
                      </div>
                      <FiTrendingUp className="text-purple-500 w-6 h-6" />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FiBarChart2 className="mx-auto text-4xl text-gray-400 mb-4" />
                    <p className="text-gray-500">Take your first quiz to see your academic summary!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FiClock className="text-indigo-500" />
                Quick Actions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => setActiveTab('quizzes')}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
                >
                  <FiBook className="text-blue-500 w-6 h-6 mb-2" />
                  <h4 className="font-semibold text-gray-800">Browse Quizzes</h4>
                  <p className="text-gray-500 text-sm">Find and take available quizzes</p>
                </button>
                
                <button
                  onClick={() => setActiveTab('results')}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors text-left"
                >
                  <FiBarChart2 className="text-green-500 w-6 h-6 mb-2" />
                  <h4 className="font-semibold text-gray-800">View Results</h4>
                  <p className="text-gray-500 text-sm">Check your quiz performance</p>
                </button>
                
                <button
                  onClick={() => navigate('/leaderboard')}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-yellow-50 hover:border-yellow-300 transition-colors text-left"
                >
                  <FiAward className="text-yellow-500 w-6 h-6 mb-2" />
                  <h4 className="font-semibold text-gray-800">Leaderboard</h4>
                  <p className="text-gray-500 text-sm">See how you rank globally</p>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Access Code Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-lg shadow-xl max-w-md w-full"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-800">
                    Enter Access Code
                  </h2>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setModalError(null);
                      setVerificationStatus(null);
                    }}
                    className="text-gray-500 hover:text-gray-700"
                    disabled={verificationStatus === 'success'}
                  >
                    <FiX size={24} />
                  </button>
                </div>

                {/* Status Messages */}
                {modalError && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`mb-4 p-3 rounded-md text-sm flex items-center gap-2 ${
                      verificationStatus === 'success'
                        ? 'bg-green-50 text-green-600'
                        : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {verificationStatus === 'success' ? <FiCheck /> : <FiX />}
                    {modalError}
                  </motion.div>
                )}

                <p className="text-gray-600 mb-2">
                  You need an access code to take <span className="font-medium">"{selectedQuiz?.title}"</span>
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Department: {selectedQuiz?.department}
                </p>
                
                <input
                  type="text"
                  value={accessCode}
                  onChange={(e) => {
                    setAccessCode(e.target.value);
                    setModalError(null);
                    setVerificationStatus(null);
                  }}
                  placeholder="Enter your access code"
                  className={`w-full px-4 py-2 border rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    verificationStatus === 'success'
                      ? 'border-green-300 bg-green-50'
                      : verificationStatus === 'error'
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300'
                  }`}
                  autoFocus
                  disabled={verificationStatus === 'success'}
                />
                
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setModalError(null);
                      setVerificationStatus(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                    disabled={verificationStatus === 'success'}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={verifyAccessCode}
                    disabled={!accessCode.trim() || verificationStatus === 'success'}
                    className={`px-4 py-2 rounded-lg text-white flex items-center gap-1 ${
                      verificationStatus === 'success'
                        ? 'bg-green-500'
                        : verificationStatus === 'error'
                        ? 'bg-red-500'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {verificationStatus === 'success' ? (
                      <>
                        <FiCheck className="animate-pulse" /> Verified
                      </>
                    ) : (
                      <>
                        <FiLock /> Verify Code
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
