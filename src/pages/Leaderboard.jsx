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
  FiCircle
} from 'react-icons/fi';
import { auth, db } from '../firebase/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
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
        return { icon: <FiAward />, label: 'Average Score', color: 'text-yellow-600' };
      case RANKING_TYPES.TOTAL_SCORE:
        return { icon: <FiTarget />, label: 'Total Score', color: 'text-blue-600' };
      case RANKING_TYPES.QUIZ_COUNT:
        return { icon: <FiZap />, label: 'Quiz Count', color: 'text-green-600' };
      case RANKING_TYPES.STREAK:
        return { icon: <FiTrendingUp />, label: 'Current Streak', color: 'text-orange-600' };
      case RANKING_TYPES.RECENT_PERFORMANCE:
        return { icon: <FiStar />, label: 'Recent Performance', color: 'text-purple-600' };
      default:
        return { icon: <FiAward />, label: 'Average Score', color: 'text-yellow-600' };
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
      return { icon: <FiAward className="text-yellow-500" />, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' };
    } else if (rank === 2) {
      return { icon: <FiCircle className="text-gray-500" />, color: 'text-gray-600 bg-gray-50 border-gray-200' };
    } else if (rank === 3) {
      return { icon: <FiAward className="text-orange-500" />, color: 'text-orange-600 bg-orange-50 border-orange-200' };
    } else if (rank <= 10) {
      return { icon: <FiStar className="text-blue-500" />, color: 'text-blue-600 bg-blue-50 border-blue-200' };
    } else {
      return { icon: <FiUsers className="text-gray-400" />, color: 'text-gray-600 bg-white border-gray-200' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading leaderboards...</p>
        </div>
      </div>
    );
  }

  const activeLeaderboard = activeScope === 'department' ? departmentLeaderboard : globalLeaderboard;
  const rankingInfo = getRankingTypeInfo(activeRankingType);
  const timePeriodInfo = getTimePeriodInfo(activeTimePeriod);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#6366F1] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-3">
                <FiAward className="text-yellow-400" />
                Leaderboards
              </h1>
              <p className="text-[#E2E8F0] mt-1">
                Compete with your peers and track your progress
              </p>
            </div>
            
            {/* User Position Card */}
            {userPosition && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white bg-opacity-20 backdrop-blur-sm text-white rounded-lg p-4 w-full lg:min-w-64"
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
                    <div className="text-lg font-semibold">
                      {activeScope === 'department' ? userPosition.department?.stats?.averagePercentage : userPosition.global?.stats?.averagePercentage}%
                    </div>
                    <div className="text-xs opacity-75">avg score</div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Scope Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
              <button
                onClick={() => setActiveScope('department')}
                className={`px-3 sm:px-4 py-2 rounded-md font-medium text-sm transition-colors flex-1 sm:flex-none ${
                  activeScope === 'department' 
                    ? 'bg-white text-[#6366F1] shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <FiUsers className="inline mr-2" />
                <span className="hidden sm:inline">{userDepartment} Department</span>
                <span className="sm:hidden">Dept</span>
              </button>
              <button
                onClick={() => setActiveScope('global')}
                className={`px-3 sm:px-4 py-2 rounded-md font-medium text-sm transition-colors flex-1 sm:flex-none ${
                  activeScope === 'global' 
                    ? 'bg-white text-[#6366F1] shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                🌍 <span className="hidden sm:inline">Global</span>
              </button>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              {/* Ranking Type Selector */}
              <div className="flex items-center gap-2">
                <FiFilter className="text-gray-400" />
                <select
                  value={activeRankingType}
                  onChange={(e) => setActiveRankingType(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] flex-1 sm:flex-none"
                >
                  <option value={RANKING_TYPES.AVERAGE_SCORE}>Average Score</option>
                  <option value={RANKING_TYPES.TOTAL_SCORE}>Total Score</option>
                  <option value={RANKING_TYPES.QUIZ_COUNT}>Quiz Count</option>
                  <option value={RANKING_TYPES.STREAK}>Current Streak</option>
                  <option value={RANKING_TYPES.RECENT_PERFORMANCE}>Recent Performance</option>
                </select>
              </div>

              {/* Time Period Selector */}
              <div className="flex items-center gap-2">
                <FiCalendar className="text-gray-400" />
                <select
                  value={activeTimePeriod}
                  onChange={(e) => setActiveTimePeriod(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] flex-1 sm:flex-none"
                >
                  <option value={TIME_PERIODS.ALL_TIME}>All Time</option>
                  <option value={TIME_PERIODS.THIS_MONTH}>This Month</option>
                  <option value={TIME_PERIODS.THIS_WEEK}>This Week</option>
                  <option value={TIME_PERIODS.TODAY}>Today</option>
                </select>
              </div>

              {/* Refresh Button */}
              <button
                onClick={loadLeaderboards}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-[#6366F1] text-white rounded-md hover:bg-[#4F46E5] disabled:opacity-50 text-sm w-full sm:w-auto justify-center"
              >
                <FiRefreshCw className={refreshing ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {/* Current Selection Info */}
          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className={rankingInfo.color}>{rankingInfo.icon}</span>
              <span>Ranking by: <strong>{rankingInfo.label}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              {timePeriodInfo.icon}
              <span>Period: <strong>{timePeriodInfo.label}</strong></span>
            </div>
            {lastUpdated && (
              <div className="flex items-center gap-2 text-xs">
                <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Leaderboard Display */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  {rankingInfo.icon}
                  <span className="hidden sm:inline">
                    {activeScope === 'department' ? `${userDepartment} Department` : 'Global'} Leaderboard
                  </span>
                  <span className="sm:hidden">
                    {activeScope === 'department' ? 'Dept' : 'Global'} Leaderboard
                  </span>
                </h2>
                <p className="opacity-90 text-sm mt-1">
                  {activeLeaderboard?.users?.length || 0} participants • {rankingInfo.label} • {timePeriodInfo.label}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xl sm:text-2xl font-bold">{activeLeaderboard?.totalParticipants || 0}</div>
                <div className="text-sm opacity-75">Total Players</div>
              </div>
            </div>
          </div>

          {/* Leaderboard List */}
          <div className="divide-y divide-gray-100">
            <AnimatePresence>
              {activeLeaderboard?.users?.length > 0 ? (
                activeLeaderboard.users.map((user, index) => {
                  const rankDisplay = getRankDisplay(user.rank);
                  const isCurrentUser = currentUser && user.userId === currentUser.uid;
                  
                  return (
                    <motion.div
                      key={user.userId}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`p-4 hover:bg-gray-50 transition-colors ${
                        isCurrentUser ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        {/* Rank and User Info */}
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 ${rankDisplay.color}`}>
                            <span className="font-bold text-base sm:text-lg">#{user.rank}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 sm:gap-3">
                            <span className="hidden sm:inline">{rankDisplay.icon}</span>
                            <div>
                              <div className="font-semibold text-gray-900 flex items-center gap-2">
                                <span className="text-sm sm:text-base">{user.fullName}</span>
                                {isCurrentUser && (
                                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-xs sm:text-sm text-gray-500">
                                {user.regNumber} • {activeScope === 'global' ? user.department : ''}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-3 sm:gap-6 text-sm w-full sm:w-auto justify-between sm:justify-end">
                          <div className="text-center">
                            <div className="font-bold text-base sm:text-lg text-gray-900">
                              {Math.round(user.averagePercentage)}%
                            </div>
                            <div className="text-gray-500 text-xs sm:text-sm">Avg</div>
                          </div>
                          
                          <div className="text-center">
                            <div className="font-bold text-base sm:text-lg text-gray-900">
                              {user.totalQuizzes}
                            </div>
                            <div className="text-gray-500 text-xs sm:text-sm">Quizzes</div>
                          </div>
                          
                          {user.recentStreak > 0 && (
                            <div className="text-center">
                              <div className="font-bold text-base sm:text-lg text-orange-600">
                                {user.recentStreak}
                              </div>
                              <div className="text-gray-500 text-xs sm:text-sm">Streak</div>
                            </div>
                          )}

                          <div className="text-center">
                            <div className="font-bold text-base sm:text-lg text-purple-600">
                              {user.totalPoints}
                            </div>
                            <div className="text-gray-500 text-xs sm:text-sm">Points</div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <FiAward className="mx-auto text-4xl mb-4 opacity-50" />
                  <p>No rankings available for the selected period</p>
                  <p className="text-sm mt-1">Be the first to take a quiz and claim the top spot!</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}