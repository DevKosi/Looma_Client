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
  FiServer,
  FiBook
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

  const navigate = useNavigate();

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
    } catch (error) {
      showNotification('Failed to load users and quizzes', 'error');
    }
  }, []);

  // Load all data when tab changes or component mounts
  useEffect(() => {
    if (!superAdmin) return;

    loadPlatformStats();
    loadActivityLogs();
    loadSystemAlerts();
    loadDepartmentAnalytics();
    loadUsersAndQuizzes();
  }, [superAdmin, loadPlatformStats, loadActivityLogs, loadSystemAlerts, loadDepartmentAnalytics, loadUsersAndQuizzes]);

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
                <FiShield className="text-red-600" size={20} />
                <span className="hidden sm:inline">SuperAdmin Dashboard</span>
                <span className="sm:hidden">SuperAdmin</span>
              </h1>
              <p className="text-xs sm:text-base text-gray-600 mt-1">
                Global platform management and analytics
              </p>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Real-time indicator */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRealTimeActive(!realTimeActive)}
                  className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                    realTimeActive 
                      ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${realTimeActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                  <span className="hidden sm:inline">{realTimeActive ? 'Live' : 'Offline'}</span>
                </button>
                
                <button
                  onClick={refreshAllData}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 text-xs sm:text-sm font-medium"
                >
                  <FiRefreshCw size={14} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>

              <span className="text-xs sm:text-sm text-gray-500 hidden md:block">
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1 sm:gap-2 text-red-600 hover:text-red-700 text-xs sm:text-sm font-medium"
              >
                <FiLogOut size={14} /> 
                <span className="hidden sm:inline">Logout</span>
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
            className="fixed top-16 sm:top-20 right-4 z-50"
          >
            <div className={`p-3 sm:p-4 rounded-lg shadow-lg max-w-sm ${
              notification.type === 'error' 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              <p className="text-sm">{notification.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto scrollbar-hide">
            {[
              { id: 'overview', label: 'Overview', icon: <FiMonitor size={14} /> },
              { id: 'analytics', label: 'Analytics', icon: <FiBarChart2 size={14} /> },
              { id: 'users', label: 'Users', icon: <FiUsers size={14} /> },
              { id: 'quizzes', label: 'Quizzes', icon: <FiSettings size={14} /> },
              { id: 'departments', label: 'Departments', icon: <FiGlobe size={14} /> },
              { id: 'logs', label: 'Logs', icon: <FiActivity size={14} /> },
              { id: 'maintenance', label: 'Maintenance', icon: <FiDatabase size={14} /> },
              { id: 'leaderboard', label: 'Leaderboard', icon: <FiAward size={14} /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-4 py-3 font-medium text-xs sm:text-sm flex items-center gap-1 sm:gap-2 whitespace-nowrap flex-shrink-0 border-b-2 transition-colors ${
                  activeTab === tab.id 
                    ? 'text-blue-600 border-blue-600' 
                    : 'text-gray-500 hover:text-gray-700 border-transparent'
                }`}
              >
                {tab.icon} 
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* System Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4 sm:space-y-6">
            {/* System Health */}
            {platformStats && (
              <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0 mb-4 sm:mb-6">
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <FiHeart className="text-red-500" />
                    System Health
                  </h2>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedTimeFrame}
                      onChange={(e) => setSelectedTimeFrame(e.target.value)}
                      className="border border-gray-300 rounded-md px-2 sm:px-3 py-1 text-xs sm:text-sm"
                    >
                      <option value={TIME_FRAMES.LAST_HOUR}>Last Hour</option>
                      <option value={TIME_FRAMES.LAST_24_HOURS}>Last 24 Hours</option>
                      <option value={TIME_FRAMES.LAST_WEEK}>Last Week</option>
                      <option value={TIME_FRAMES.LAST_MONTH}>Last Month</option>
                      <option value={TIME_FRAMES.ALL_TIME}>All Time</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <div className="text-center">
                    <div className={`text-2xl sm:text-4xl font-bold mb-2 ${
                      platformStats.health.status.color === 'green' ? 'text-green-600' :
                      platformStats.health.status.color === 'blue' ? 'text-blue-600' :
                      platformStats.health.status.color === 'yellow' ? 'text-yellow-600' :
                      platformStats.health.status.color === 'orange' ? 'text-orange-600' :
                      'text-red-600'
                    }`}>
                      {platformStats.health.score}%
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600">Overall Health</div>
                  </div>

                  <div className="text-center">
                    <div className="text-2xl sm:text-4xl font-bold text-blue-600 mb-2">{platformStats.users.total}</div>
                    <div className="text-xs sm:text-sm text-gray-600">Total Users</div>
                  </div>

                  <div className="text-center">
                    <div className="text-2xl sm:text-4xl font-bold text-green-600 mb-2">{platformStats.quizzes.total}</div>
                    <div className="text-xs sm:text-sm text-gray-600">Total Quizzes</div>
                  </div>

                  <div className="text-center">
                    <div className="text-2xl sm:text-4xl font-bold text-purple-600 mb-2">{platformStats.submissions.total}</div>
                    <div className="text-xs sm:text-sm text-gray-600">Total Submissions</div>
                  </div>
                </div>

                {/* Health Factors */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {Object.entries(platformStats.health.factors).map(([factor, score]) => (
                    <div key={factor} className="bg-gray-50 rounded-lg p-3 sm:p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs sm:text-sm font-medium text-gray-700 capitalize">
                          {factor.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-gray-900">{Math.round(score)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            score >= 80 ? 'bg-green-500' :
                            score >= 60 ? 'bg-yellow-500' :
                            score >= 40 ? 'bg-orange-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(score, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Stats Grid */}
            {platformStats && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                <StatCard
                  title="Active Users"
                  value={platformStats.users.active}
                  icon={<FiUsers className="text-blue-500" size={16} />}
                  trend={platformStats.users.growth}
                />
                <StatCard
                  title="New Users"
                  value={platformStats.users.new}
                  icon={<FiTrendingUp className="text-green-500" size={16} />}
                  trend={platformStats.users.newGrowth}
                />
                <StatCard
                  title="Active Quizzes"
                  value={platformStats.quizzes.active}
                  icon={<FiCheckCircle className="text-green-500" size={16} />}
                />
                <StatCard
                  title="Pending"
                  value={platformStats.quizzes.pending}
                  icon={<FiClock className="text-yellow-500" size={16} />}
                />
                <StatCard
                  title="Today's Subs"
                  value={platformStats.submissions.today}
                  icon={<FiZap className="text-purple-500" size={16} />}
                />
                <StatCard
                  title="Avg Score"
                  value={`${platformStats.submissions.averageScore}%`}
                  icon={<FiAward className="text-orange-500" size={16} />}
                />
              </div>
            )}

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FiActivity className="text-green-500" />
                Recent Activity
              </h3>
              
              {activityLogs.length === 0 ? (
                <div className="text-center py-6 sm:py-8 text-gray-500">
                  <FiActivity className="mx-auto text-4xl mb-4 opacity-50" />
                  <p className="text-sm">No recent activity to display</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activityLogs.slice(0, 5).map((log, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`p-1 rounded-full ${
                        log.type === 'user' ? 'bg-blue-100' :
                        log.type === 'quiz' ? 'bg-green-100' :
                        log.type === 'system' ? 'bg-purple-100' : 'bg-gray-100'
                      }`}>
                        {log.type === 'user' ? <FiUsers size={12} /> :
                         log.type === 'quiz' ? <FiBook size={12} /> :
                         log.type === 'system' ? <FiSettings size={12} /> : <FiActivity size={12} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">{log.message}</p>
                        <p className="text-xs text-gray-500">{log.timestamp?.toLocaleString() || 'Unknown time'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* System Alerts */}
            {systemAlerts.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <FiAlertTriangle className="text-red-500" />
                  System Alerts ({systemAlerts.length})
                </h3>
                
                <div className="space-y-3">
                  {systemAlerts.map((alert, index) => (
                    <div key={index} className={`p-3 sm:p-4 rounded-lg border-l-4 ${
                      alert.severity === 'critical' ? 'bg-red-50 border-red-500' :
                      alert.severity === 'warning' ? 'bg-yellow-50 border-yellow-500' :
                      'bg-blue-50 border-blue-500'
                    }`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 text-sm">{alert.title}</h4>
                          <p className="text-xs sm:text-sm text-gray-600 mt-1">{alert.message}</p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                          alert.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {alert.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FiBarChart2 className="text-blue-500" />
                Platform Analytics
              </h2>
              
              {/* Department Analytics */}
              {departmentAnalytics.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Department
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Users
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quizzes
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Avg Score
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Activity
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {departmentAnalytics.map((dept, index) => (
                        <tr key={dept.name} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{dept.name}</div>
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {dept.totalUsers}
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {dept.totalQuizzes}
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-1 max-w-16 sm:max-w-20">
                                <div className="h-2 bg-gray-200 rounded-full mr-2">
                                  <div 
                                    className={`h-2 rounded-full ${
                                      dept.averageScore >= 70 ? 'bg-green-500' :
                                      dept.averageScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${Math.min(dept.averageScore, 100)}%` }}
                                  />
                                </div>
                              </div>
                              <span className="text-sm font-medium text-gray-900 ml-2">
                                {dept.averageScore}%
                              </span>
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              dept.activityLevel === 'high' ? 'bg-green-100 text-green-800' :
                              dept.activityLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {dept.activityLevel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 sm:py-8 text-gray-500">
                  <FiBarChart2 className="mx-auto text-4xl mb-4 opacity-50" />
                  <p className="text-sm">No analytics data available</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* User Management Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <FiUsers className="text-blue-500" />
                  User Management ({allUsers.length})
                </h2>
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Search users..."
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <select className="px-3 py-2 border border-gray-300 rounded-md text-sm">
                    <option value="">All Roles</option>
                    <option value="student">Students</option>
                    <option value="admin">Admins</option>
                    <option value="superadmin">SuperAdmins</option>
                  </select>
                </div>
              </div>

              {allUsers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Department
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Joined
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {allUsers.slice(0, 20).map((user, index) => (
                        <tr key={user.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {user.fullName || 'Unknown'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {user.email}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              user.role === 'superadmin' ? 'bg-red-100 text-red-800' :
                              user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {user.department || 'N/A'}
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                              <button
                                onClick={() => setSelectedUser(user)}
                                className="text-blue-600 hover:bg-blue-50 p-1 rounded text-xs"
                              >
                                <FiEye size={14} />
                              </button>
                              <button
                                onClick={() => setSelectedUser(user)}
                                className="text-yellow-600 hover:bg-yellow-50 p-1 rounded text-xs"
                              >
                                <FiEdit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="text-red-600 hover:bg-red-50 p-1 rounded text-xs"
                              >
                                <FiTrash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 sm:py-8 text-gray-500">
                  <FiUsers className="mx-auto text-4xl mb-4 opacity-50" />
                  <p className="text-sm">No users found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quiz Management Tab */}
        {activeTab === 'quizzes' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <FiSettings className="text-green-500" />
                  Quiz Management ({allQuizzes.length})
                </h2>
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Search quizzes..."
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  />
                  <select className="px-3 py-2 border border-gray-300 rounded-md text-sm">
                    <option value="">All Status</option>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              {allQuizzes.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quiz
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Department
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Questions
                        </th>
                        <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {allQuizzes.slice(0, 20).map((quiz, index) => (
                        <tr key={quiz.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900 truncate max-w-32 sm:max-w-none">
                                {quiz.title}
                              </div>
                              <div className="text-xs text-gray-500">
                                {quiz.timeLimit} minutes
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              quiz.status === 'approved' ? 'bg-green-100 text-green-800' :
                              quiz.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {quiz.status}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {quiz.department}
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {quiz.questions?.length || 0}
                          </td>
                          <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                              <button
                                onClick={() => setSelectedQuiz(quiz)}
                                className="text-blue-600 hover:bg-blue-50 p-1 rounded text-xs"
                              >
                                <FiEye size={14} />
                              </button>
                              <button
                                onClick={() => handleUpdateQuizStatus(quiz.id, 'approved')}
                                className="text-green-600 hover:bg-green-50 p-1 rounded text-xs"
                              >
                                <FiCheckCircle size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteQuiz(quiz.id)}
                                className="text-red-600 hover:bg-red-50 p-1 rounded text-xs"
                              >
                                <FiTrash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 sm:py-8 text-gray-500">
                  <FiSettings className="mx-auto text-4xl mb-4 opacity-50" />
                  <p className="text-sm">No quizzes found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Maintenance Tab */}
        {activeTab === 'maintenance' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 sm:mb-6 flex items-center gap-2">
                <FiDatabase className="text-purple-500" />
                System Maintenance
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* System Backup */}
                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <FiDownload className="text-blue-500" size={20} />
                    <h3 className="font-medium text-gray-900">System Backup</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Create a complete backup of all system data including users, quizzes, and submissions.
                  </p>
                  <button
                    onClick={handleSystemBackup}
                    disabled={loading.backup}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    {loading.backup ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Creating Backup...
                      </>
                    ) : (
                      <>
                        <FiDownload size={16} />
                        Create Backup
                      </>
                    )}
                  </button>
                </div>

                {/* Real-time Monitoring */}
                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <FiMonitor className="text-green-500" size={20} />
                    <h3 className="font-medium text-gray-900">Real-time Monitoring</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Monitor system performance and user activity in real-time.
                  </p>
                  <button
                    onClick={() => setRealTimeActive(!realTimeActive)}
                    className={`w-full px-4 py-2 rounded-md text-sm font-medium ${
                      realTimeActive 
                        ? 'bg-green-600 text-white hover:bg-green-700' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {realTimeActive ? 'Stop Monitoring' : 'Start Monitoring'}
                  </button>
                </div>

                {/* System Health Check */}
                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <FiHeart className="text-red-500" size={20} />
                    <h3 className="font-medium text-gray-900">Health Check</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Run a comprehensive system health check and diagnostics.
                  </p>
                  <button
                    onClick={refreshAllData}
                    className="w-full bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center justify-center gap-2 text-sm"
                  >
                    <FiRefreshCw size={16} />
                    Run Health Check
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Other tabs can be implemented similarly with mobile-first responsive design */}
        {/* For brevity, I'm showing the pattern for the remaining tabs */}
        {(activeTab === 'departments' || activeTab === 'logs' || activeTab === 'leaderboard') && (
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              {activeTab === 'departments' && <FiGlobe className="text-blue-500" />}
              {activeTab === 'logs' && <FiActivity className="text-green-500" />}
              {activeTab === 'leaderboard' && <FiAward className="text-yellow-500" />}
              {activeTab === 'departments' && 'Department Management'}
              {activeTab === 'logs' && 'Activity Logs'}
              {activeTab === 'leaderboard' && 'Global Leaderboard'}
            </h2>
            <div className="text-center py-6 sm:py-8 text-gray-500">
              <p className="text-sm">This section is under development</p>
              <p className="text-xs mt-2">Feature will be available in the next update</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// StatCard Component
const StatCard = ({ title, value, icon, trend }) => (
  <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 border border-gray-200">
    <div className="flex items-center justify-between mb-2">
      <div className="flex-shrink-0">
        {icon}
      </div>
      {trend && (
        <span className={`text-xs font-medium ${
          trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-600'
        }`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <div>
      <p className="text-lg sm:text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs sm:text-sm text-gray-600 truncate">{title}</p>
    </div>
  </div>
);
