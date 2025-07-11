// src/pages/SuperAdminDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase/firebaseConfig';
import { doc, getDoc, getDocs, collection, updateDoc } from 'firebase/firestore';
import { 
  FiShield, 
  FiUsers, 
  FiBarChart2, 
  FiActivity, 
  FiAlertTriangle,
  FiDownload,
  FiRefreshCw,
  FiSettings,
  FiLogOut,
  FiTrendingUp,
  FiClock,
  FiHeart,
  FiZap,
  FiGlobe,
  FiFilter,
  FiEye,
  FiEdit2,
  FiTrash2,
  FiCheckCircle,
  FiXCircle,
  FiAward,
  FiDatabase,
  FiMonitor,
  FiWifi,
  FiServer
} from 'react-icons/fi';
import {
  fetchPlatformStats,
  fetchUserActivityLogs,
  fetchSystemAlerts,
  fetchDepartmentAnalytics,
  createSystemBackup,
  subscribeToRealTimeUpdates,
  updateUserRole,
  deleteUser,
  updateQuizStatus,
  deleteQuizGlobally,
  TIME_FRAMES,
  HEALTH_METRICS
} from '../utils/superAdminService';
import { generateGlobalLeaderboard, generateDepartmentLeaderboard } from '../utils/leaderboardService';
import { useTheme } from '../contexts/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

export default function SuperAdminDashboard() {
  const [superAdmin, setSuperAdmin] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState({
    admin: true,
    stats: false,
    logs: false,
    alerts: false,
    departments: false,
    backup: false
  });
  
  // Data states
  const [platformStats, setPlatformStats] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [departmentAnalytics, setDepartmentAnalytics] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [allQuizzes, setAllQuizzes] = useState([]);
  
  // UI states
  const [selectedTimeFrame, setSelectedTimeFrame] = useState(TIME_FRAMES.LAST_24_HOURS);
  const [realTimeActive, setRealTimeActive] = useState(false);
  const [notification, setNotification] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  
  // Leaderboard states
  const [globalLeaderboard, setGlobalLeaderboard] = useState(null);
  const [deptLeaderboards, setDeptLeaderboards] = useState({});
  const [departments, setDepartments] = useState([]);
  const [loadingLeaderboards, setLoadingLeaderboards] = useState(false);

  const navigate = useNavigate();
  const { isDark } = useTheme();

  // Verify super admin access
  useEffect(() => {
    const checkSuperAdminAccess = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          navigate('/login');
          return;
        }

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists() || userDoc.data().role !== 'superadmin') {
          navigate('/login');
          return;
        }

        setSuperAdmin({ uid: user.uid, ...userDoc.data() });
      } catch (error) {
        console.error('Error checking super admin access:', error);
        navigate('/login');
      } finally {
        setLoading(prev => ({ ...prev, admin: false }));
      }
    };

    checkSuperAdminAccess();
  }, [navigate]);

  // Load platform statistics
  const loadPlatformStats = useCallback(async () => {
    setLoading(prev => ({ ...prev, stats: true }));
    try {
      const stats = await fetchPlatformStats(selectedTimeFrame);
      setPlatformStats(stats);
      console.log('📊 Platform stats loaded:', stats);
    } catch (error) {
      showNotification('Failed to load platform statistics', 'error');
    } finally {
      setLoading(prev => ({ ...prev, stats: false }));
    }
  }, [selectedTimeFrame]);

  // Load activity logs
  const loadActivityLogs = useCallback(async () => {
    setLoading(prev => ({ ...prev, logs: true }));
    try {
      const logs = await fetchUserActivityLogs(50);
      setActivityLogs(logs);
    } catch (error) {
      showNotification('Failed to load activity logs', 'error');
    } finally {
      setLoading(prev => ({ ...prev, logs: false }));
    }
  }, []);

  // Load system alerts
  const loadSystemAlerts = useCallback(async () => {
    setLoading(prev => ({ ...prev, alerts: true }));
    try {
      const alerts = await fetchSystemAlerts();
      setSystemAlerts(alerts);
    } catch (error) {
      showNotification('Failed to load system alerts', 'error');
    } finally {
      setLoading(prev => ({ ...prev, alerts: false }));
    }
  }, []);

  // Load department analytics
  const loadDepartmentAnalytics = useCallback(async () => {
    setLoading(prev => ({ ...prev, departments: true }));
    try {
      const analytics = await fetchDepartmentAnalytics();
      setDepartmentAnalytics(analytics);
    } catch (error) {
      showNotification('Failed to load department analytics', 'error');
    } finally {
      setLoading(prev => ({ ...prev, departments: false }));
    }
  }, []);

  // Load all users and quizzes for management
  const loadUsersAndQuizzes = useCallback(async () => {
    try {
      const [usersSnapshot, quizzesSnapshot] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'quizzes'))
      ]);

      const users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const quizzes = quizzesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setAllUsers(users);
      setAllQuizzes(quizzes);
      
      // Extract unique departments
      const uniqueDepartments = [...new Set(quizzes.map(q => q.department).filter(Boolean))];
      setDepartments(uniqueDepartments);
    } catch (error) {
      showNotification('Failed to load users and quizzes', 'error');
    }
  }, []);

  // Load leaderboard data
  const loadLeaderboardData = useCallback(async () => {
    if (departments.length === 0) return;
    
    setLoadingLeaderboards(true);
    try {
      // Load global leaderboard
      const global = await generateGlobalLeaderboard();
      setGlobalLeaderboard(global);
      
      // Load department leaderboards
      const deptBoards = {};
      for (const dept of departments) {
        const deptBoard = await generateDepartmentLeaderboard(dept);
        deptBoards[dept] = deptBoard;
      }
      setDeptLeaderboards(deptBoards);
      
    } catch (error) {
      console.error('Error loading leaderboard data:', error);
      showNotification('Failed to load leaderboard data', 'error');
    } finally {
      setLoadingLeaderboards(false);
    }
  }, [departments]);

  // Load all data when tab changes or component mounts
  useEffect(() => {
    if (!superAdmin) return;

    loadPlatformStats();
    loadActivityLogs();
    loadSystemAlerts();
    loadDepartmentAnalytics();
    loadUsersAndQuizzes();
  }, [superAdmin, loadPlatformStats, loadActivityLogs, loadSystemAlerts, loadDepartmentAnalytics, loadUsersAndQuizzes]);

  // Load leaderboard data when leaderboard tab is active
  useEffect(() => {
    if (activeTab === 'leaderboard' && departments.length > 0) {
      loadLeaderboardData();
    }
  }, [activeTab, departments, loadLeaderboardData]);

  // Set up real-time updates
  useEffect(() => {
    if (!realTimeActive) return;

    const unsubscribe = subscribeToRealTimeUpdates((update) => {
      console.log('🔴 Real-time update:', update);
      setLastUpdated(new Date());
      
      // Refresh relevant data based on update type
      if (update.type === 'users_updated') {
        loadUsersAndQuizzes();
      } else if (update.type === 'quizzes_updated') {
        loadUsersAndQuizzes();
        loadPlatformStats();
      }
    });

    return unsubscribe;
  }, [realTimeActive, loadUsersAndQuizzes, loadPlatformStats]);

  // Notification system
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // System backup function
  const handleSystemBackup = async () => {
    setLoading(prev => ({ ...prev, backup: true }));
    try {
      const backupData = await createSystemBackup();
      
      // Download backup as JSON file
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `looma-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showNotification('System backup created and downloaded successfully!');
    } catch (error) {
      showNotification(`Backup failed: ${error.message}`, 'error');
    } finally {
      setLoading(prev => ({ ...prev, backup: false }));
    }
  };

  // User management functions
  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole);
      showNotification(`User role updated to ${newRole}`);
      loadUsersAndQuizzes();
    } catch (error) {
      showNotification(`Failed to update user role: ${error.message}`, 'error');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    
    try {
      await deleteUser(userId);
      showNotification('User deleted successfully');
      loadUsersAndQuizzes();
    } catch (error) {
      showNotification(`Failed to delete user: ${error.message}`, 'error');
    }
  };

  // Quiz management functions
  const handleUpdateQuizStatus = async (quizId, newStatus) => {
    try {
      await updateQuizStatus(quizId, newStatus);
      showNotification(`Quiz status updated to ${newStatus}`);
      loadUsersAndQuizzes();
      loadPlatformStats();
    } catch (error) {
      showNotification(`Failed to update quiz status: ${error.message}`, 'error');
    }
  };

  const handleDeleteQuiz = async (quizId) => {
    if (!window.confirm('Are you sure you want to delete this quiz globally? This will remove all associated data.')) return;
    
    try {
      await deleteQuizGlobally(quizId);
      showNotification('Quiz deleted successfully');
      loadUsersAndQuizzes();
      loadPlatformStats();
    } catch (error) {
      showNotification(`Failed to delete quiz: ${error.message}`, 'error');
    }
  };

  // Logout function
  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  // Refresh all data
  const refreshAllData = async () => {
    await Promise.all([
      loadPlatformStats(),
      loadActivityLogs(),
      loadSystemAlerts(),
      loadDepartmentAnalytics(),
      loadUsersAndQuizzes()
    ]);
    setLastUpdated(new Date());
    showNotification('All data refreshed successfully');
  };

  if (loading.admin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying SuperAdmin access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-soft sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                <FiShield className="text-red-600 dark:text-red-400" />
                SuperAdmin Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Global platform management and analytics
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <ThemeToggle />
              
              {/* Real-time indicator */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRealTimeActive(!realTimeActive)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    realTimeActive 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${realTimeActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400 dark:bg-gray-500'}`} />
                  {realTimeActive ? 'Live' : 'Offline'}
                </button>
                
                <button
                  onClick={refreshAllData}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 text-sm font-medium"
                >
                  <FiRefreshCw size={16} />
                  Refresh
                </button>
              </div>

              <span className="text-sm text-gray-500 dark:text-gray-400">
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium"
              >
                <FiLogOut /> Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-4 z-50"
          >
            <div className={`p-4 rounded-lg shadow-lg ${
              notification.type === 'error' 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {notification.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 shadow-soft">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex overflow-x-auto">
            {[
              { id: 'overview', label: 'System Overview', icon: <FiMonitor /> },
              { id: 'analytics', label: 'Analytics', icon: <FiBarChart2 /> },
              { id: 'users', label: 'User Management', icon: <FiUsers /> },
              { id: 'quizzes', label: 'Quiz Management', icon: <FiSettings /> },
              { id: 'departments', label: 'Departments', icon: <FiGlobe /> },
              { id: 'logs', label: 'Activity Logs', icon: <FiActivity /> },
              { id: 'maintenance', label: 'Maintenance', icon: <FiDatabase /> },
              { id: 'leaderboard', label: 'Leaderboard', icon: <FiAward /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 font-medium text-sm flex items-center gap-2 whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id 
                    ? 'text-primary-600 dark:text-primary-400 border-primary-600 dark:border-primary-400' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border-transparent'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* System Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* System Health */}
            {platformStats && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <FiHeart className="text-red-500" />
                    System Health
                  </h2>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedTimeFrame}
                      onChange={(e) => setSelectedTimeFrame(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                    >
                      <option value={TIME_FRAMES.LAST_HOUR}>Last Hour</option>
                      <option value={TIME_FRAMES.LAST_24_HOURS}>Last 24 Hours</option>
                      <option value={TIME_FRAMES.LAST_WEEK}>Last Week</option>
                      <option value={TIME_FRAMES.LAST_MONTH}>Last Month</option>
                      <option value={TIME_FRAMES.ALL_TIME}>All Time</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className={`text-4xl font-bold mb-2 ${
                      platformStats.health.status.color === 'green' ? 'text-green-600' :
                      platformStats.health.status.color === 'blue' ? 'text-blue-600' :
                      platformStats.health.status.color === 'yellow' ? 'text-yellow-600' :
                      platformStats.health.status.color === 'orange' ? 'text-orange-600' :
                      'text-red-600'
                    }`}>
                      {platformStats.health.score}%
                    </div>
                    <div className="text-sm text-gray-600">Overall Health</div>
                  </div>

                  <div className="text-center">
                    <div className="text-4xl font-bold text-blue-600 mb-2">{platformStats.users.total}</div>
                    <div className="text-sm text-gray-600">Total Users</div>
                  </div>

                  <div className="text-center">
                    <div className="text-4xl font-bold text-green-600 mb-2">{platformStats.quizzes.total}</div>
                    <div className="text-sm text-gray-600">Total Quizzes</div>
                  </div>

                  <div className="text-center">
                    <div className="text-4xl font-bold text-purple-600 mb-2">{platformStats.submissions.total}</div>
                    <div className="text-sm text-gray-600">Total Submissions</div>
                  </div>
                </div>

                {/* Health Factors */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(platformStats.health.factors).map(([factor, score]) => (
                    <div key={factor} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {factor.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span className="text-sm font-bold text-gray-900">{Math.round(score)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            score >= 80 ? 'bg-green-500' :
                            score >= 60 ? 'bg-blue-500' :
                            score >= 40 ? 'bg-yellow-500' :
                            score >= 20 ? 'bg-orange-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(score, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Alerts */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FiAlertTriangle className="text-yellow-500" />
                System Alerts ({systemAlerts.length})
              </h2>
              {systemAlerts.length > 0 ? (
                <div className="space-y-3">
                  {systemAlerts.slice(0, 5).map(alert => (
                    <div key={alert.id} className={`p-3 rounded-lg border-l-4 ${
                      alert.severity === 'high' ? 'bg-red-50 border-red-500' :
                      alert.severity === 'medium' ? 'bg-yellow-50 border-yellow-500' :
                      'bg-blue-50 border-blue-500'
                    }`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900 flex items-center gap-2">
                            <span>{alert.icon}</span>
                            {alert.title}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">{alert.message}</div>
                        </div>
                        <span className="text-xs text-gray-500">{alert.timestamp.toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-4">
                  <FiCheckCircle className="mx-auto text-4xl mb-2 text-green-500" />
                  <p>No system alerts - everything is running smoothly!</p>
                </div>
              )}
            </div>

            {/* Quick Stats Grid */}
            {platformStats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">User Distribution</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Students</span>
                      <span className="font-semibold">{platformStats.users.byRole.students?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Admins</span>
                      <span className="font-semibold">{platformStats.users.byRole.admins?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">SuperAdmins</span>
                      <span className="font-semibold">{platformStats.users.byRole.superAdmins?.length || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Quiz Status</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Approved</span>
                      <span className="font-semibold text-green-600">{platformStats.quizzes.byStatus.approved?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Pending</span>
                      <span className="font-semibold text-yellow-600">{platformStats.quizzes.byStatus.pending?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Draft</span>
                      <span className="font-semibold text-gray-600">{platformStats.quizzes.byStatus.draft?.length || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Activity Metrics</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Avg per Quiz</span>
                      <span className="font-semibold">{platformStats.submissions.averagePerQuiz}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Avg per User</span>
                      <span className="font-semibold">{platformStats.submissions.averagePerUser}</span>
                    </div>
                    {platformStats.submissions.recent !== null && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Recent Activity</span>
                        <span className="font-semibold text-blue-600">{platformStats.submissions.recent}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-6">Platform Analytics</h2>
              
              {platformStats ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Department Distribution */}
                  <div>
                    <h3 className="font-medium text-gray-800 mb-4">Users by Department</h3>
                    <div className="space-y-3">
                      {Object.entries(platformStats.users.byDepartment).map(([dept, count]) => (
                        <div key={dept} className="flex justify-between items-center">
                          <span className="text-gray-600">{dept}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${(count / platformStats.users.total) * 100}%` }}
                              />
                            </div>
                            <span className="font-semibold w-8 text-right">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quiz Distribution */}
                  <div>
                    <h3 className="font-medium text-gray-800 mb-4">Quizzes by Department</h3>
                    <div className="space-y-3">
                      {Object.entries(platformStats.quizzes.byDepartment).map(([dept, count]) => (
                        <div key={dept} className="flex justify-between items-center">
                          <span className="text-gray-600">{dept}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${(count / platformStats.quizzes.total) * 100}%` }}
                              />
                            </div>
                            <span className="font-semibold w-8 text-right">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Submission Distribution */}
                  <div>
                    <h3 className="font-medium text-gray-800 mb-4">Submissions by Department</h3>
                    <div className="space-y-3">
                      {Object.entries(platformStats.submissions.byDepartment).map(([dept, count]) => (
                        <div key={dept} className="flex justify-between items-center">
                          <span className="text-gray-600">{dept}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${(count / platformStats.submissions.total) * 100}%` }}
                              />
                            </div>
                            <span className="font-semibold w-8 text-right">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Performance Trends */}
                  <div>
                    <h3 className="font-medium text-gray-800 mb-4">System Performance</h3>
                    <div className="space-y-4">
                      <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700">System Health</span>
                          <span className={`font-bold ${
                            platformStats.health.status.color === 'green' ? 'text-green-600' :
                            platformStats.health.status.color === 'blue' ? 'text-blue-600' :
                            platformStats.health.status.color === 'yellow' ? 'text-yellow-600' :
                            platformStats.health.status.color === 'orange' ? 'text-orange-600' :
                            'text-red-600'
                          }`}>
                            {platformStats.health.status.label}
                          </span>
                        </div>
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                              className={`h-3 rounded-full transition-all duration-500 ${
                                platformStats.health.status.color === 'green' ? 'bg-green-500' :
                                platformStats.health.status.color === 'blue' ? 'bg-blue-500' :
                                platformStats.health.status.color === 'yellow' ? 'bg-yellow-500' :
                                platformStats.health.status.color === 'orange' ? 'bg-orange-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${platformStats.health.score}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-soft p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <FiAward className="text-yellow-500" />
                  Global Leaderboard Management
                </h2>
                <button
                  onClick={() => navigate('/leaderboard')}
                  className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  View Full Leaderboard
                </button>
              </div>
              
              {/* Department Leaderboards */}
              <div className="mb-6">
                <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-4">Department Rankings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {departments.map(dept => (
                    <div key={dept} className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">{dept}</h4>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {deptLeaderboards[dept]?.users?.length || 0} Students
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {deptLeaderboards[dept]?.users?.length > 0 
                          ? `Top: ${deptLeaderboards[dept].users[0]?.fullName || 'N/A'} (${deptLeaderboards[dept].users[0]?.averagePercentage || 0}%)`
                          : 'No data available'
                        }
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Global Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Total Participants</h3>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {globalLeaderboard?.totalParticipants || 0}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Across all departments</p>
                </div>
                
                <div className="p-4 bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 rounded-lg border border-green-200 dark:border-green-700">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Top Performer</h3>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    {globalLeaderboard?.users?.[0]?.fullName || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {globalLeaderboard?.users?.[0]?.averagePercentage || 0}% • {globalLeaderboard?.users?.[0]?.department || 'N/A'}
                  </p>
                </div>
                
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Active Departments</h3>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {departments.length}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">With active participants</p>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-center text-gray-600 dark:text-gray-300">
                  🏆 Advanced leaderboard features include departmental rankings, global competition, streak tracking, and performance analytics.
                  <br />
                  <span className="text-sm text-gray-500 dark:text-gray-400">Click "View Full Leaderboard" to access the complete ranking system.</span>
                </p>
              </div>
            </div>
          </div>
        )}

                 {/* User Management Tab */}
         {activeTab === 'users' && (
           <div className="space-y-6">
             <div className="bg-white rounded-lg shadow-sm overflow-hidden">
               <div className="p-6 border-b border-gray-200">
                 <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                   <FiUsers className="text-blue-500" />
                   User Management ({allUsers.length} users)
                 </h2>
               </div>
               
               <div className="overflow-x-auto">
                 <table className="min-w-full divide-y divide-gray-200">
                   <thead className="bg-gray-50">
                     <tr>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="bg-white divide-y divide-gray-200">
                     {allUsers.slice(0, 20).map(user => (
                       <tr key={user.id} className="hover:bg-gray-50">
                         <td className="px-6 py-4 whitespace-nowrap">
                           <div>
                             <div className="text-sm font-medium text-gray-900">{user.fullName || 'N/A'}</div>
                             <div className="text-sm text-gray-500">{user.email}</div>
                             <div className="text-xs text-gray-400">{user.regNumber || 'No reg number'}</div>
                           </div>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                           {user.department || 'N/A'}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap">
                           <select
                             value={user.role || 'student'}
                             onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                             className="text-sm border border-gray-300 rounded px-2 py-1"
                           >
                             <option value="student">Student</option>
                             <option value="admin">Admin</option>
                             <option value="superadmin">SuperAdmin</option>
                           </select>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                           {user.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                           <div className="flex items-center gap-2">
                             <button
                               onClick={() => setSelectedUser(user)}
                               className="text-blue-600 hover:text-blue-900 p-1"
                               title="View Details"
                             >
                               <FiEye size={16} />
                             </button>
                             <button
                               onClick={() => handleDeleteUser(user.id)}
                               className="text-red-600 hover:text-red-900 p-1"
                               title="Delete User"
                             >
                               <FiTrash2 size={16} />
                             </button>
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
               
               {allUsers.length > 20 && (
                 <div className="p-4 text-center text-gray-500 border-t">
                   Showing first 20 of {allUsers.length} users
                 </div>
               )}
             </div>
           </div>
         )}

         {/* Quiz Management Tab */}
         {activeTab === 'quizzes' && (
           <div className="space-y-6">
             <div className="bg-white rounded-lg shadow-sm overflow-hidden">
               <div className="p-6 border-b border-gray-200">
                 <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                   <FiSettings className="text-green-500" />
                   Quiz Management ({allQuizzes.length} quizzes)
                 </h2>
               </div>
               
               <div className="overflow-x-auto">
                 <table className="min-w-full divide-y divide-gray-200">
                   <thead className="bg-gray-50">
                     <tr>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quiz</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="bg-white divide-y divide-gray-200">
                     {allQuizzes.slice(0, 20).map(quiz => (
                       <tr key={quiz.id} className="hover:bg-gray-50">
                         <td className="px-6 py-4 whitespace-nowrap">
                           <div>
                             <div className="text-sm font-medium text-gray-900">{quiz.title}</div>
                             <div className="text-sm text-gray-500">{quiz.description?.substring(0, 60)}...</div>
                             <div className="text-xs text-gray-400">{quiz.questions?.length || 0} questions</div>
                           </div>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                           {quiz.department}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap">
                           <select
                             value={quiz.status}
                             onChange={(e) => handleUpdateQuizStatus(quiz.id, e.target.value)}
                             className={`text-sm border rounded px-2 py-1 ${
                               quiz.status === 'approved' ? 'border-green-300 bg-green-50' :
                               quiz.status === 'pending' ? 'border-yellow-300 bg-yellow-50' :
                               'border-gray-300 bg-gray-50'
                             }`}
                           >
                             <option value="draft">Draft</option>
                             <option value="pending">Pending</option>
                             <option value="approved">Approved</option>
                           </select>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                           {quiz.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                           <div className="flex items-center gap-2">
                             <button
                               onClick={() => setSelectedQuiz(quiz)}
                               className="text-blue-600 hover:text-blue-900 p-1"
                               title="View Details"
                             >
                               <FiEye size={16} />
                             </button>
                             <button
                               onClick={() => handleDeleteQuiz(quiz.id)}
                               className="text-red-600 hover:text-red-900 p-1"
                               title="Delete Quiz"
                             >
                               <FiTrash2 size={16} />
                             </button>
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
               
               {allQuizzes.length > 20 && (
                 <div className="p-4 text-center text-gray-500 border-t">
                   Showing first 20 of {allQuizzes.length} quizzes
                 </div>
               )}
             </div>
           </div>
         )}

         {/* Activity Logs Tab */}
         {activeTab === 'logs' && (
           <div className="space-y-6">
             <div className="bg-white rounded-lg shadow-sm p-6">
               <div className="flex items-center justify-between mb-6">
                 <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                   <FiActivity className="text-purple-500" />
                   Activity Logs ({activityLogs.length} recent activities)
                 </h2>
                 <button
                   onClick={loadActivityLogs}
                   className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 text-sm"
                 >
                   <FiRefreshCw size={16} />
                   Refresh Logs
                 </button>
               </div>
               
               {loading.logs ? (
                 <div className="flex justify-center py-8">
                   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                 </div>
               ) : activityLogs.length > 0 ? (
                 <div className="space-y-3 max-h-96 overflow-y-auto">
                   {activityLogs.map(log => (
                     <div key={log.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                       <div className="flex justify-between items-start">
                         <div className="flex-1">
                           <div className="flex items-center gap-2 mb-2">
                             <span className="text-lg">{log.icon}</span>
                             <span className="font-medium text-gray-900">{log.action}</span>
                             <span className={`px-2 py-1 rounded-full text-xs ${
                               log.severity === 'info' ? 'bg-blue-100 text-blue-800' :
                               log.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                               'bg-red-100 text-red-800'
                             }`}>
                               {log.severity}
                             </span>
                           </div>
                           <div className="text-sm text-gray-600 mb-2">
                             <strong>{log.user.name}</strong> ({log.user.regNumber}) - {log.user.department}
                           </div>
                           <div className="text-sm text-gray-500">
                             Quiz: <strong>{log.quiz.title}</strong> ({log.quiz.department})
                           </div>
                           {log.details && (
                             <div className="text-xs text-gray-400 mt-1">
                               Score: {log.details.score}/{log.details.total} ({log.details.percentage}%) 
                               • Time: {Math.round((log.details.timeSpent || 0) / 60)} mins
                             </div>
                           )}
                         </div>
                         <div className="text-xs text-gray-500 ml-4">
                           {log.timestamp.toLocaleString()}
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="text-center text-gray-500 py-8">
                   <FiActivity className="mx-auto text-4xl mb-4 opacity-50" />
                   <p>No activity logs found</p>
                 </div>
               )}
             </div>
           </div>
         )}

         {/* Departments Tab */}
         {activeTab === 'departments' && (
           <div className="space-y-6">
             <div className="bg-white rounded-lg shadow-sm p-6">
               <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                 <FiGlobe className="text-indigo-500" />
                 Department Analytics
               </h2>
               
               {loading.departments ? (
                 <div className="flex justify-center py-8">
                   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                 </div>
               ) : departmentAnalytics.length > 0 ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {departmentAnalytics.map(dept => (
                     <div key={dept.name} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                       <div className="flex justify-between items-start mb-4">
                         <h3 className="font-semibold text-gray-900">{dept.name}</h3>
                         <span className={`text-xs px-2 py-1 rounded-full ${
                           dept.healthScore >= 80 ? 'bg-green-100 text-green-800' :
                           dept.healthScore >= 60 ? 'bg-blue-100 text-blue-800' :
                           dept.healthScore >= 40 ? 'bg-yellow-100 text-yellow-800' :
                           'bg-red-100 text-red-800'
                         }`}>
                           {Math.round(dept.healthScore)}% Health
                         </span>
                       </div>
                       
                       <div className="space-y-3">
                         <div className="flex justify-between">
                           <span className="text-gray-600">Total Users</span>
                           <span className="font-semibold">{dept.users.total}</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-600">Students</span>
                           <span className="font-semibold text-blue-600">{dept.users.students}</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-600">Admins</span>
                           <span className="font-semibold text-green-600">{dept.users.admins}</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-600">Quizzes</span>
                           <span className="font-semibold">{dept.quizzes.total}</span>
                         </div>
                         <div className="flex justify-between">
                           <span className="text-gray-600">Submissions</span>
                           <span className="font-semibold text-purple-600">{dept.submissions.total}</span>
                         </div>
                         {dept.submissions.averageScore > 0 && (
                           <div className="flex justify-between">
                             <span className="text-gray-600">Avg Score</span>
                             <span className="font-semibold text-orange-600">{Math.round(dept.submissions.averageScore)}%</span>
                           </div>
                         )}
                       </div>
                       
                       <div className="mt-4 pt-4 border-t border-gray-200">
                         <div className="w-full bg-gray-200 rounded-full h-2">
                           <div 
                             className={`h-2 rounded-full transition-all duration-300 ${
                               dept.healthScore >= 80 ? 'bg-green-500' :
                               dept.healthScore >= 60 ? 'bg-blue-500' :
                               dept.healthScore >= 40 ? 'bg-yellow-500' :
                               'bg-red-500'
                             }`}
                             style={{ width: `${dept.healthScore}%` }}
                           />
                         </div>
                         <div className="text-xs text-gray-500 mt-1">Department Health Score</div>
                       </div>
                     </div>
                   ))}
                 </div>
               ) : (
                 <div className="text-center text-gray-500 py-8">
                   <FiGlobe className="mx-auto text-4xl mb-4 opacity-50" />
                   <p>No department data available</p>
                 </div>
               )}
             </div>
           </div>
         )}

         {/* Maintenance Tab */}
         {activeTab === 'maintenance' && (
           <div className="space-y-6">
             <div className="bg-white rounded-lg shadow-sm p-6">
               <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                 <FiDatabase className="text-red-500" />
                 System Maintenance & Backup
               </h2>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Backup Section */}
                 <div className="border border-gray-200 rounded-lg p-6">
                   <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                     <FiDownload className="text-blue-500" />
                     System Backup
                   </h3>
                   <p className="text-gray-600 text-sm mb-4">
                     Create a complete backup of all platform data including users, quizzes, submissions, and access codes.
                   </p>
                   <button
                     onClick={handleSystemBackup}
                     disabled={loading.backup}
                     className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     {loading.backup ? (
                       <>
                         <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                         Creating Backup...
                       </>
                     ) : (
                       <>
                         <FiDownload /> Create & Download Backup
                       </>
                     )}
                   </button>
                 </div>

                 {/* System Status */}
                 <div className="border border-gray-200 rounded-lg p-6">
                   <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                     <FiServer className="text-green-500" />
                     System Status
                   </h3>
                   <div className="space-y-3">
                     <div className="flex justify-between items-center">
                       <span className="text-gray-600">Database</span>
                       <span className="flex items-center gap-2 text-green-600">
                         <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                         Online
                       </span>
                     </div>
                     <div className="flex justify-between items-center">
                       <span className="text-gray-600">Authentication</span>
                       <span className="flex items-center gap-2 text-green-600">
                         <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                         Active
                       </span>
                     </div>
                     <div className="flex justify-between items-center">
                       <span className="text-gray-600">Real-time Updates</span>
                       <span className={`flex items-center gap-2 ${realTimeActive ? 'text-green-600' : 'text-gray-500'}`}>
                         <div className={`w-2 h-2 rounded-full ${realTimeActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                         {realTimeActive ? 'Enabled' : 'Disabled'}
                       </span>
                     </div>
                   </div>
                 </div>

                 {/* Platform Stats */}
                 <div className="border border-gray-200 rounded-lg p-6">
                   <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                     <FiBarChart2 className="text-purple-500" />
                     Platform Metrics
                   </h3>
                   {platformStats && (
                     <div className="space-y-3">
                       <div className="flex justify-between">
                         <span className="text-gray-600">Data Generation</span>
                         <span className="text-sm text-gray-500">
                           {platformStats.generatedAt.toLocaleTimeString()}
                         </span>
                       </div>
                       <div className="flex justify-between">
                         <span className="text-gray-600">Health Score</span>
                         <span className={`font-semibold ${
                           platformStats.health.status.color === 'green' ? 'text-green-600' :
                           platformStats.health.status.color === 'blue' ? 'text-blue-600' :
                           platformStats.health.status.color === 'yellow' ? 'text-yellow-600' :
                           platformStats.health.status.color === 'orange' ? 'text-orange-600' :
                           'text-red-600'
                         }`}>
                           {platformStats.health.score}%
                         </span>
                       </div>
                       <div className="flex justify-between">
                         <span className="text-gray-600">Active Period</span>
                         <span className="text-sm text-gray-500">
                           {platformStats.timeFrame.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                         </span>
                       </div>
                     </div>
                   )}
                 </div>

                 {/* Quick Actions */}
                 <div className="border border-gray-200 rounded-lg p-6">
                   <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                     <FiZap className="text-yellow-500" />
                     Quick Actions
                   </h3>
                   <div className="space-y-3">
                     <button
                       onClick={refreshAllData}
                       className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm"
                     >
                       <FiRefreshCw size={16} />
                       Refresh All Data
                     </button>
                     <button
                       onClick={() => setRealTimeActive(!realTimeActive)}
                       className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-sm ${
                         realTimeActive 
                           ? 'bg-red-100 hover:bg-red-200 text-red-700' 
                           : 'bg-green-100 hover:bg-green-200 text-green-700'
                       }`}
                     >
                       <FiWifi size={16} />
                       {realTimeActive ? 'Disable' : 'Enable'} Real-time
                     </button>
                     <button
                       onClick={() => navigate('/leaderboard')}
                       className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm"
                     >
                       <FiAward size={16} />
                       View Leaderboard
                     </button>
                   </div>
                 </div>
               </div>
             </div>
           </div>
         )}
       </div>
     </div>
   );
 }
