// Leaderboard Service for Looma Platform
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  doc,
  getDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

// Leaderboard calculation types
export const RANKING_TYPES = {
  AVERAGE_SCORE: 'average_score',
  TOTAL_SCORE: 'total_score',
  QUIZ_COUNT: 'quiz_count',
  STREAK: 'streak',
  RECENT_PERFORMANCE: 'recent_performance'
};

export const TIME_PERIODS = {
  ALL_TIME: 'all_time',
  THIS_MONTH: 'this_month',
  THIS_WEEK: 'this_week',
  TODAY: 'today'
};

// Calculate user statistics from submissions
export const calculateUserStats = (submissions) => {
  if (!submissions || !submissions.length) {
    return {
      totalQuizzes: 0,
      totalScore: 0,
      averageScore: 0,
      averagePercentage: 0,
      highestScore: 0,
      lowestScore: 0,
      recentStreak: 0,
      totalPoints: 0
    };
  }

  const scores = submissions.map(s => s.score || 0);
  const percentages = submissions.map(s => s.percentage || 0);
  const totalQuizzes = submissions.length;
  const totalScore = scores.reduce((sum, score) => sum + score, 0);
  const averageScore = totalScore / totalQuizzes;
  const averagePercentage = percentages.reduce((sum, p) => sum + p, 0) / totalQuizzes;
  
  // Calculate recent streak (consecutive quizzes above 70%)
  let recentStreak = 0;
  const sortedSubmissions = submissions
    .sort((a, b) => (b.submittedAt?.toDate?.() || new Date()) - (a.submittedAt?.toDate?.() || new Date()));
  
  for (const submission of sortedSubmissions) {
    if ((submission.percentage || 0) >= 70) {
      recentStreak++;
    } else {
      break;
    }
  }

  // Calculate total points (weighted scoring)
  const totalPoints = submissions.reduce((sum, submission) => {
    const basePoints = submission.score || 0;
    const bonusPoints = (submission.percentage || 0) >= 90 ? 5 : 
                      (submission.percentage || 0) >= 80 ? 3 : 
                      (submission.percentage || 0) >= 70 ? 1 : 0;
    return sum + basePoints + bonusPoints;
  }, 0);

  return {
    totalQuizzes,
    totalScore,
    averageScore: Math.round(averageScore * 100) / 100,
    averagePercentage: Math.round(averagePercentage * 100) / 100,
    highestScore: Math.max(...scores),
    lowestScore: Math.min(...scores),
    recentStreak,
    totalPoints
  };
};

// Get submissions within time period
export const getSubmissionsInPeriod = (submissions, period) => {
  if (!submissions || !submissions.length) return [];
  
  const now = new Date();
  let startDate;

  switch (period) {
    case TIME_PERIODS.TODAY:
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case TIME_PERIODS.THIS_WEEK:
      const dayOfWeek = now.getDay();
      startDate = new Date(now.getTime() - (dayOfWeek * 24 * 60 * 60 * 1000));
      startDate.setHours(0, 0, 0, 0);
      break;
    case TIME_PERIODS.THIS_MONTH:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    default:
      return submissions; // ALL_TIME
  }

  return submissions.filter(submission => {
    const submissionDate = submission.submittedAt?.toDate?.() || new Date(submission.submittedAt);
    return submissionDate >= startDate;
  });
};

// Fetch all submissions for leaderboard calculations
export const fetchAllSubmissions = async () => {
  try {
    console.log('🏆 Fetching all submissions for leaderboard...');
    
    // Get all quizzes
    const quizzesQuery = query(collection(db, 'quizzes'));
    const quizzesSnapshot = await getDocs(quizzesQuery);
    
    if (quizzesSnapshot.empty) {
      console.log('📊 No quizzes found');
      return [];
    }
    
    const allSubmissions = [];
    const submissionPromises = [];

    // For each quiz, get all submissions
    quizzesSnapshot.docs.forEach(quizDoc => {
      const submissionsQuery = query(
        collection(db, 'quizzes', quizDoc.id, 'submissions'),
        orderBy('submittedAt', 'desc')
      );
      submissionPromises.push(
        getDocs(submissionsQuery).then(submissionsSnapshot => {
          submissionsSnapshot.docs.forEach(submissionDoc => {
            allSubmissions.push({
              id: submissionDoc.id,
              quizId: quizDoc.id,
              quizTitle: quizDoc.data().title,
              ...submissionDoc.data()
            });
          });
        }).catch(error => {
          console.warn(`⚠️ Error fetching submissions for quiz ${quizDoc.id}:`, error);
        })
      );
    });

    await Promise.allSettled(submissionPromises);
    
    console.log(`📊 Found ${allSubmissions.length} total submissions`);
    return allSubmissions;
  } catch (error) {
    console.error('❌ Error fetching submissions:', error);
    return [];
  }
};

// Generate department leaderboard
export const generateDepartmentLeaderboard = async (department, rankingType = RANKING_TYPES.AVERAGE_SCORE, timePeriod = TIME_PERIODS.ALL_TIME, limitCount = 50) => {
  try {
    console.log(`🏆 Generating ${department} department leaderboard...`);
    
    if (!department) {
      throw new Error('Department is required');
    }
    
    const allSubmissions = await fetchAllSubmissions();
    
    // Filter by department
    const departmentSubmissions = allSubmissions.filter(
      submission => submission.department === department
    );

    console.log(`📊 Found ${departmentSubmissions.length} submissions for ${department} department`);

    // Apply time period filter
    const periodSubmissions = getSubmissionsInPeriod(departmentSubmissions, timePeriod);

    // Group by user
    const userSubmissions = {};
    periodSubmissions.forEach(submission => {
      const userId = submission.userId;
      if (!userSubmissions[userId]) {
        userSubmissions[userId] = {
          userId,
          regNumber: submission.regNumber || 'N/A',
          fullName: submission.fullName || 'Unknown User',
          department: submission.department,
          email: submission.email || 'No email',
          submissions: []
        };
      }
      userSubmissions[userId].submissions.push(submission);
    });

    // Calculate stats and create leaderboard
    const leaderboardData = Object.values(userSubmissions).map(user => {
      const stats = calculateUserStats(user.submissions);
      return {
        ...user,
        ...stats,
        rank: 0 // Will be set after sorting
      };
    });

    // Sort based on ranking type
    let sortedLeaderboard;
    switch (rankingType) {
      case RANKING_TYPES.TOTAL_SCORE:
        sortedLeaderboard = leaderboardData.sort((a, b) => b.totalScore - a.totalScore);
        break;
      case RANKING_TYPES.QUIZ_COUNT:
        sortedLeaderboard = leaderboardData.sort((a, b) => b.totalQuizzes - a.totalQuizzes);
        break;
      case RANKING_TYPES.STREAK:
        sortedLeaderboard = leaderboardData.sort((a, b) => b.recentStreak - a.recentStreak);
        break;
      case RANKING_TYPES.RECENT_PERFORMANCE:
        sortedLeaderboard = leaderboardData.sort((a, b) => {
          // Sort by recent submissions average
          const aRecent = a.submissions.slice(0, 5);
          const bRecent = b.submissions.slice(0, 5);
          const aRecentAvg = aRecent.length > 0 ? aRecent.reduce((sum, s) => sum + (s.percentage || 0), 0) / aRecent.length : 0;
          const bRecentAvg = bRecent.length > 0 ? bRecent.reduce((sum, s) => sum + (s.percentage || 0), 0) / bRecent.length : 0;
          return bRecentAvg - aRecentAvg;
        });
        break;
      default: // AVERAGE_SCORE
        sortedLeaderboard = leaderboardData.sort((a, b) => {
          // Primary sort: average percentage
          if (b.averagePercentage !== a.averagePercentage) {
            return b.averagePercentage - a.averagePercentage;
          }
          // Secondary sort: total quizzes (more participation)
          return b.totalQuizzes - a.totalQuizzes;
        });
    }

    // Assign ranks
    sortedLeaderboard.forEach((user, index) => {
      user.rank = index + 1;
    });

    // Apply limit
    const limitedLeaderboard = sortedLeaderboard.slice(0, limitCount);

    console.log(`🏅 ${department} leaderboard generated: ${limitedLeaderboard.length} users`);
    return {
      department,
      rankingType,
      timePeriod,
      users: limitedLeaderboard,
      totalParticipants: leaderboardData.length,
      generatedAt: new Date(),
      hasData: limitedLeaderboard.length > 0
    };

  } catch (error) {
    console.error(`❌ Error generating ${department} leaderboard:`, error);
    return {
      department,
      rankingType,
      timePeriod,
      users: [],
      totalParticipants: 0,
      generatedAt: new Date(),
      error: error.message,
      hasData: false
    };
  }
};

// Generate global leaderboard (across all departments)
export const generateGlobalLeaderboard = async (rankingType = RANKING_TYPES.AVERAGE_SCORE, timePeriod = TIME_PERIODS.ALL_TIME, limitCount = 100) => {
  try {
    console.log('🌍 Generating global leaderboard...');
    
    const allSubmissions = await fetchAllSubmissions();
    
    if (allSubmissions.length === 0) {
      console.log('📊 No submissions found for global leaderboard');
      return {
        scope: 'global',
        rankingType,
        timePeriod,
        users: [],
        totalParticipants: 0,
        generatedAt: new Date(),
        hasData: false
      };
    }
    
    // Apply time period filter
    const periodSubmissions = getSubmissionsInPeriod(allSubmissions, timePeriod);

    // Group by user
    const userSubmissions = {};
    periodSubmissions.forEach(submission => {
      const userId = submission.userId;
      if (!userSubmissions[userId]) {
        userSubmissions[userId] = {
          userId,
          regNumber: submission.regNumber || 'N/A',
          fullName: submission.fullName || 'Unknown User',
          department: submission.department || 'Unknown',
          email: submission.email || 'No email',
          submissions: []
        };
      }
      userSubmissions[userId].submissions.push(submission);
    });

    // Calculate stats and create leaderboard (same logic as department)
    const leaderboardData = Object.values(userSubmissions).map(user => {
      const stats = calculateUserStats(user.submissions);
      return {
        ...user,
        ...stats,
        rank: 0
      };
    });

    // Sort based on ranking type (same logic as department)
    let sortedLeaderboard;
    switch (rankingType) {
      case RANKING_TYPES.TOTAL_SCORE:
        sortedLeaderboard = leaderboardData.sort((a, b) => b.totalScore - a.totalScore);
        break;
      case RANKING_TYPES.QUIZ_COUNT:
        sortedLeaderboard = leaderboardData.sort((a, b) => b.totalQuizzes - a.totalQuizzes);
        break;
      case RANKING_TYPES.STREAK:
        sortedLeaderboard = leaderboardData.sort((a, b) => b.recentStreak - a.recentStreak);
        break;
      case RANKING_TYPES.RECENT_PERFORMANCE:
        sortedLeaderboard = leaderboardData.sort((a, b) => {
          const aRecent = a.submissions.slice(0, 5);
          const bRecent = b.submissions.slice(0, 5);
          const aRecentAvg = aRecent.length > 0 ? aRecent.reduce((sum, s) => sum + (s.percentage || 0), 0) / aRecent.length : 0;
          const bRecentAvg = bRecent.length > 0 ? bRecent.reduce((sum, s) => sum + (s.percentage || 0), 0) / bRecent.length : 0;
          return bRecentAvg - aRecentAvg;
        });
        break;
      default: // AVERAGE_SCORE
        sortedLeaderboard = leaderboardData.sort((a, b) => {
          if (b.averagePercentage !== a.averagePercentage) {
            return b.averagePercentage - a.averagePercentage;
          }
          return b.totalQuizzes - a.totalQuizzes;
        });
    }

    // Assign ranks and apply limit
    sortedLeaderboard.forEach((user, index) => {
      user.rank = index + 1;
    });

    const limitedLeaderboard = sortedLeaderboard.slice(0, limitCount);

    console.log(`🌍 Global leaderboard generated: ${limitedLeaderboard.length} users`);
    return {
      scope: 'global',
      rankingType,
      timePeriod,
      users: limitedLeaderboard,
      totalParticipants: leaderboardData.length,
      generatedAt: new Date(),
      hasData: limitedLeaderboard.length > 0
    };

  } catch (error) {
    console.error('❌ Error generating global leaderboard:', error);
    return {
      scope: 'global',
      rankingType,
      timePeriod,
      users: [],
      totalParticipants: 0,
      generatedAt: new Date(),
      error: error.message,
      hasData: false
    };
  }
};

// Get user's position in leaderboard
export const getUserPosition = async (userId, department, rankingType = RANKING_TYPES.AVERAGE_SCORE, timePeriod = TIME_PERIODS.ALL_TIME) => {
  try {
    if (!userId || !department) {
      console.warn('⚠️ Missing userId or department for getUserPosition');
      return null;
    }
    
    const departmentLeaderboard = await generateDepartmentLeaderboard(department, rankingType, timePeriod, 1000);
    const globalLeaderboard = await generateGlobalLeaderboard(rankingType, timePeriod, 1000);
    
    const departmentPosition = departmentLeaderboard.users.find(user => user.userId === userId);
    const globalPosition = globalLeaderboard.users.find(user => user.userId === userId);
    
    return {
      department: {
        rank: departmentPosition?.rank || null,
        totalParticipants: departmentLeaderboard.totalParticipants,
        stats: departmentPosition || null,
        hasData: departmentLeaderboard.hasData
      },
      global: {
        rank: globalPosition?.rank || null,
        totalParticipants: globalLeaderboard.totalParticipants,
        stats: globalPosition || null,
        hasData: globalLeaderboard.hasData
      }
    };
  } catch (error) {
    console.error('❌ Error getting user position:', error);
    return null;
  }
};

// Real-time leaderboard listener
export const subscribeToLeaderboardUpdates = (callback, department = null) => {
  try {
    // Listen to all quizzes for changes
    const quizzesQuery = query(collection(db, 'quizzes'));
    
    const unsubscribe = onSnapshot(quizzesQuery, async (snapshot) => {
      console.log('🔄 Leaderboard data updated, regenerating...');
      
      try {
        // Regenerate leaderboards
        const departmentLeaderboard = department ? 
          await generateDepartmentLeaderboard(department) : null;
        const globalLeaderboard = await generateGlobalLeaderboard();
        
        callback({
          department: departmentLeaderboard,
          global: globalLeaderboard,
          lastUpdated: new Date()
        });
      } catch (error) {
        console.error('❌ Error regenerating leaderboards:', error);
        callback({
          department: null,
          global: null,
          error: error.message,
          lastUpdated: new Date()
        });
      }
    });
    
    return unsubscribe;
  } catch (error) {
    console.error('❌ Error setting up leaderboard listener:', error);
    return () => {};
  }
};