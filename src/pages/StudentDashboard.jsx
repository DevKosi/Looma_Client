import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { runTransaction, serverTimestamp } from 'firebase/firestore';
import { getUserPosition, calculateUserStats } from '../utils/leaderboardService';
import DashboardHeader from '../components/DashboardHeader';

import { 
  FiBook, FiAward, FiUser, 
  FiSearch, FiCheckCircle, FiBarChart2, 
  FiLock, FiX, FiChevronDown, FiClock,
  FiCheck, FiTrendingUp, FiArrowRight, FiArrowLeft,
  FiHome, FiTarget, FiZap, FiStar, FiAlertCircle
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

      // Mark code as used
      await updateDoc(codeRef, {
        used: true,
        usedBy: user.uid,
        usedAt: serverTimestamp()
      });

      // Navigate to quiz
      navigate(`/quiz/${selectedQuiz.id}?code=${cleanCode}`);
    } catch (error) {
      console.error("[DEBUG] Verification error:", error);
      
      let errorMessage = "Verification failed. Please try again.";
      
      switch (error.message) {
        case "NO_QUIZ_SELECTED":
          errorMessage = "No quiz selected. Please try again.";
          break;
        case "EMPTY_CODE":
          errorMessage = "Please enter an access code.";
          break;
        case "CODE_NOT_FOUND":
          errorMessage = "Invalid access code. Please check and try again.";
          break;
        case "CODE_ALREADY_USED":
          errorMessage = "This access code has already been used.";
          break;
        default:
          errorMessage = "Verification failed. Please try again.";
      }
      
      setModalError(errorMessage);
      setVerificationStatus('error');
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Navigation tabs configuration
  const tabs = [
    {
      id: 'quizzes',
      label: 'Available Quizzes',
      icon: <FiBook className="w-5 h-5" />,
      color: 'primary'
    },
    {
      id: 'results',
      label: 'My Results',
      icon: <FiBarChart2 className="w-5 h-5" />,
      color: 'accent1'
    },
    {
      id: 'leaderboard',
      label: 'Leaderboard',
      icon: <FiAward className="w-5 h-5" />,
      color: 'warning'
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: <FiUser className="w-5 h-5" />,
      color: 'accent2'
    }
  ];

  const getTabColor = (color) => {
    const colors = {
      primary: 'from-primary-500 to-primary-600',
      accent1: 'from-accent1-500 to-accent1-600',
      warning: 'from-warning-500 to-warning-600',
      accent2: 'from-accent2-500 to-accent2-600'
    };
    return colors[color] || colors.primary;
  };

  if (loading.user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <DashboardHeader user={user} onLogout={handleLogout} />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-2">
            Welcome back, {user?.fullName?.split(' ')[0] || 'Student'}! 👋
          </h1>
          <p className="text-slate-600 text-lg">
            Ready to ace your next quiz? Let's get started!
          </p>
        </motion.div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 bg-white/60 backdrop-blur-sm rounded-2xl p-2 shadow-lg border border-white/20">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'leaderboard') {
                    navigate('/leaderboard');
                  } else {
                    setActiveTab(tab.id);
                  }
                }}
                className={`nav-link flex-1 min-w-0 ${
                  activeTab === tab.id ? 'active' : ''
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'quizzes' && (
              <div className="space-y-6">
                {/* Search and Filter */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1 relative">
                      <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Search quizzes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input-field pl-10"
                      />
                    </div>

                    {/* Department Filter */}
                    <div className="relative">
                      <button
                        onClick={() => setShowDepartments(!showDepartments)}
                        className="btn-secondary flex items-center gap-2"
                      >
                        <span>{departmentFilter === 'all' ? 'All Departments' : departmentFilter}</span>
                        <FiChevronDown className={`w-4 h-4 transition-transform ${showDepartments ? 'rotate-180' : ''}`} />
                      </button>

                      {showDepartments && (
                        <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-10">
                          <div className="p-2">
                            <button
                              onClick={() => {
                                setDepartmentFilter('all');
                                setShowDepartments(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                departmentFilter === 'all' 
                                  ? 'bg-primary-50 text-primary-700 font-medium' 
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              All Departments
                            </button>
                            {departments.map((dept) => (
                              <button
                                key={dept}
                                onClick={() => {
                                  setDepartmentFilter(dept);
                                  setShowDepartments(false);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                  departmentFilter === dept 
                                    ? 'bg-primary-50 text-primary-700 font-medium' 
                                    : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {dept}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quizzes Grid */}
                {loading.quizzes ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="card animate-pulse">
                        <div className="p-6">
                          <div className="h-4 bg-slate-200 rounded mb-3"></div>
                          <div className="h-6 bg-slate-200 rounded mb-2"></div>
                          <div className="h-4 bg-slate-200 rounded mb-4"></div>
                          <div className="h-8 bg-slate-200 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredQuizzes.length === 0 ? (
                  <div className="text-center py-12">
                    <FiBook className="mx-auto text-6xl text-slate-300 mb-4" />
                    <h3 className="text-xl font-semibold text-slate-700 mb-2">No Quizzes Available</h3>
                    <p className="text-slate-500">
                      {searchTerm || departmentFilter !== 'all' 
                        ? 'No quizzes match your current filters. Try adjusting your search.'
                        : 'Check back later for new quizzes!'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredQuizzes.map((quiz) => (
                      <motion.div
                        key={quiz.id}
                        whileHover={{ y: -8 }}
                        className="card card-interactive"
                      >
                        <div className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-accent2-100 text-accent2-700 text-xs font-semibold rounded-full">
                              <FiCheckCircle className="w-3 h-3" /> Approved
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs font-semibold rounded-full">
                                {quiz.department}
                              </span>
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                <FiClock className="w-3 h-3" /> {quiz.timeLimit} min
                              </span>
                            </div>
                          </div>

                          <h3 className="font-bold text-slate-800 mb-3 text-lg line-clamp-2">
                            {quiz.title}
                          </h3>
                          <p className="text-slate-600 mb-6 line-clamp-3 text-sm leading-relaxed">
                            {quiz.description}
                          </p>

                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500 font-medium">
                              {quiz.questions?.length || 0} questions
                            </span>
                            <button
                              onClick={() => handleTakeQuiz(quiz)}
                              className="btn-primary text-sm"
                            >
                              <FiLock className="w-4 h-4" />
                              Take Quiz
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'results' && (
              <div className="space-y-6">
                {/* Statistics Cards */}
                {userStats && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="card">
                      <div className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-600">Total Quizzes</p>
                            <p className="text-3xl font-bold text-slate-900">{userStats.totalQuizzes}</p>
                          </div>
                          <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                            <FiBook className="text-primary-600 w-6 h-6" />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="card">
                      <div className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-600">Average Score</p>
                            <p className="text-3xl font-bold text-slate-900">{userStats.averagePercentage}%</p>
                          </div>
                          <div className="w-12 h-12 bg-accent1-100 rounded-xl flex items-center justify-center">
                            <FiBarChart2 className="text-accent1-600 w-6 h-6" />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="card">
                      <div className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-600">Best Score</p>
                            <p className="text-3xl font-bold text-slate-900">{userStats.highestScore}</p>
                          </div>
                          <div className="w-12 h-12 bg-warning-100 rounded-xl flex items-center justify-center">
                            <FiAward className="text-warning-600 w-6 h-6" />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="card">
                      <div className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-600">Current Streak</p>
                            <p className="text-3xl font-bold text-slate-900">{userStats.recentStreak}</p>
                          </div>
                          <div className="w-12 h-12 bg-accent2-100 rounded-xl flex items-center justify-center">
                            <FiTrendingUp className="text-accent2-600 w-6 h-6" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Results Table */}
                <div className="card">
                  <div className="px-6 py-4 border-b border-slate-200">
                    <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                      <FiBarChart2 className="text-primary-600" />
                      Quiz Results ({userResults.length})
                    </h2>
                  </div>
                  
                  {loading.results ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
                      <p className="text-slate-600">Loading your results...</p>
                    </div>
                  ) : userResults.length === 0 ? (
                    <div className="p-8 text-center">
                      <FiBarChart2 className="mx-auto text-6xl text-slate-300 mb-4" />
                      <h3 className="text-xl font-semibold text-slate-700 mb-2">No Quiz Results Yet</h3>
                      <p className="text-slate-500">Take your first quiz to see your results here!</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Quiz</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Percentage</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Performance</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {userResults.map((result, index) => (
                            <tr key={result.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="text-sm font-semibold text-slate-900">{result.quizTitle}</div>
                                  <div className="text-sm text-slate-500">{result.quizDepartment}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-semibold text-slate-900">
                                  {result.score}/{result.total}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-1 max-w-20">
                                    <div className={`h-2 rounded-full mr-2 ${
                                      (result.percentage || 0) >= 70 ? 'bg-accent2-200' :
                                      (result.percentage || 0) >= 50 ? 'bg-warning-200' : 'bg-error-200'
                                    }`}>
                                      <div 
                                        className={`h-2 rounded-full ${
                                          (result.percentage || 0) >= 70 ? 'bg-accent2-500' :
                                          (result.percentage || 0) >= 50 ? 'bg-warning-500' : 'bg-error-500'
                                        }`}
                                        style={{ width: `${Math.min(result.percentage || 0, 100)}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                  <span className="text-sm font-semibold text-slate-900 ml-2">
                                    {result.percentage || 0}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                {result.submittedAt.toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                                  (result.percentage || 0) >= 90 ? 'bg-accent2-100 text-accent2-800' :
                                  (result.percentage || 0) >= 80 ? 'bg-accent1-100 text-accent1-800' :
                                  (result.percentage || 0) >= 70 ? 'bg-warning-100 text-warning-800' :
                                  (result.percentage || 0) >= 50 ? 'bg-orange-100 text-orange-800' :
                                  'bg-error-100 text-error-800'
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
                <div className="card overflow-hidden">
                  <div className="bg-gradient-to-r from-primary-600 to-accent1-600 p-8 text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary-600/20 to-accent1-600/20"></div>
                    <div className="relative z-10 flex items-center space-x-6">
                      <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <FiUser className="w-10 h-10 text-white" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-bold">{user?.fullName || 'Student'}</h2>
                        <p className="text-white/90 mt-1 text-lg">{user?.regNumber}</p>
                        <p className="text-white/80 text-sm">{user?.department} Department</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Profile Information */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Personal Information */}
                  <div className="card">
                    <div className="p-6">
                      <h3 className="text-xl font-semibold text-slate-800 mb-6 flex items-center gap-2">
                        <FiUser className="text-primary-600" />
                        Personal Information
                      </h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                          <div>
                            <label className="block text-sm font-medium text-slate-600">Full Name</label>
                            <p className="text-slate-900 font-semibold">{user?.fullName || 'Not provided'}</p>
                          </div>
                          <FiUser className="text-slate-400" />
                        </div>
                        
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                          <div>
                            <label className="block text-sm font-medium text-slate-600">Registration Number</label>
                            <p className="text-slate-900 font-semibold">{user?.regNumber || 'Not provided'}</p>
                          </div>
                          <FiBook className="text-slate-400" />
                        </div>
                        
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                          <div>
                            <label className="block text-sm font-medium text-slate-600">Department</label>
                            <p className="text-slate-900 font-semibold">{user?.department || 'Not provided'}</p>
                          </div>
                          <FiBook className="text-slate-400" />
                        </div>
                        
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                          <div>
                            <label className="block text-sm font-medium text-slate-600">Email Address</label>
                            <p className="text-slate-900 font-semibold">{user?.email || 'Not provided'}</p>
                          </div>
                          <FiUser className="text-slate-400" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Academic Summary */}
                  <div className="card">
                    <div className="p-6">
                      <h3 className="text-xl font-semibold text-slate-800 mb-6 flex items-center gap-2">
                        <FiBarChart2 className="text-accent1-600" />
                        Academic Summary
                      </h3>
                      
                      {userStats ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-primary-50 rounded-xl">
                            <div>
                              <label className="block text-sm font-medium text-primary-600">Quizzes Completed</label>
                              <p className="text-primary-900 font-bold text-2xl">{userStats.totalQuizzes}</p>
                            </div>
                            <FiBook className="text-primary-600 w-6 h-6" />
                          </div>
                          
                          <div className="flex items-center justify-between p-4 bg-accent1-50 rounded-xl">
                            <div>
                              <label className="block text-sm font-medium text-accent1-600">Average Score</label>
                              <p className="text-accent1-900 font-bold text-2xl">{userStats.averagePercentage}%</p>
                            </div>
                            <FiBarChart2 className="text-accent1-600 w-6 h-6" />
                          </div>
                          
                          <div className="flex items-center justify-between p-4 bg-warning-50 rounded-xl">
                            <div>
                              <label className="block text-sm font-medium text-warning-600">Best Performance</label>
                              <p className="text-warning-900 font-bold text-2xl">{userStats.highestScore}</p>
                            </div>
                            <FiAward className="text-warning-600 w-6 h-6" />
                          </div>
                          
                          <div className="flex items-center justify-between p-4 bg-accent2-50 rounded-xl">
                            <div>
                              <label className="block text-sm font-medium text-accent2-600">Current Streak</label>
                              <p className="text-accent2-900 font-bold text-2xl">{userStats.recentStreak}</p>
                            </div>
                            <FiTrendingUp className="text-accent2-600 w-6 h-6" />
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <FiBarChart2 className="mx-auto text-6xl text-slate-300 mb-4" />
                          <p className="text-slate-500">Take your first quiz to see your academic summary!</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Access Code Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-slate-800">Enter Access Code</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold text-slate-800 mb-2">{selectedQuiz?.title}</h4>
                <p className="text-slate-600 text-sm">{selectedQuiz?.description}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Access Code
                  </label>
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="Enter the access code"
                    className="input-field"
                    onKeyPress={(e) => e.key === 'Enter' && verifyAccessCode()}
                  />
                </div>

                {modalError && (
                  <div className="status-error">
                    <FiAlertCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">{modalError}</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={verifyAccessCode}
                    className="btn-primary flex-1"
                  >
                    Start Quiz
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-4 right-4 p-4 rounded-xl shadow-lg z-50 ${
              notification.type === 'error' ? 'status-error' : 'status-success'
            }`}
          >
            <div className="flex items-center gap-3">
              {notification.type === 'error' ? (
                <FiAlertCircle className="w-5 h-5" />
              ) : (
                <FiCheckCircle className="w-5 h-5" />
              )}
              <span className="font-medium">{notification.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
