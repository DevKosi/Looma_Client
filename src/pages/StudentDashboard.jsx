import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { runTransaction, serverTimestamp } from 'firebase/firestore';

import { 
  FiLogOut, FiBook, FiAward, FiUser, 
  FiSearch, FiCheckCircle, FiBarChart2, 
  FiLock, FiX, FiChevronDown, FiClock,
  FiCheck
} from 'react-icons/fi';

export default function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState({ user: true, quizzes: true });
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
        setLoading({ user: false, quizzes: false });
      }
    };

    fetchData();
  }, [navigate]);

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
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-100 rounded-full">
              <FiBook className="text-blue-600" size={20} />
            </div>
            <div>
              <h1 className="font-bold text-gray-800">Student Dashboard</h1>
              <p className="text-sm text-gray-600">
                {user?.department} • {user?.regNumber}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 text-sm font-medium"
            >
              <FiLogOut /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('quizzes')}
              className={`px-4 py-3 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'quizzes' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FiBook size={16} /> Available Quizzes
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`px-4 py-3 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'results' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FiBarChart2 size={16} /> My Results
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`px-4 py-3 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'leaderboard' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FiAward size={16} /> Leaderboard
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-3 font-medium text-sm flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'profile' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
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
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <FiBarChart2 className="mx-auto text-gray-400" size={48} />
            <h3 className="text-lg font-medium text-gray-700 mt-4">
              My Quiz Results
            </h3>
            <p className="text-gray-500 mt-1">
              Coming soon - View your performance across all quizzes
            </p>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <FiAward className="mx-auto text-gray-400" size={48} />
            <h3 className="text-lg font-medium text-gray-700 mt-4">
              Leaderboard
            </h3>
            <p className="text-gray-500 mt-1">
              Coming soon - Compare your performance with others
            </p>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">My Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <p className="text-gray-900">{user?.fullName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                <p className="text-gray-900">{user?.regNumber}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <p className="text-gray-900">{user?.department}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <p className="text-gray-900">{user?.email}</p>
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
