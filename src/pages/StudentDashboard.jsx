import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { runTransaction, serverTimestamp } from 'firebase/firestore';
import { getUserPosition, calculateUserStats } from '../utils/leaderboardService';

import { 
  FiLogOut, FiBook, FiAward, FiUser, 
  FiSearch, FiCheckCircle, FiBarChart2, 
  FiLock, FiX, FiChevronDown, FiClock,
  FiCheck, FiTrendingUp
} from 'react-icons/fi';

export default function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState({ 
    user: true, 
    quizzes: true
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

  // Fetch user statistics for profile tab
  const fetchUserStats = async () => {
    if (!user?.uid) return;
    
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

      // Calculate user statistics
      const stats = calculateUserStats(allResults);
      setUserStats(stats);
      
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  // Load stats when profile tab is accessed
  useEffect(() => {
    if (user && activeTab === 'profile' && !userStats) {
      fetchUserStats();
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

  // Handle leaderboard tab click - redirect to leaderboard page
  const handleLeaderboardClick = () => {
    navigate('/leaderboard');
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 bg-blue-100 rounded-full">
                <FiBook className="text-blue-600" size={18} />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-800">Student Dashboard</h1>
                <p className="text-xs sm:text-sm text-gray-600">
                  {user?.department} • {user?.regNumber}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-red-600 hover:text-red-700 text-sm font-medium"
              >
                <FiLogOut size={16} /> 
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab('quizzes')}
              className={`px-3 sm:px-4 py-3 font-medium text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'quizzes' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FiBook size={16} /> Available Quizzes
            </button>
            <button
              onClick={handleLeaderboardClick}
              className="px-3 sm:px-4 py-3 font-medium text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap flex-shrink-0 text-gray-500 hover:text-gray-700"
            >
              <FiAward size={16} /> Leaderboard
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-3 sm:px-4 py-3 font-medium text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'profile' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FiUser size={16} /> My Profile
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`p-3 rounded-md mb-4 sm:mb-6 ${
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
            <div className="flex flex-col gap-3 sm:gap-4 md:flex-row mb-4 sm:mb-6">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiSearch className="text-gray-400" size={16} />
                </div>
                <input
                  type="text"
                  placeholder="Search quizzes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowDepartments(!showDepartments)}
                  className="flex items-center justify-between gap-2 px-4 py-2 w-full md:w-56 lg:w-64 border border-gray-300 rounded-lg bg-white text-sm"
                >
                  <span className="truncate">
                    {departmentFilter === 'all' ? 'All Departments' : departmentFilter}
                  </span>
                  <FiChevronDown className={`transition-transform flex-shrink-0 ${showDepartments ? 'rotate-180' : ''}`} size={16} />
                </button>

                {showDepartments && (
                  <div className="absolute z-10 mt-1 w-full md:w-56 lg:w-64 bg-white border border-gray-300 rounded-lg shadow-lg">
                    <button
                      onClick={() => {
                        setDepartmentFilter('all');
                        setShowDepartments(false);
                      }}
                      className={`block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm ${
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
                        className={`block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm ${
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
                <FiBook className="mx-auto text-gray-400 mb-4" size={40} />
                <h3 className="text-lg font-medium text-gray-700 mt-4">
                  {searchTerm || departmentFilter !== 'all' 
                    ? 'No matching quizzes found' 
                    : 'No quizzes available yet'}
                </h3>
                <p className="text-gray-500 mt-1 text-sm">
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
                    whileHover={{ y: -5 }}
                    className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 hover:border-blue-200 transition-all"
                  >
                    <div className="p-4 sm:p-6">
                      <div className="flex items-center justify-between mb-3 gap-2">
                        <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-800 rounded-full flex items-center gap-1 flex-shrink-0">
                          <FiCheckCircle size={12} /> Approved
                        </span>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full truncate">
                            {quiz.department}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1 flex-shrink-0">
                            <FiClock size={12} /> {quiz.timeLimit}m
                          </span>
                        </div>
                      </div>

                      <h3 className="font-bold text-gray-800 mb-2 line-clamp-2 text-sm sm:text-base">
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
                          className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
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

        {activeTab === 'profile' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Profile Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-sm overflow-hidden">
              <div className="px-4 sm:px-6 py-6 sm:py-8 text-white">
                <div className="flex items-center space-x-4 sm:space-x-6">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center flex-shrink-0">
                    <FiUser className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold truncate">{user?.fullName || 'Student'}</h2>
                    <p className="text-blue-100 mt-1 text-sm sm:text-base">{user?.regNumber}</p>
                    <p className="text-blue-200 text-xs sm:text-sm">{user?.department} Department</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Information */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Personal Information */}
              <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FiUser className="text-blue-500" />
                  Personal Information
                </h3>
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="min-w-0">
                      <label className="block text-sm font-medium text-gray-600">Full Name</label>
                      <p className="text-gray-900 font-semibold truncate">{user?.fullName || 'Not provided'}</p>
                    </div>
                    <FiUser className="text-gray-400 flex-shrink-0" />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="min-w-0">
                      <label className="block text-sm font-medium text-gray-600">Registration Number</label>
                      <p className="text-gray-900 font-semibold truncate">{user?.regNumber || 'Not provided'}</p>
                    </div>
                    <FiBook className="text-gray-400 flex-shrink-0" />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="min-w-0">
                      <label className="block text-sm font-medium text-gray-600">Department</label>
                      <p className="text-gray-900 font-semibold truncate">{user?.department || 'Not provided'}</p>
                    </div>
                    <FiBook className="text-gray-400 flex-shrink-0" />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="min-w-0">
                      <label className="block text-sm font-medium text-gray-600">Email Address</label>
                      <p className="text-gray-900 font-semibold truncate">{user?.email || 'Not provided'}</p>
                    </div>
                    <FiUser className="text-gray-400 flex-shrink-0" />
                  </div>
                </div>
              </div>

              {/* Academic Summary */}
              <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FiBarChart2 className="text-green-500" />
                  Academic Summary
                </h3>
                
                {userStats ? (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-green-600">Quizzes Completed</label>
                        <p className="text-green-900 font-bold text-xl">{userStats.totalQuizzes}</p>
                      </div>
                      <FiBook className="text-green-500 w-6 h-6 flex-shrink-0" />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-blue-600">Average Score</label>
                        <p className="text-blue-900 font-bold text-xl">{userStats.averagePercentage}%</p>
                      </div>
                      <FiBarChart2 className="text-blue-500 w-6 h-6 flex-shrink-0" />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-yellow-600">Best Performance</label>
                        <p className="text-yellow-900 font-bold text-xl">{userStats.highestScore}</p>
                      </div>
                      <FiAward className="text-yellow-500 w-6 h-6 flex-shrink-0" />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-purple-600">Current Streak</label>
                        <p className="text-purple-900 font-bold text-xl">{userStats.recentStreak}</p>
                      </div>
                      <FiTrendingUp className="text-purple-500 w-6 h-6 flex-shrink-0" />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 sm:py-8">
                    <FiBarChart2 className="mx-auto text-4xl text-gray-400 mb-4" />
                    <p className="text-gray-500 text-sm">Take your first quiz to see your academic summary!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FiClock className="text-indigo-500" />
                Quick Actions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <button
                  onClick={() => setActiveTab('quizzes')}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
                >
                  <FiBook className="text-blue-500 w-6 h-6 mb-2" />
                  <h4 className="font-semibold text-gray-800 text-sm sm:text-base">Browse Quizzes</h4>
                  <p className="text-gray-500 text-xs sm:text-sm">Find and take available quizzes</p>
                </button>
                
                <button
                  onClick={() => navigate('/leaderboard')}
                  className="p-4 border border-gray-200 rounded-lg hover:bg-yellow-50 hover:border-yellow-300 transition-colors text-left"
                >
                  <FiAward className="text-yellow-500 w-6 h-6 mb-2" />
                  <h4 className="font-semibold text-gray-800 text-sm sm:text-base">Leaderboard</h4>
                  <p className="text-gray-500 text-xs sm:text-sm">See how you rank globally</p>
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
              className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
            >
              <div className="p-4 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800">
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

                <p className="text-gray-600 mb-2 text-sm">
                  You need an access code to take <span className="font-medium">"{selectedQuiz?.title}"</span>
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mb-4">
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
                  className={`w-full px-4 py-2 border rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                    verificationStatus === 'success'
                      ? 'border-green-300 bg-green-50'
                      : verificationStatus === 'error'
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300'
                  }`}
                  autoFocus
                  disabled={verificationStatus === 'success'}
                />
                
                <div className="flex flex-col sm:flex-row justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setModalError(null);
                      setVerificationStatus(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
                    disabled={verificationStatus === 'success'}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={verifyAccessCode}
                    disabled={!accessCode.trim() || verificationStatus === 'success'}
                    className={`px-4 py-2 rounded-lg text-white flex items-center justify-center gap-1 text-sm ${
                      verificationStatus === 'success'
                        ? 'bg-green-500'
                        : verificationStatus === 'error'
                        ? 'bg-red-500'
                        : 'bg-blue-600 hover:bg-blue-700'
                    } disabled:opacity-50`}
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
