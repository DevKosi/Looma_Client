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
  FiUpload, FiCodesandbox, FiClock, FiUsers, 
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
  const [bulkCodes, setBulkCodes] = useState('');
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

  // Bulk upload access codes
  const handleBulkUploadCodes = async () => {
    if (!selectedQuiz || !bulkCodes.trim()) return;
    
    setLoading(prev => ({ ...prev, action: true }));
    try {
      const codes = bulkCodes.split(/\s+/).filter(code => code.trim().length > 0);
      const batch = writeBatch(db);
      
      codes.forEach(code => {
        const codeRef = doc(collection(db, 'quizzes', selectedQuiz, 'codes'), code);
        batch.set(codeRef, { 
          code, 
          used: false, 
          usedBy: null,
          createdAt: serverTimestamp() 
        });
      });

      await batch.commit();
      showNotification(`${codes.length} codes uploaded successfully!`);
      setBulkCodes('');
    } catch (error) {
      showNotification('Failed to upload codes', 'error');
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-800">Admin Dashboard</h1>
              <p className="text-xs sm:text-sm text-gray-600">
                {admin?.department} Department
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-red-600 hover:text-red-700 text-sm"
            >
              <FiLogOut /> 
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <StatCard 
            icon={<FiCodesandbox className="text-blue-500" size={18} />}
            title="Total Quizzes"
            value={stats.totalQuizzes}
            loading={loading.quizzes}
          />
          <StatCard 
            icon={<FiBarChart2 className="text-green-500" size={18} />}
            title="Active Quizzes"
            value={stats.activeQuizzes}
            loading={loading.quizzes}
          />
          <StatCard 
            icon={<FiClock className="text-orange-500" size={18} />}
            title="Draft Quizzes"
            value={stats.draftQuizzes}
            loading={loading.quizzes}
          />
          <StatCard 
            icon={<FiUsers className="text-purple-500" size={18} />}
            title="Participants"
            value={stats.totalParticipants}
            loading={loading.quizzes}
          />
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6 overflow-hidden">
          <div className="flex overflow-x-auto scrollbar-hide">
            {[
              { id: 'create', label: 'Create Quiz', icon: <FiPlus size={16} /> },
              { id: 'manage', label: 'Manage Quizzes', icon: <FiList size={16} /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 sm:px-6 py-3 sm:py-4 font-medium text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap flex-shrink-0 border-b-2 transition-colors ${
                  activeTab === tab.id 
                    ? 'text-blue-600 border-blue-600 bg-blue-50' 
                    : 'text-gray-500 hover:text-gray-700 border-transparent'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`p-3 sm:p-4 rounded-md mb-4 sm:mb-6 ${
                notification.type === 'error' 
                  ? 'bg-red-50 text-red-700' 
                  : 'bg-green-50 text-green-700'
              }`}
            >
              {notification.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create Quiz Tab */}
        {activeTab === 'create' && (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                {editingQuiz ? <FiEdit2 className="text-blue-500" /> : <FiPlus className="text-green-500" />}
                {editingQuiz ? 'Edit Quiz' : 'Create New Quiz'}
              </h2>
              {editingQuiz && (
                <p className="text-sm text-gray-600 mt-1">
                  Editing: {editingQuiz.title}
                </p>
              )}
            </div>

            <div className="p-4 sm:p-6">
              <form onSubmit={editingQuiz ? (e) => {
                e.preventDefault();
                handleUpdateQuiz(editingQuiz.id, formData);
              } : handleCreateQuiz} className="space-y-4 sm:space-y-6">
                
                {/* Basic Information */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quiz Title *
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      placeholder="Enter quiz title"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Time Limit (minutes) *
                    </label>
                    <input
                      type="number"
                      name="timeLimit"
                      value={formData.timeLimit}
                      onChange={handleInputChange}
                      min="1"
                      max="300"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Enter quiz description"
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Questions to Render
                    </label>
                    <input
                      type="number"
                      name="questionsToRender"
                      value={formData.questionsToRender}
                      onChange={handleInputChange}
                      placeholder="Leave empty to render all"
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="draft">Draft</option>
                      <option value="approved">Approved</option>
                    </select>
                  </div>
                </div>

                {/* Questions Section */}
                <div className="border-t pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <h3 className="text-lg font-medium text-gray-800">
                      Questions ({formData.questions.length})
                    </h3>
                  </div>
                  
                  <QuestionEditor 
                    questions={formData.questions}
                    addQuestion={addQuestion}
                    updateQuestion={updateQuestion}
                    removeQuestion={removeQuestion}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t">
                  {editingQuiz && (
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading.action || formData.questions.length === 0}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
                  >
                    {loading.action ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        {editingQuiz ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      <>
                        <FiSave size={16} />
                        {editingQuiz ? 'Update Quiz' : 'Create Quiz'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Manage Quizzes Tab */}
        {activeTab === 'manage' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Quiz List */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <FiList className="text-blue-500" />
                  My Quizzes ({quizzes.length})
                </h2>
              </div>

              {loading.quizzes ? (
                <div className="p-6 sm:p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-600 text-sm">Loading quizzes...</p>
                </div>
              ) : quizzes.length === 0 ? (
                <div className="p-6 sm:p-8 text-center">
                  <FiBook className="mx-auto text-4xl text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No Quizzes Yet</h3>
                  <p className="text-gray-500 text-sm mb-4">Create your first quiz to get started!</p>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm"
                  >
                    Create Quiz
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {quizzes.map((quiz) => (
                    <div key={quiz.id} className="p-4 sm:p-6 hover:bg-gray-50">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900 truncate">{quiz.title}</h3>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                quiz.status === 'approved' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {quiz.status}
                              </span>
                              <span className="text-xs text-gray-500">
                                {quiz.timeLimit} min
                              </span>
                              <span className="text-xs text-gray-500">
                                {quiz.questions?.length || 0} questions
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                            {quiz.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Created: {quiz.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}</span>
                            {quiz.updatedAt && (
                              <span>Updated: {quiz.updatedAt?.toDate?.()?.toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => startEditingQuiz(quiz)}
                            className="flex items-center justify-center gap-1 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md text-xs sm:text-sm"
                          >
                            <FiEdit2 size={14} />
                            <span className="hidden sm:inline">Edit</span>
                          </button>
                          
                          <button
                            onClick={() => {
                              setSelectedQuiz(quiz.id);
                              setShowResults(true);
                            }}
                            className="flex items-center justify-center gap-1 px-3 py-2 text-green-600 hover:bg-green-50 rounded-md text-xs sm:text-sm"
                          >
                            <FiEye size={14} />
                            <span className="hidden sm:inline">Results</span>
                          </button>

                          <button
                            onClick={() => handleDeleteQuiz(quiz.id)}
                            className="flex items-center justify-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-md text-xs sm:text-sm"
                          >
                            <FiTrash2 size={14} />
                            <span className="hidden sm:inline">Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bulk Upload Codes */}
            {selectedQuiz && (
              <div className="bg-white rounded-lg shadow-sm">
                <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <FiUpload className="text-green-500" />
                    Upload Access Codes
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Selected Quiz: {quizzes.find(q => q.id === selectedQuiz)?.title}
                  </p>
                </div>

                <div className="p-4 sm:p-6">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Access Codes (one per line)
                    </label>
                    <textarea
                      value={bulkCodes}
                      onChange={(e) => setBulkCodes(e.target.value)}
                      placeholder="Enter access codes, one per line..."
                      rows="4"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleBulkUploadCodes}
                      disabled={loading.action || !bulkCodes.trim()}
                      className="flex-1 sm:flex-none bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                    >
                      {loading.action ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <FiUpload size={16} />
                          Upload Codes
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setSelectedQuiz(null);
                        setBulkCodes('');
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Results Section */}
            {showResults && selectedQuiz && (
              <div className="bg-white rounded-lg shadow-sm">
                <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <FiBarChart2 className="text-blue-500" />
                        Quiz Results
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {quizzes.find(q => q.id === selectedQuiz)?.title}
                      </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-2">
                      {results.length > 0 && (
                        <CSVLink
                          data={results}
                          filename={`quiz-results-${selectedQuiz}.csv`}
                          className="bg-green-600 text-white px-3 py-2 rounded-md hover:bg-green-700 text-xs sm:text-sm flex items-center justify-center gap-1"
                        >
                          <FiDownload size={14} />
                          <span className="hidden sm:inline">Export CSV</span>
                        </CSVLink>
                      )}
                      
                      <button
                        onClick={() => clearResults(selectedQuiz)}
                        disabled={loading.action}
                        className="bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 text-xs sm:text-sm flex items-center justify-center gap-1"
                      >
                        <FiTrash2 size={14} />
                        <span className="hidden sm:inline">Clear Results</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowResults(false);
                          setSelectedQuiz(null);
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-xs sm:text-sm"
                      >
                        <FiX size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  {loading.results ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                      <p className="text-gray-600 text-sm">Loading results...</p>
                    </div>
                  ) : results.length === 0 ? (
                    <div className="text-center py-8">
                      <FiBarChart2 className="mx-auto text-4xl text-gray-400 mb-4" />
                      <h4 className="text-lg font-medium text-gray-700 mb-2">No Results Yet</h4>
                      <p className="text-gray-500 text-sm">Students haven't taken this quiz yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Student
                            </th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Score
                            </th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Percentage
                            </th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Time
                            </th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Date
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {results.map((result, index) => (
                            <tr key={result.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {result.fullName}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {result.regNumber}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {result.score}/{result.total}
                              </td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-1 max-w-16 sm:max-w-20">
                                    <div className={`h-2 rounded-full mr-2 ${
                                      result.percentage >= 70 ? 'bg-green-200' :
                                      result.percentage >= 50 ? 'bg-yellow-200' : 'bg-red-200'
                                    }`}>
                                      <div 
                                        className={`h-2 rounded-full ${
                                          result.percentage >= 70 ? 'bg-green-500' :
                                          result.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}
                                        style={{ width: `${Math.min(result.percentage, 100)}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                  <span className="text-sm font-medium text-gray-900 ml-2">
                                    {result.percentage}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {Math.floor(result.timeSpent / 60)}m {result.timeSpent % 60}s
                              </td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {result.timestamp}
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
          </div>
        )}
      </main>
    </div>
  );
};

// StatCard Component
const StatCard = ({ icon, title, value, loading }) => (
  <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 border border-gray-200">
    <div className="flex items-center justify-between">
      <div className="min-w-0">
        <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{title}</p>
        {loading ? (
          <div className="h-6 sm:h-8 bg-gray-200 rounded animate-pulse mt-1"></div>
        ) : (
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{value}</p>
        )}
      </div>
      <div className="flex-shrink-0">
        {icon}
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
