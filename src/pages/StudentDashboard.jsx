import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { runTransaction, serverTimestamp } from 'firebase/firestore';
import { calculateUserStats } from '../utils/leaderboardService';

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
  const [loading, setLoading] = useState({ 
    user: true, 
    quizzes: true, 
    results: false
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



  // Load additional data when user changes or tabs are accessed
  useEffect(() => {
    if (user && activeTab === 'results' && userResults.length === 0) {
      fetchUserResults();
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
    <div className="min-h-screen bg-[#F8FAFC] relative">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 bg-blue-100 rounded-full flex-shrink-0">
                <FiBook className="text-blue-600" size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-bold text-gray-800 text-lg sm:text-xl truncate">Student Dashboard</h1>
                <p className="text-xs sm:text-sm text-gray-600 truncate">
                  {user?.department} • {user?.regNumber}
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-end">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-red-600 hover:text-red-700 text-sm font-medium px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
              >
                <FiLogOut size={16} /> 
                <span className="hidden sm:inline">Sign Out</span>
                <span className="sm:hidden">Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-4">
          <div className="flex overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab('quizzes')}
              className={`px-3 sm:px-4 py-3 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'quizzes' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FiBook size={14} className="sm:w-4 sm:h-4" /> 
              <span className="hidden xs:inline">Available </span>Quizzes
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`px-3 sm:px-4 py-3 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'results' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FiBarChart2 size={14} className="sm:w-4 sm:h-4" /> 
              <span className="hidden xs:inline">My </span>Results
            </button>
            <button
              onClick={() => navigate('/leaderboard')}
              className="px-3 sm:px-4 py-3 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2 whitespace-nowrap text-gray-500 hover:text-gray-700 hover:text-blue-600 transition-colors"
            >
              <FiAward size={14} className="sm:w-4 sm:h-4" /> Leaderboard
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-3 sm:px-4 py-3 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'profile' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FiUser size={14} className="sm:w-4 sm:h-4" /> 
              <span className="hidden xs:inline">My </span>Profile
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
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
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiSearch className="text-gray-400" size={16} />
                </div>
                <input
                  type="text"
                  placeholder="Search quizzes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2.5 sm:py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              <div className="relative sm:w-48 lg:w-64">
                <button
                  onClick={() => setShowDepartments(!showDepartments)}
                  className="flex items-center justify-between gap-2 px-4 py-2.5 sm:py-2 w-full border border-gray-300 rounded-lg bg-white text-sm"
                >
                  <span className="truncate">
                    {departmentFilter === 'all' ? 'All Departments' : departmentFilter}
                  </span>
                  <FiChevronDown className={`transition-transform flex-shrink-0 ${showDepartments ? 'rotate-180' : ''}`} size={16} />
                </button>

                {showDepartments && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <button
                      onClick={() => {
                        setDepartmentFilter('all');
                        setShowDepartments(false);
                      }}
                      className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
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
                        className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 truncate ${
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-sm p-4 sm:p-6 h-40 sm:h-48 animate-pulse"></div>
                ))}
              </div>
            ) : filteredQuizzes.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-6 sm:p-8 text-center">
                <FiBook className="mx-auto text-gray-400" size={40} />
                <h3 className="text-base sm:text-lg font-medium text-gray-700 mt-4">
                  {searchTerm || departmentFilter !== 'all' 
                    ? 'No matching quizzes found' 
                    : 'No quizzes available yet'}
                </h3>
                <p className="text-sm sm:text-base text-gray-500 mt-1">
                  {searchTerm || departmentFilter !== 'all'
                    ? 'Try adjusting your search or filter'
                    : 'Check back later for new quizzes'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {filteredQuizzes.map((quiz) => (
                  <motion.div
                    key={quiz.id}
                    whileHover={{ y: -2 }}
                    className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 hover:border-blue-200 transition-all"
                  >
                    <div className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
                        <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-800 rounded-full flex items-center gap-1 w-fit">
                          <FiCheckCircle size={10} /> Approved
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full truncate max-w-24 sm:max-w-none">
                            {quiz.department}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <FiClock size={10} /> {quiz.timeLimit} min
                          </span>
                        </div>
                      </div>

                      <h3 className="font-bold text-gray-800 mb-2 text-sm sm:text-base line-clamp-2">
                        {quiz.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 mb-4 line-clamp-3">
                        {quiz.description}
                      </p>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {quiz.questions?.length || 0} questions
                        </span>
                        <button
                          onClick={() => handleTakeQuiz(quiz)}
                          className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                        >
                          <FiLock size={12} /> Take Quiz
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
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border-l-4 border-blue-500">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Quizzes</p>
                      <p className="text-lg sm:text-2xl font-bold text-gray-900">{userStats.totalQuizzes}</p>
                    </div>
                    <FiBook className="text-blue-500 flex-shrink-0" size={20} />
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border-l-4 border-green-500">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Average Score</p>
                      <p className="text-lg sm:text-2xl font-bold text-gray-900">{userStats.averagePercentage}%</p>
                    </div>
                    <FiBarChart2 className="text-green-500 flex-shrink-0" size={20} />
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border-l-4 border-yellow-500">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Best Score</p>
                      <p className="text-lg sm:text-2xl font-bold text-gray-900">{userStats.highestScore}</p>
                    </div>
                    <FiAward className="text-yellow-500 flex-shrink-0" size={20} />
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border-l-4 border-purple-500">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Current Streak</p>
                      <p className="text-lg sm:text-2xl font-bold text-gray-900">{userStats.recentStreak}</p>
                    </div>
                    <FiTrendingUp className="text-purple-500 flex-shrink-0" size={20} />
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
