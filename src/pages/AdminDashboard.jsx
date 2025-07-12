import React, { useState, useEffect, useCallback } from 'react';
import { auth, db } from '../firebase/firebaseConfig';
import { 
  collection, doc, getDoc, getDocs, addDoc, 
  updateDoc, deleteDoc, query, where, writeBatch,
  serverTimestamp, runTransaction
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiPlus, FiLogOut, FiList, FiTrash2, FiEdit2, 
  FiCodesandbox, FiClock, FiUsers, 
  FiBarChart2, FiCheck, FiX, FiSave, FiBook,
  FiDownload, FiEye, FiEyeOff
} from 'react-icons/fi';
import { debugQuizSubmissions } from '../utils/debugHelpers';
import { CSVLink } from 'react-csv';

const AdminDashboard = () => {
  // State management
  const [admin, setAdmin] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [activeTab, setActiveTab] = useState('create');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    timeLimit: 30,
    questionsToRender: '',
    status: 'draft',
    questions: []
  });
  const [loading, setLoading] = useState({
    admin: true,
    quizzes: false,
    action: false,
    results: false
  });
  const [notification, setNotification] = useState(null);

  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    activeQuizzes: 0,
    draftQuizzes: 0,
    totalParticipants: 0
  });
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState(null);

  const navigate = useNavigate();

  // Question types
  const QUESTION_TYPES = {
    MULTIPLE_CHOICE: 'multiple_choice',
    TRUE_FALSE: 'true_false',
    SHORT_ANSWER: 'short_answer'
  };

  // Fetch admin data
  const fetchAdminData = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) return navigate('/login');

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists() && userSnap.data().role === 'admin') {
        setAdmin({ ...userSnap.data(), uid: user.uid });
        fetchQuizzes(userSnap.data().department);
        fetchStats(userSnap.data().department);
      } else {
        navigate('/login');
      }
    } catch (error) {
      showNotification('Failed to load admin data', 'error');
    } finally {
      setLoading(prev => ({ ...prev, admin: false }));
    }
  }, [navigate]);

  // Fetch quizzes for admin's department
  const fetchQuizzes = useCallback(async (department) => {
    setLoading(prev => ({ ...prev, quizzes: true }));
    try {
      const q = query(
        collection(db, 'quizzes'),
        where('department', '==', department),
        where('createdBy', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const quizzesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setQuizzes(quizzesData);
    } catch (error) {
      showNotification('Failed to fetch quizzes', 'error');
    } finally {
      setLoading(prev => ({ ...prev, quizzes: false }));
    }
  }, []);

  // Fetch platform stats
  const fetchStats = useCallback(async (department) => {
    try {
      const q = query(
        collection(db, 'quizzes'),
        where('department', '==', department)
      );
      const snapshot = await getDocs(q);
      
      const total = snapshot.size;
      const active = snapshot.docs.filter(doc => doc.data().status === 'approved').length;
      const draft = snapshot.docs.filter(doc => doc.data().status === 'draft').length;

      // Calculate total participants (simplified example)
      let participants = 0;
      for (const quizDoc of snapshot.docs) {
        const submissionsRef = collection(db, 'quizzes', quizDoc.id, 'submissions');
        const submissionsSnap = await getDocs(submissionsRef);
        participants += submissionsSnap.size;
      }

      setStats({
        totalQuizzes: total,
        activeQuizzes: active,
        draftQuizzes: draft,
        totalParticipants: participants
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  // Fetch quiz results
  const fetchResults = useCallback(async (quizId) => {
    setLoading(prev => ({ ...prev, results: true }));
    try {
      const submissionsRef = collection(db, 'quizzes', quizId, 'submissions');
      const snapshot = await getDocs(submissionsRef);
      
      console.log(`📊 FOUND ${snapshot.size} SUBMISSIONS FOR QUIZ ${quizId}`);
      
      const resultsData = snapshot.docs.map((doc, index) => {
        const data = doc.data();
        console.log(`Raw submission data ${index + 1}:`, data);
        
        // Enhanced data processing with validation
        const processedData = {
          id: doc.id,
          ...data,
          timestamp: data.submittedAt?.toDate ? data.submittedAt.toDate().toLocaleString() : 'Unknown',
          percentage: typeof data.percentage === 'number' ? data.percentage : 0,
          timeSpent: typeof data.timeSpent === 'number' ? data.timeSpent : 0,
          email: data.email || 'No email',
          regNumber: data.regNumber || 'Anonymous',
          fullName: data.fullName || 'Unknown',
          department: data.department || 'Unknown'
        };

        // Log data quality issues
        if (processedData.regNumber === 'Anonymous') {
          console.warn(`⚠️ Anonymous regNumber in submission ${index + 1}`);
        }
        if (processedData.percentage === 0 && data.score > 0) {
          console.warn(`⚠️ Zero percentage despite score > 0 in submission ${index + 1}`);
        }
        if (processedData.email === 'No email') {
          console.warn(`⚠️ Missing email in submission ${index + 1}`);
        }

        return processedData;
      });
      
      console.log('Processed results data:', resultsData);
      
      // Run additional debug check
      debugQuizSubmissions(quizId);
      setResults(resultsData);
    } catch (error) {
      console.error('Error fetching results:', error);
      showNotification('Failed to fetch results', 'error');
    } finally {
      setLoading(prev => ({ ...prev, results: false }));
    }
  }, []);

  // Initialize data fetching
  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  // Load results when quiz is selected
  useEffect(() => {
    if (selectedQuiz && activeTab === 'manage') {
      fetchResults(selectedQuiz);
    }
  }, [selectedQuiz, activeTab, fetchResults]);

  // Notification handler
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // Form input handler
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Create new quiz
  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    setLoading(prev => ({ ...prev, action: true }));

    try {
      const quizData = {
        ...formData,
        department: admin.department,
        createdBy: admin.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Validate at least one question exists
      if (quizData.questions.length === 0) {
        throw new Error('Please add at least one question');
      }

      const quizRef = await addDoc(collection(db, 'quizzes'), quizData);

      showNotification('Quiz created successfully!');
      setFormData({
        title: '',
        description: '',
        timeLimit: 30,
        status: 'draft',
        questions: []
      });
      setSelectedQuiz(quizRef.id);
      fetchQuizzes(admin.department);
      fetchStats(admin.department);
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      setLoading(prev => ({ ...prev, action: false }));
    }
  };

  // Update quiz with transaction
  const handleUpdateQuiz = async (quizId, updates) => {
    setLoading(prev => ({ ...prev, action: true }));
    try {
      await runTransaction(db, async (transaction) => {
        const quizRef = doc(db, 'quizzes', quizId);
        const quizDoc = await transaction.get(quizRef);
        
        if (!quizDoc.exists()) {
          throw new Error("Quiz does not exist!");
        }

        // Verify the user is the creator
        if (quizDoc.data().createdBy !== auth.currentUser.uid) {
          throw new Error("Unauthorized update attempt");
        }

        transaction.update(quizRef, {
          ...updates,
          updatedAt: serverTimestamp()
        });
      });

      showNotification('Quiz updated successfully!');
      fetchQuizzes(admin.department);
      fetchStats(admin.department);
      
      // If editing current quiz, update form data
      if (editingQuiz?.id === quizId) {
        setFormData(prev => ({ ...prev, ...updates }));
      }
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      setLoading(prev => ({ ...prev, action: false }));
    }
  };

  // Delete quiz with transaction
  const handleDeleteQuiz = async (quizId) => {
    if (!window.confirm('Are you sure you want to delete this quiz and all its data?')) return;
    
    setLoading(prev => ({ ...prev, action: true }));
    try {
      await runTransaction(db, async (transaction) => {
        const quizRef = doc(db, 'quizzes', quizId);
        const quizDoc = await transaction.get(quizRef);
        
        if (!quizDoc.exists()) {
          throw new Error("Quiz does not exist!");
        }

        // Verify the user is the creator
        if (quizDoc.data().createdBy !== auth.currentUser.uid) {
          throw new Error("Unauthorized deletion attempt");
        }

        // Delete quiz document
        transaction.delete(quizRef);
        
        // Delete all codes for this quiz
        const codesQuery = query(collection(db, 'quizzes', quizId, 'codes'));
        const codesSnapshot = await getDocs(codesQuery);
        codesSnapshot.forEach(doc => {
          transaction.delete(doc.ref);
        });

        // Delete all submissions for this quiz
        const submissionsQuery = query(collection(db, 'quizzes', quizId, 'submissions'));
        const submissionsSnapshot = await getDocs(submissionsQuery);
        submissionsSnapshot.forEach(doc => {
          transaction.delete(doc.ref);
        });
      });

      showNotification('Quiz and all associated data deleted successfully!');
      fetchQuizzes(admin.department);
      fetchStats(admin.department);
      setSelectedQuiz(null);
      setEditingQuiz(null);
    } catch (error) {
      showNotification(`Deletion failed: ${error.message}`, 'error');
    } finally {
      setLoading(prev => ({ ...prev, action: false }));
    }
  };



  // Clear quiz results
  const clearResults = async (quizId) => {
    if (!window.confirm('Permanently delete all results for this quiz?')) return;
    
    setLoading(prev => ({ ...prev, action: true }));
    try {
      const batch = writeBatch(db);
      const submissionsRef = collection(db, 'quizzes', quizId, 'submissions');
      const snapshot = await getDocs(submissionsRef);
      
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      setResults([]);
      showNotification('Results cleared successfully');
      fetchStats(admin.department); // Update stats
    } catch (error) {
      showNotification('Failed to clear results', 'error');
    } finally {
      setLoading(prev => ({ ...prev, action: false }));
    }
  };

  // Question management functions
  const addQuestion = (newQuestion) => {
    if (!newQuestion.text.trim()) return;
    
    const updatedQuestions = [
      ...formData.questions,
      {
        ...newQuestion,
        id: Date.now().toString()
      }
    ];

    setFormData({
      ...formData,
      questions: updatedQuestions
    });
  };

  const updateQuestion = (questionId, updates) => {
    setFormData({
      ...formData,
      questions: formData.questions.map(q => 
        q.id === questionId ? { ...q, ...updates } : q
      )
    });
  };

  const removeQuestion = (questionId) => {
    setFormData({
      ...formData,
      questions: formData.questions.filter(q => q.id !== questionId)
    });
  };

  // Start editing an existing quiz
  const startEditingQuiz = (quiz) => {
    setEditingQuiz(quiz);
    setFormData({
      title: quiz.title,
      description: quiz.description,
      timeLimit: quiz.timeLimit,
      questionsToRender: quiz.questionsToRender || '',
      status: quiz.status,
      questions: quiz.questions || []
    });
    setActiveTab('create');
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingQuiz(null);
    setFormData({
      title: '',
      description: '',
      timeLimit: 30,
      questionsToRender: '',
      status: 'draft',
      questions: []
    });
  };

  // Logout handler
  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  if (loading.admin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-gray-800 truncate">Admin Dashboard</h1>
              <p className="text-xs sm:text-sm text-gray-600 truncate">
                {admin?.department} Department
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 text-sm font-medium px-3 py-2 rounded-lg hover:bg-red-50 transition-colors self-end sm:self-auto"
            >
              <FiLogOut size={16} /> 
              <span className="hidden sm:inline">Logout</span>
              <span className="sm:hidden">Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <StatCard 
            icon={<FiCodesandbox className="text-blue-500" size={20} />}
            title="Total Quizzes"
            value={stats.totalQuizzes}
            loading={loading.quizzes}
          />
          <StatCard 
            icon={<FiBarChart2 className="text-green-500" size={20} />}
            title="Active Quizzes"
            value={stats.activeQuizzes}
            loading={loading.quizzes}
          />
          <StatCard 
            icon={<FiClock className="text-yellow-500" size={20} />}
            title="Draft Quizzes"
            value={stats.draftQuizzes}
            loading={loading.quizzes}
          />
          <StatCard 
            icon={<FiUsers className="text-purple-500" size={20} />}
            title="Total Participants"
            value={stats.totalParticipants}
            loading={loading.quizzes}
          />
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex overflow-x-auto scrollbar-hide">
            <button
              onClick={() => {
                setActiveTab('create');
                setEditingQuiz(null);
              }}
              className={`px-3 sm:px-4 py-3 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2 whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'create' ? 'text-blue-600 border-blue-600' : 'text-gray-500 hover:text-gray-700 border-transparent'
              }`}
            >
              <FiPlus size={14} /> 
              <span className="hidden xs:inline">{editingQuiz ? 'Edit' : 'Create'}</span>
              <span className="hidden sm:inline">{editingQuiz ? ' Quiz' : ' Quiz'}</span>
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`px-3 sm:px-4 py-3 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2 whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'manage' ? 'text-blue-600 border-blue-600' : 'text-gray-500 hover:text-gray-700 border-transparent'
              }`}
            >
              <FiList size={14} /> 
              <span className="hidden xs:inline">Manage</span>
              <span className="hidden sm:inline"> Quizzes</span>
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`px-3 sm:px-4 py-3 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2 whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'results' ? 'text-blue-600 border-blue-600' : 'text-gray-500 hover:text-gray-700 border-transparent'
              }`}
            >
              <FiBarChart2 size={14} /> 
              <span className="hidden xs:inline">Results</span>
              <span className="hidden sm:inline">Quiz Results</span>
            </button>
            <button
              onClick={() => setActiveTab('questions')}
              className={`px-3 sm:px-4 py-3 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2 whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'questions' ? 'text-blue-600 border-blue-600' : 'text-gray-500 hover:text-gray-700 border-transparent'
              }`}
            >
              <FiBook size={14} /> 
              <span className="hidden xs:inline">Questions</span>
              <span className="hidden sm:inline">Manage Questions</span>
            </button>
            <button
              onClick={() => navigate('/leaderboard')}
              className="px-3 sm:px-4 py-3 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2 whitespace-nowrap text-gray-500 hover:text-gray-700 hover:text-blue-600 transition-colors"
            >
              <FiUsers size={14} /> 
              <span className="hidden xs:inline">Leaderboard</span>
            </button>
          </div>
        </div>

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

        {/* Create/Edit Quiz Form */}
        {activeTab === 'create' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-lg shadow-sm p-6"
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {editingQuiz ? 'Edit Quiz' : 'Create New Quiz'}
            </h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (editingQuiz) {
                handleUpdateQuiz(editingQuiz.id, formData);
              } else {
                handleCreateQuiz(e);
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time Limit (minutes)</label>
                  <input
                    type="number"
                    name="timeLimit"
                    min="1"
                    value={formData.timeLimit}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Questions to Render</label>
                  <input
                    type="number"
                    name="questionsToRender"
                    min="1"
                    value={formData.questionsToRender || formData.questions.length}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="All questions"
                  />
                  <p className="text-xs text-gray-500 mt-1">Number of questions to show per quiz attempt</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="pending">Submit for Approval</option>
                    {editingQuiz?.status === 'approved' && <option value="approved">Approved</option>}
                  </select>
                </div>
              </div>

              {/* Question Editor */}
              <QuestionEditor 
                questions={formData.questions}
                addQuestion={addQuestion}
                updateQuestion={updateQuestion}
                removeQuestion={removeQuestion}
              />

              <div className="pt-2 flex justify-between">
                {editingQuiz && (
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel Editing
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading.action || formData.questions.length === 0}
                  className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center justify-center gap-2 disabled:opacity-50 ${
                    editingQuiz ? 'ml-auto' : 'w-full'
                  }`}
                >
                  {loading.action ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <FiSave /> {editingQuiz ? 'Update Quiz' : 'Create Quiz'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Manage Quizzes */}
        {activeTab === 'manage' && (
          <div className="space-y-6">
            {loading.quizzes ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : quizzes.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-6 text-center">
                <p className="text-gray-500">No quizzes found</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="grid grid-cols-12 bg-gray-50 p-4 border-b border-gray-200 font-medium text-sm text-gray-500">
                  <div className="col-span-4">Title</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2">Questions Pool</div>
                  <div className="col-span-1">Renders</div>
                  <div className="col-span-3">Actions</div>
                </div>

                {quizzes.map(quiz => (
                  <motion.div 
                    key={quiz.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-12 p-4 border-b border-gray-200 items-center hover:bg-gray-50"
                  >
                    <div className="col-span-4 font-medium text-gray-800">
                      {quiz.title}
                      <p className="text-sm text-gray-500 truncate">{quiz.description}</p>
                    </div>
                    <div className="col-span-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        quiz.status === 'approved' ? 'bg-green-100 text-green-800' :
                        quiz.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {quiz.status}
                      </span>
                    </div>
                    <div className="col-span-2 text-gray-600">
                      {quiz.questions?.length || 0} questions
                    </div>
                    <div className="col-span-1 text-gray-600 text-sm">
                      {quiz.questionsToRender || 'All'}
                    </div>
                    <div className="col-span-3 flex items-center gap-2">
                      <button
                        onClick={() => startEditingQuiz(quiz)}
                        className="p-2 text-yellow-600 hover:bg-yellow-50 rounded"
                        title="Edit Quiz"
                      >
                        <FiEdit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteQuiz(quiz.id)}
                        disabled={loading.action}
                        className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                        title="Delete Quiz"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}




                      </div>
          )}

        {/* Quiz Results Tab */}
        {activeTab === 'results' && (
          <div className="space-y-6">
            {/* Quiz Selection for Results */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Select Quiz to View Results</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {quizzes.map(quiz => (
                  <motion.div
                    key={quiz.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedQuiz(quiz.id);
                      fetchResults(quiz.id);
                    }}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedQuiz === quiz.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <h3 className="font-medium text-gray-800">{quiz.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">{quiz.description}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        quiz.status === 'approved' ? 'bg-green-100 text-green-800' :
                        quiz.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {quiz.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        {quiz.questions?.length || 0} questions
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Results Display */}
            {selectedQuiz && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <FiBarChart2 /> Results for: {quizzes.find(q => q.id === selectedQuiz)?.title}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Total Submissions: {results.length}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <CSVLink 
                      data={results.map(result => ({
                        'Registration Number': result.regNumber,
                        'Full Name': result.fullName,
                        'Department': result.department,
                        'Email': result.email,
                        'Score': result.score,
                        'Total': result.total,
                        'Percentage': result.percentage + '%',
                        'Time Spent (mins)': Math.round((result.timeSpent || 0) / 60),
                        'Submitted At': result.timestamp,
                        'Quiz Title': result.quizTitle
                      }))}
                      filename={`quiz-results-${quizzes.find(q => q.id === selectedQuiz)?.title}-${new Date().toISOString().split('T')[0]}.csv`}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg transition-colors"
                    >
                      <FiDownload /> Export CSV
                    </CSVLink>
                    <button
                      onClick={() => clearResults(selectedQuiz)}
                      className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg transition-colors"
                    >
                      <FiTrash2 /> Clear All Results
                    </button>
                  </div>
                </div>

                {loading.results ? (
                  <div className="flex justify-center py-8">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Loading results...</p>
                    </div>
                  </div>
                ) : results.length === 0 ? (
                  <div className="text-center py-8">
                    <FiBarChart2 className="mx-auto text-4xl text-gray-400 mb-4" />
                    <p className="text-gray-500">No submissions found for this quiz</p>
                    <p className="text-sm text-gray-400 mt-2">Results will appear here when students submit the quiz</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Student Details
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Registration Number
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Department
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Score
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Percentage
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Time Spent
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Submitted At
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {results.map((result, index) => (
                          <tr key={result.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {result.fullName || 'Unknown'}
                              </div>
                              <div className="text-sm text-gray-500">
                                {result.email || 'No email'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                result.regNumber === 'Anonymous' 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {result.regNumber || 'Anonymous'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {result.department || 'Unknown'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <span className="text-gray-900">{result.score}</span>
                              <span className="text-gray-500"> / {result.total}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-1">
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
                              {result.timeSpent ? `${Math.round(result.timeSpent / 60)} mins` : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {result.timestamp || 'Unknown'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Manage Questions */}
        {activeTab === 'questions' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {selectedQuiz ? `Editing: ${quizzes.find(q => q.id === selectedQuiz)?.title}` : 'Select a Quiz to Edit Questions'}
            </h2>
            
            {selectedQuiz ? (
              <QuestionEditor
                questions={quizzes.find(q => q.id === selectedQuiz)?.questions || []}
                addQuestion={(newQuestion) => {
                  const quiz = quizzes.find(q => q.id === selectedQuiz);
                  const updatedQuestions = [...quiz.questions, newQuestion];
                  handleUpdateQuiz(selectedQuiz, { questions: updatedQuestions });
                }}
                updateQuestion={(questionId, updates) => {
                  const quiz = quizzes.find(q => q.id === selectedQuiz);
                  const updatedQuestions = quiz.questions.map(q => 
                    q.id === questionId ? { ...q, ...updates } : q
                  );
                  handleUpdateQuiz(selectedQuiz, { questions: updatedQuestions });
                }}
                removeQuestion={(questionId) => {
                  const quiz = quizzes.find(q => q.id === selectedQuiz);
                  const updatedQuestions = quiz.questions.filter(q => q.id !== questionId);
                  handleUpdateQuiz(selectedQuiz, { questions: updatedQuestions });
                }}
              />
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FiBook className="mx-auto text-3xl mb-2" />
                <p>Please select a quiz from the list below to edit questions</p>
                
                <div className="mt-6 space-y-3 max-w-md mx-auto">
                  {quizzes.map(quiz => (
                    <motion.div
                      key={quiz.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedQuiz(quiz.id)}
                      className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <h3 className="font-medium">{quiz.title}</h3>
                      <p className="text-sm text-gray-500">
                        {quiz.questions?.length || 0} questions • {quiz.status}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

// StatCard Component
const StatCard = ({ icon, title, value, loading }) => (
  <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4">
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="p-1.5 sm:p-2 bg-gray-100 rounded-full flex-shrink-0">
        {React.cloneElement(icon, { size: 16 })}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs sm:text-sm text-gray-500 truncate">{title}</p>
        {loading ? (
          <div className="h-5 sm:h-6 w-10 sm:w-12 bg-gray-200 rounded mt-1 animate-pulse"></div>
        ) : (
          <p className="text-lg sm:text-xl font-semibold text-gray-800">{value}</p>
        )}
      </div>
    </div>
  </div>
);

// QuestionEditor Component
const QuestionEditor = ({ questions, addQuestion, updateQuestion, removeQuestion }) => {
  const [newQuestion, setNewQuestion] = useState({
    text: '',
    type: 'multiple_choice',
    options: [{ id: Date.now().toString(), text: '', correct: false }],
    points: 1
  });

  const handleAddQuestion = () => {
    if (!newQuestion.text.trim()) return;
    
    const questionToAdd = {
      ...newQuestion,
      id: Date.now().toString()
    };

    // Handle different question types
    if (newQuestion.type === 'true_false') {
      delete questionToAdd.options;
      questionToAdd.correctAnswer = true;
    } else if (newQuestion.type === 'short_answer') {
      delete questionToAdd.options;
    }

    addQuestion(questionToAdd);
    resetQuestionForm();
  };

  const handleAddOption = () => {
    setNewQuestion({
      ...newQuestion,
      options: [
        ...newQuestion.options,
        { id: Date.now().toString(), text: '', correct: false }
      ]
    });
  };

  const handleUpdateOption = (optionId, updates) => {
    setNewQuestion({
      ...newQuestion,
      options: newQuestion.options.map(opt =>
        opt.id === optionId ? { ...opt, ...updates } : opt
      )
    });
  };

  const handleRemoveOption = (optionId) => {
    setNewQuestion({
      ...newQuestion,
      options: newQuestion.options.filter(opt => opt.id !== optionId)
    });
  };

  const resetQuestionForm = () => {
    setNewQuestion({
      text: '',
      type: 'multiple_choice',
      options: [{ id: Date.now().toString(), text: '', correct: false }],
      points: 1
    });
  };

  return (
    <div className="space-y-6">
      {/* Existing Questions */}
      <div className="space-y-4">
        {questions.map((question, index) => (
          <motion.div
            key={question.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
          >
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium text-gray-800">
                  Q{index + 1}: {question.text}
                </h4>
                <p className="text-sm text-gray-500 mt-1">
                  {question.type === 'multiple_choice' ? (
                    `Multiple Choice (${question.options?.filter(o => o.correct).length} correct)`
                  ) : question.type === 'true_false' ? (
                    `True/False (Correct: ${question.correctAnswer ? 'True' : 'False'})`
                  ) : (
                    'Short Answer'
                  )} • {question.points} point{question.points !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // Prepare the question for editing
                    const editQuestion = { ...question };
                    if (question.type === 'multiple_choice') {
                      editQuestion.options = question.options.map(opt => ({ ...opt }));
                    }
                    setNewQuestion(editQuestion);
                  }}
                  className="text-blue-500 hover:text-blue-700 p-1"
                >
                  <FiEdit2 size={16} />
                </button>
                <button
                  onClick={() => removeQuestion(question.id)}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <FiTrash2 size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add New Question */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-medium text-blue-800 mb-3">Add New Question</h3>
        
        <div className="space-y-4">
          {/* Question Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Question Text
            </label>
            <input
              type="text"
              value={newQuestion.text}
              onChange={(e) => setNewQuestion({...newQuestion, text: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your question"
            />
          </div>

          {/* Question Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Question Type
            </label>
            <select
              value={newQuestion.type}
              onChange={(e) => setNewQuestion({
                ...newQuestion, 
                type: e.target.value,
                // Reset options when changing type
                options: e.target.value === 'multiple_choice' 
                  ? [{ id: Date.now().toString(), text: '', correct: false }]
                  : undefined,
                correctAnswer: e.target.value === 'true_false' ? true : undefined
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="multiple_choice">Multiple Choice</option>
              <option value="true_false">True/False</option>
              <option value="short_answer">Short Answer</option>
            </select>
          </div>

          {/* Points */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Points
            </label>
            <input
              type="number"
              min="1"
              value={newQuestion.points}
              onChange={(e) => setNewQuestion({
                ...newQuestion, 
                points: parseInt(e.target.value) || 1
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Options (for multiple choice) */}
          {newQuestion.type === 'multiple_choice' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Options
              </label>
              {newQuestion.options.map((option, idx) => (
                <div key={option.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={option.correct}
                    onChange={() => handleUpdateOption(option.id, { correct: !option.correct })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <input
                    type="text"
                    value={option.text}
                    onChange={(e) => handleUpdateOption(option.id, { text: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder={`Option ${idx + 1}`}
                  />
                  <button
                    onClick={() => handleRemoveOption(option.id)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <FiX size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddOption}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
              >
                <FiPlus size={14} /> Add Option
              </button>
            </div>
          )}

          {/* True/False Answer */}
          {newQuestion.type === 'true_false' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correct Answer
              </label>
              <div className="flex gap-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    checked={newQuestion.correctAnswer === true}
                    onChange={() => setNewQuestion({...newQuestion, correctAnswer: true})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-gray-700">True</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    checked={newQuestion.correctAnswer === false}
                    onChange={() => setNewQuestion({...newQuestion, correctAnswer: false})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="ml-2 text-gray-700">False</span>
                </label>
              </div>
            </div>
          )}

          {/* Add Question Button */}
          <button
            type="button"
            onClick={handleAddQuestion}
            disabled={!newQuestion.text.trim() || 
              (newQuestion.type === 'multiple_choice' && 
               newQuestion.options.some(o => !o.text.trim()))}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
          >
            <FiPlus size={16} /> Add Question
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
