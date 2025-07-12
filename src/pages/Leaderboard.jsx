import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiAward, 
  FiTrendingUp, 
  FiUsers, 
  FiCalendar,
  FiRefreshCw,
  FiStar,
  FiTarget,
  FiZap,
  FiFilter,
  FiHeart,
  FiCircle,
  FiArrowLeft
} from 'react-icons/fi';
import { auth, db } from '../firebase/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { 
  generateDepartmentLeaderboard, 
  generateGlobalLeaderboard,
  getUserPosition,
  subscribeToLeaderboardUpdates,
  RANKING_TYPES,
  TIME_PERIODS
} from '../utils/leaderboardService';

export default function Leaderboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userDepartment, setUserDepartment] = useState(null);
  const [activeScope, setActiveScope] = useState('department'); // 'department' or 'global'
  const [activeRankingType, setActiveRankingType] = useState(RANKING_TYPES.AVERAGE_SCORE);
  const [activeTimePeriod, setActiveTimePeriod] = useState(TIME_PERIODS.ALL_TIME);
  const [departmentLeaderboard, setDepartmentLeaderboard] = useState(null);
  const [globalLeaderboard, setGlobalLeaderboard] = useState(null);
  const [userPosition, setUserPosition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const navigate = useNavigate();

  // Get current user and department
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setCurrentUser({ uid: user.uid, ...userData });
          setUserDepartment(userData.department);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, []);

  // Load leaderboards
  const loadLeaderboards = useCallback(async () => {
    if (!userDepartment) return;
    
    setRefreshing(true);
    try {
      console.log('📊 Loading leaderboards...');

      // Load department and global leaderboards
      const [deptLeaderboard, globalBoard, userPos] = await Promise.all([
        generateDepartmentLeaderboard(userDepartment, activeRankingType, activeTimePeriod),
        generateGlobalLeaderboard(activeRankingType, activeTimePeriod),
        currentUser ? getUserPosition(currentUser.uid, userDepartment, activeRankingType, activeTimePeriod) : null
      ]);

      setDepartmentLeaderboard(deptLeaderboard);
      setGlobalLeaderboard(globalBoard);
      setUserPosition(userPos);
      setLastUpdated(new Date());
      
      console.log('✅ Leaderboards loaded successfully');
    } catch (error) {
      console.error('❌ Error loading leaderboards:', error);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [userDepartment, activeRankingType, activeTimePeriod, currentUser]);

  // Load leaderboards when dependencies change
  useEffect(() => {
    loadLeaderboards();
  }, [loadLeaderboards]);

  // Real-time updates (optional - can be heavy)
  useEffect(() => {
    if (!userDepartment) return;

    const unsubscribe = subscribeToLeaderboardUpdates((updatedData) => {
      if (updatedData.department) setDepartmentLeaderboard(updatedData.department);
      if (updatedData.global) setGlobalLeaderboard(updatedData.global);
      setLastUpdated(updatedData.lastUpdated);
    }, userDepartment);

    return unsubscribe;
  }, [userDepartment]);

  // Get ranking type display info
  const getRankingTypeInfo = (type) => {
    switch (type) {
      case RANKING_TYPES.AVERAGE_SCORE:
        return { icon: <FiAward />, label: 'Average Score', color: 'text-warning-600' };
      case RANKING_TYPES.TOTAL_SCORE:
        return { icon: <FiTarget />, label: 'Total Score', color: 'text-primary-600' };
      case RANKING_TYPES.QUIZ_COUNT:
        return { icon: <FiZap />, label: 'Quiz Count', color: 'text-accent2-600' };
      case RANKING_TYPES.STREAK:
        return { icon: <FiTrendingUp />, label: 'Current Streak', color: 'text-orange-600' };
      case RANKING_TYPES.RECENT_PERFORMANCE:
        return { icon: <FiStar />, label: 'Recent Performance', color: 'text-purple-600' };
      default:
        return { icon: <FiAward />, label: 'Average Score', color: 'text-warning-600' };
    }
  };

  // Get time period display info
  const getTimePeriodInfo = (period) => {
    switch (period) {
      case TIME_PERIODS.TODAY:
        return { label: 'Today', icon: <FiCalendar /> };
      case TIME_PERIODS.THIS_WEEK:
        return { label: 'This Week', icon: <FiCalendar /> };
      case TIME_PERIODS.THIS_MONTH:
        return { label: 'This Month', icon: <FiCalendar /> };
      default:
        return { label: 'All Time', icon: <FiCalendar /> };
    }
  };

  // Get rank display with appropriate icon and color
  const getRankDisplay = (rank) => {
    if (rank === 1) {
      return { icon: <FiStar className="text-yellow-500" />, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' };
    } else if (rank === 2) {
      return { icon: <FiAward className="text-gray-500" />, color: 'text-gray-600 bg-gray-50 border-gray-200' };
    } else if (rank === 3) {
      return { icon: <FiAward className="text-orange-500" />, color: 'text-orange-600 bg-orange-50 border-orange-200' };
    } else if (rank <= 10) {
      return { icon: <FiStar className="text-primary-500" />, color: 'text-primary-600 bg-primary-50 border-primary-200' };
    } else {
      return { icon: <FiUsers className="text-slate-400" />, color: 'text-slate-600 bg-white border-slate-200' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading leaderboards...</p>
        </div>
      </div>
    );
  }

  const activeLeaderboard = activeScope === 'department' ? departmentLeaderboard : globalLeaderboard;
  const rankingInfo = getRankingTypeInfo(activeRankingType);
  const timePeriodInfo = getTimePeriodInfo(activeTimePeriod);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-accent1-600 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/student-dashboard')}
                className="flex items-center text-white/90 hover:text-white hover:bg-white/10 px-3 py-2 rounded-lg transition-all duration-200"
              >
                <FiArrowLeft className="w-5 h-5 mr-2" />
                Back to Dashboard
              </button>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-3">
                  <FiAward className="text-yellow-400" />
                  Leaderboards
                </h1>
                <p className="text-white/80 mt-1">
                  Compete with your peers and track your progress
                </p>
              </div>
            </div>
            
            {/* User Position Card */}
            {userPosition && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/20 backdrop-blur-sm text-white rounded-xl p-4 w-full lg:min-w-64 border border-white/20"
              >
                <h3 className="font-semibold text-sm opacity-90">Your Position</h3>
                <div className="flex justify-between items-center mt-2">
                  <div>
                    <div className="text-2xl font-bold">
                      #{activeScope === 'department' ? userPosition.department?.rank : userPosition.global?.rank}
                    </div>
                    <div className="text-xs opacity-75">
                      out of {activeScope === 'department' ? userPosition.department?.totalParticipants : userPosition.global?.totalParticipants}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">
                      {activeScope === 'department' ? userPosition.department?.stats?.averagePercentage : userPosition.global?.stats?.averagePercentage}%
                    </div>
                    <div className="text-xs opacity-75">Average</div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Scope Toggle */}
            <div className="flex bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => setActiveScope('department')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeScope === 'department'
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <FiUsers className="w-4 h-4" />
                Department
              </button>
              <button
                onClick={() => setActiveScope('global')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeScope === 'global'
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <FiAward className="w-4 h-4" />
                Global
              </button>
            </div>

            {/* Ranking Type */}
            <div className="flex-1">
              <select
                value={activeRankingType}
                onChange={(e) => setActiveRankingType(e.target.value)}
                className="w-full input-field"
              >
                {Object.values(RANKING_TYPES).map((type) => (
                  <option key={type} value={type}>
                    {getRankingTypeInfo(type).label}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Period */}
            <div className="flex-1">
              <select
                value={activeTimePeriod}
                onChange={(e) => setActiveTimePeriod(e.target.value)}
                className="w-full input-field"
              >
                {Object.values(TIME_PERIODS).map((period) => (
                  <option key={period} value={period}>
                    {getTimePeriodInfo(period).label}
                  </option>
                ))}
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={loadLeaderboards}
              disabled={refreshing}
              className="btn-primary flex items-center gap-2"
            >
              <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="card">
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 ${rankingInfo.color.replace('text-', 'bg-').replace('-600', '-100')}`}>
                  <div className={rankingInfo.color}>
                    {rankingInfo.icon}
                  </div>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">
                    {activeScope === 'department' ? `${userDepartment} Department` : 'Global'} Leaderboard
                  </h2>
                  <p className="text-slate-600 text-sm">
                    {rankingInfo.label} • {timePeriodInfo.label}
                  </p>
                </div>
              </div>
              {lastUpdated && (
                <div className="text-xs text-slate-500">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>

          {refreshing ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Refreshing leaderboard...</p>
            </div>
          ) : !activeLeaderboard || activeLeaderboard.length === 0 ? (
            <div className="p-8 text-center">
              <FiAward className="mx-auto text-6xl text-slate-300 mb-4" />
              <h3 className="text-xl font-semibold text-slate-700 mb-2">No Data Available</h3>
              <p className="text-slate-500">No participants found for the selected criteria.</p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Rank</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Quizzes</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Performance</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {activeLeaderboard.map((participant, index) => {
                      const rankDisplay = getRankDisplay(index + 1);
                      const isCurrentUser = currentUser && participant.userId === currentUser.uid;
                      
                      return (
                        <motion.tr
                          key={participant.userId}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={`${isCurrentUser ? 'bg-primary-50 border-l-4 border-primary-500' : ''} hover:bg-slate-50 transition-colors`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${rankDisplay.color}`}>
                                {rankDisplay.icon}
                              </div>
                              <span className="font-bold text-slate-900">#{index + 1}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">
                                {participant.fullName}
                                {isCurrentUser && (
                                  <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-slate-500">{participant.regNumber}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                              {participant.department}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-slate-900">
                              {participant.averagePercentage}%
                            </div>
                            <div className="text-xs text-slate-500">
                              {participant.totalScore} points
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-slate-900">
                              {participant.quizCount}
                            </div>
                            <div className="text-xs text-slate-500">quizzes taken</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-1 max-w-20">
                                <div className="h-2 rounded-full bg-slate-200">
                                  <div 
                                    className={`h-2 rounded-full ${
                                      participant.averagePercentage >= 90 ? 'bg-accent2-500' :
                                      participant.averagePercentage >= 80 ? 'bg-primary-500' :
                                      participant.averagePercentage >= 70 ? 'bg-warning-500' :
                                      participant.averagePercentage >= 50 ? 'bg-orange-500' : 'bg-error-500'
                                    }`}
                                    style={{ width: `${Math.min(participant.averagePercentage, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                              <span className={`ml-2 text-xs font-semibold ${
                                participant.averagePercentage >= 90 ? 'text-accent2-700' :
                                participant.averagePercentage >= 80 ? 'text-primary-700' :
                                participant.averagePercentage >= 70 ? 'text-warning-700' :
                                participant.averagePercentage >= 50 ? 'text-orange-700' : 'text-error-700'
                              }`}>
                                {participant.averagePercentage >= 90 ? 'Excellent' :
                                 participant.averagePercentage >= 80 ? 'Very Good' :
                                 participant.averagePercentage >= 70 ? 'Good' :
                                 participant.averagePercentage >= 50 ? 'Fair' : 'Needs Improvement'}
                              </span>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}