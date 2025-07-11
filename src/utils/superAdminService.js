// SuperAdmin Service for Looma Platform
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  writeBatch,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';

// Analytics time frames
export const TIME_FRAMES = {
  LAST_HOUR: 'last_hour',
  LAST_24_HOURS: 'last_24_hours',
  LAST_WEEK: 'last_week',
  LAST_MONTH: 'last_month',
  ALL_TIME: 'all_time'
};

// System health metrics
export const HEALTH_METRICS = {
  EXCELLENT: { score: 95, color: 'green', label: 'Excellent' },
  GOOD: { score: 80, color: 'blue', label: 'Good' },
  FAIR: { score: 65, color: 'yellow', label: 'Fair' },
  POOR: { score: 50, color: 'orange', label: 'Poor' },
  CRITICAL: { score: 0, color: 'red', label: 'Critical' }
};

// Real-time platform statistics
export const fetchPlatformStats = async (timeFrame = TIME_FRAMES.ALL_TIME) => {
  try {
    console.log('🔍 Fetching platform statistics...');
    
    const now = new Date();
    let startDate = null;
    
    // Calculate time range
    switch (timeFrame) {
      case TIME_FRAMES.LAST_HOUR:
        startDate = new Date(now.getTime() - (60 * 60 * 1000));
        break;
      case TIME_FRAMES.LAST_24_HOURS:
        startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        break;
      case TIME_FRAMES.LAST_WEEK:
        startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        break;
      case TIME_FRAMES.LAST_MONTH:
        startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        break;
    }

    // Fetch all collections in parallel
    const [usersSnapshot, quizzesSnapshot] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'quizzes'))
    ]);

    // Process users data
    const allUsers = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const usersByRole = {
      students: allUsers.filter(user => user.role === 'student' || !user.role),
      admins: allUsers.filter(user => user.role === 'admin'),
      superAdmins: allUsers.filter(user => user.role === 'superadmin')
    };

    const usersByDepartment = {};
    allUsers.forEach(user => {
      if (user.department) {
        usersByDepartment[user.department] = (usersByDepartment[user.department] || 0) + 1;
      }
    });

    // Process quizzes data
    const allQuizzes = quizzesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const quizzesByStatus = {
      approved: allQuizzes.filter(quiz => quiz.status === 'approved'),
      pending: allQuizzes.filter(quiz => quiz.status === 'pending'),
      draft: allQuizzes.filter(quiz => quiz.status === 'draft')
    };

    const quizzesByDepartment = {};
    allQuizzes.forEach(quiz => {
      if (quiz.department) {
        quizzesByDepartment[quiz.department] = (quizzesByDepartment[quiz.department] || 0) + 1;
      }
    });

    // Fetch submissions for each quiz
    let totalSubmissions = 0;
    let recentSubmissions = 0;
    const submissionsByDepartment = {};
    const submissionsByQuiz = {};
    
    const submissionPromises = allQuizzes.map(async (quiz) => {
      const submissionsQuery = query(collection(db, 'quizzes', quiz.id, 'submissions'));
      const submissionsSnapshot = await getDocs(submissionsQuery);
      
      submissionsByQuiz[quiz.id] = {
        quizTitle: quiz.title,
        department: quiz.department,
        count: submissionsSnapshot.size,
        submissions: submissionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      };

      totalSubmissions += submissionsSnapshot.size;

      // Filter by time frame if specified
      if (startDate) {
        const recentCount = submissionsSnapshot.docs.filter(doc => {
          const submissionDate = doc.data().submittedAt?.toDate?.() || new Date(doc.data().submittedAt);
          return submissionDate >= startDate;
        }).length;
        recentSubmissions += recentCount;
      }

      // Count by department
      if (quiz.department) {
        submissionsByDepartment[quiz.department] = (submissionsByDepartment[quiz.department] || 0) + submissionsSnapshot.size;
      }
    });

    await Promise.all(submissionPromises);

    // Calculate activity metrics
    const averageSubmissionsPerQuiz = allQuizzes.length > 0 ? totalSubmissions / allQuizzes.length : 0;
    const averageSubmissionsPerUser = usersByRole.students.length > 0 ? totalSubmissions / usersByRole.students.length : 0;

    // Calculate system health score
    const healthFactors = {
      userEngagement: Math.min((averageSubmissionsPerUser / 5) * 100, 100), // 5+ submissions = 100%
      quizQuality: (quizzesByStatus.approved.length / Math.max(allQuizzes.length, 1)) * 100,
      systemActivity: Math.min((recentSubmissions / Math.max(totalSubmissions * 0.1, 1)) * 100, 100),
      platformGrowth: Math.min((usersByRole.students.length / 50) * 100, 100) // 50+ students = 100%
    };

    const overallHealthScore = Object.values(healthFactors).reduce((sum, score) => sum + score, 0) / Object.keys(healthFactors).length;

    let healthStatus = HEALTH_METRICS.CRITICAL;
    if (overallHealthScore >= 95) healthStatus = HEALTH_METRICS.EXCELLENT;
    else if (overallHealthScore >= 80) healthStatus = HEALTH_METRICS.GOOD;
    else if (overallHealthScore >= 65) healthStatus = HEALTH_METRICS.FAIR;
    else if (overallHealthScore >= 50) healthStatus = HEALTH_METRICS.POOR;

    const stats = {
      users: {
        total: allUsers.length,
        byRole: usersByRole,
        byDepartment: usersByDepartment,
        recentSignups: startDate ? allUsers.filter(user => {
          const signupDate = user.createdAt?.toDate?.() || new Date(user.createdAt);
          return signupDate >= startDate;
        }).length : null
      },
      quizzes: {
        total: allQuizzes.length,
        byStatus: quizzesByStatus,
        byDepartment: quizzesByDepartment,
        recentCreated: startDate ? allQuizzes.filter(quiz => {
          const createdDate = quiz.createdAt?.toDate?.() || new Date(quiz.createdAt);
          return createdDate >= startDate;
        }).length : null
      },
      submissions: {
        total: totalSubmissions,
        recent: recentSubmissions,
        byDepartment: submissionsByDepartment,
        byQuiz: submissionsByQuiz,
        averagePerQuiz: Math.round(averageSubmissionsPerQuiz * 100) / 100,
        averagePerUser: Math.round(averageSubmissionsPerUser * 100) / 100
      },
      health: {
        score: Math.round(overallHealthScore),
        status: healthStatus,
        factors: healthFactors
      },
      timeFrame,
      generatedAt: new Date()
    };

    console.log('✅ Platform statistics generated successfully');
    return stats;

  } catch (error) {
    console.error('❌ Error fetching platform stats:', error);
    return {
      error: error.message,
      users: { total: 0, byRole: {}, byDepartment: {} },
      quizzes: { total: 0, byStatus: {}, byDepartment: {} },
      submissions: { total: 0, recent: 0, byDepartment: {}, byQuiz: {} },
      health: { score: 0, status: HEALTH_METRICS.CRITICAL, factors: {} },
      timeFrame,
      generatedAt: new Date()
    };
  }
};

// Get detailed user activity logs
export const fetchUserActivityLogs = async (limitCount = 100) => {
  try {
    console.log('📝 Fetching user activity logs...');
    
    const allQuizzes = await getDocs(collection(db, 'quizzes'));
    const activityLogs = [];

    // Collect all submissions across all quizzes
    const logPromises = allQuizzes.docs.map(async (quizDoc) => {
      const submissionsQuery = query(
        collection(db, 'quizzes', quizDoc.id, 'submissions'),
        orderBy('submittedAt', 'desc'),
        limit(20) // Limit per quiz to prevent overwhelming data
      );
      
      const submissionsSnapshot = await getDocs(submissionsQuery);
      
      submissionsSnapshot.docs.forEach(submissionDoc => {
        const submission = submissionDoc.data();
        activityLogs.push({
          id: submissionDoc.id,
          type: 'quiz_submission',
          action: 'Quiz Completed',
          user: {
            id: submission.userId,
            name: submission.fullName || 'Unknown',
            regNumber: submission.regNumber || 'Anonymous',
            department: submission.department || 'Unknown'
          },
          quiz: {
            id: quizDoc.id,
            title: quizDoc.data().title,
            department: quizDoc.data().department
          },
          details: {
            score: submission.score,
            total: submission.total,
            percentage: submission.percentage,
            timeSpent: submission.timeSpent
          },
          timestamp: submission.submittedAt?.toDate?.() || new Date(submission.submittedAt || Date.now()),
          severity: 'info',
          icon: '📝'
        });
      });
    });

    await Promise.all(logPromises);

    // Sort by timestamp and limit
    activityLogs.sort((a, b) => b.timestamp - a.timestamp);
    const limitedLogs = activityLogs.slice(0, limitCount);

    console.log(`📋 Retrieved ${limitedLogs.length} activity logs`);
    return limitedLogs;

  } catch (error) {
    console.error('❌ Error fetching activity logs:', error);
    return [];
  }
};

// Get system alerts and warnings
export const fetchSystemAlerts = async () => {
  try {
    console.log('🚨 Checking for system alerts...');
    
    const alerts = [];
    const now = new Date();

    // Check for quizzes pending approval
    const pendingQuizzesQuery = query(
      collection(db, 'quizzes'),
      where('status', '==', 'pending')
    );
    const pendingQuizzesSnapshot = await getDocs(pendingQuizzesQuery);
    
    if (pendingQuizzesSnapshot.size > 0) {
      alerts.push({
        id: 'pending_quizzes',
        type: 'warning',
        title: 'Quizzes Pending Approval',
        message: `${pendingQuizzesSnapshot.size} quiz(es) are waiting for approval`,
        count: pendingQuizzesSnapshot.size,
        action: 'Review pending quizzes',
        severity: 'medium',
        timestamp: now,
        icon: '⏳'
      });
    }

    // Check for recently failed submissions (if we had error logging)
    // This would require additional error logging implementation

    // Check for inactive departments
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const departmentActivity = {};
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    usersSnapshot.docs.forEach(doc => {
      const userData = doc.data();
      if (userData.department) {
        if (!departmentActivity[userData.department]) {
          departmentActivity[userData.department] = { users: 0, recentActivity: false };
        }
        departmentActivity[userData.department].users++;
        
        // Check if user has recent activity (lastLogin if we tracked it)
        if (userData.lastLogin?.toDate?.() >= oneDayAgo) {
          departmentActivity[userData.department].recentActivity = true;
        }
      }
    });

    // Alert for departments with users but no recent activity
    Object.entries(departmentActivity).forEach(([dept, data]) => {
      if (data.users >= 5 && !data.recentActivity) {
        alerts.push({
          id: `inactive_dept_${dept}`,
          type: 'warning',
          title: 'Inactive Department',
          message: `${dept} department shows no recent activity`,
          department: dept,
          action: 'Check department engagement',
          severity: 'low',
          timestamp: now,
          icon: '😴'
        });
      }
    });

    // Check for low quiz completion rates
    const quizzesSnapshot = await getDocs(collection(db, 'quizzes'));
    const lowEngagementQuizzes = [];

    const quizPromises = quizzesSnapshot.docs.map(async (quizDoc) => {
      const quiz = quizDoc.data();
      if (quiz.status === 'approved') {
        const submissionsSnapshot = await getDocs(collection(db, 'quizzes', quizDoc.id, 'submissions'));
        const submissionCount = submissionsSnapshot.size;
        
        // If quiz has been approved for more than a week and has fewer than 5 submissions
        const createdAt = quiz.createdAt?.toDate?.() || new Date(quiz.createdAt);
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        if (createdAt < weekAgo && submissionCount < 5) {
          lowEngagementQuizzes.push({
            title: quiz.title,
            department: quiz.department,
            submissions: submissionCount
          });
        }
      }
    });

    await Promise.all(quizPromises);

    if (lowEngagementQuizzes.length > 0) {
      alerts.push({
        id: 'low_engagement',
        type: 'info',
        title: 'Low Quiz Engagement',
        message: `${lowEngagementQuizzes.length} approved quiz(es) have low participation`,
        count: lowEngagementQuizzes.length,
        details: lowEngagementQuizzes,
        action: 'Review quiz engagement strategies',
        severity: 'low',
        timestamp: now,
        icon: '📉'
      });
    }

    // Sort alerts by severity
    const severityOrder = { high: 3, medium: 2, low: 1 };
    alerts.sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0));

    console.log(`🚨 Found ${alerts.length} system alerts`);
    return alerts;

  } catch (error) {
    console.error('❌ Error fetching system alerts:', error);
    return [];
  }
};

// Department management functions
export const fetchDepartmentAnalytics = async () => {
  try {
    console.log('🏢 Fetching department analytics...');
    
    const [usersSnapshot, quizzesSnapshot] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'quizzes'))
    ]);

    const departmentData = {};

    // Process users by department
    usersSnapshot.docs.forEach(doc => {
      const user = doc.data();
      if (user.department) {
        if (!departmentData[user.department]) {
          departmentData[user.department] = {
            name: user.department,
            users: { total: 0, students: 0, admins: 0 },
            quizzes: { total: 0, approved: 0, pending: 0, draft: 0 },
            submissions: { total: 0, averageScore: 0 },
            lastActivity: null
          };
        }
        
        departmentData[user.department].users.total++;
        if (user.role === 'admin') {
          departmentData[user.department].users.admins++;
        } else {
          departmentData[user.department].users.students++;
        }

        // Track last activity if we had that data
        if (user.lastLogin?.toDate?.()) {
          const userLastLogin = user.lastLogin.toDate();
          if (!departmentData[user.department].lastActivity || userLastLogin > departmentData[user.department].lastActivity) {
            departmentData[user.department].lastActivity = userLastLogin;
          }
        }
      }
    });

    // Process quizzes by department
    const quizPromises = quizzesSnapshot.docs.map(async (quizDoc) => {
      const quiz = quizDoc.data();
      if (quiz.department && departmentData[quiz.department]) {
        departmentData[quiz.department].quizzes.total++;
        departmentData[quiz.department].quizzes[quiz.status]++;

        // Get submissions for this quiz
        const submissionsSnapshot = await getDocs(collection(db, 'quizzes', quizDoc.id, 'submissions'));
        departmentData[quiz.department].submissions.total += submissionsSnapshot.size;

        // Calculate average scores
        let totalScore = 0;
        let scoreCount = 0;
        submissionsSnapshot.docs.forEach(submissionDoc => {
          const submission = submissionDoc.data();
          if (typeof submission.percentage === 'number') {
            totalScore += submission.percentage;
            scoreCount++;
          }
        });

        if (scoreCount > 0) {
          const avgScore = totalScore / scoreCount;
          departmentData[quiz.department].submissions.averageScore = 
            (departmentData[quiz.department].submissions.averageScore + avgScore) / 2;
        }
      }
    });

    await Promise.all(quizPromises);

    // Calculate department health scores
    Object.values(departmentData).forEach(dept => {
      const factors = {
        userBase: Math.min((dept.users.total / 20) * 100, 100),
        quizActivity: Math.min((dept.quizzes.total / 10) * 100, 100),
        engagement: Math.min((dept.submissions.total / 50) * 100, 100),
        performance: dept.submissions.averageScore || 0
      };
      
      dept.healthScore = Object.values(factors).reduce((sum, score) => sum + score, 0) / Object.keys(factors).length;
      dept.healthFactors = factors;
    });

    console.log(`🏢 Department analytics for ${Object.keys(departmentData).length} departments`);
    return Object.values(departmentData);

  } catch (error) {
    console.error('❌ Error fetching department analytics:', error);
    return [];
  }
};

// Backup and maintenance functions
export const createSystemBackup = async () => {
  try {
    console.log('💾 Creating system backup...');
    
    const backupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      collections: {}
    };

    // Backup users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    backupData.collections.users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Backup quizzes and their submissions
    const quizzesSnapshot = await getDocs(collection(db, 'quizzes'));
    backupData.collections.quizzes = [];

    for (const quizDoc of quizzesSnapshot.docs) {
      const quizData = {
        id: quizDoc.id,
        ...quizDoc.data(),
        submissions: [],
        codes: []
      };

      // Backup submissions
      const submissionsSnapshot = await getDocs(collection(db, 'quizzes', quizDoc.id, 'submissions'));
      quizData.submissions = submissionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Backup access codes
      const codesSnapshot = await getDocs(collection(db, 'quizzes', quizDoc.id, 'codes'));
      quizData.codes = codesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      backupData.collections.quizzes.push(quizData);
    }

    // Add metadata
    backupData.metadata = {
      totalUsers: backupData.collections.users.length,
      totalQuizzes: backupData.collections.quizzes.length,
      totalSubmissions: backupData.collections.quizzes.reduce((sum, quiz) => sum + quiz.submissions.length, 0),
      backupSize: JSON.stringify(backupData).length
    };

    console.log('✅ System backup created successfully');
    console.log(`📊 Backup contains: ${backupData.metadata.totalUsers} users, ${backupData.metadata.totalQuizzes} quizzes, ${backupData.metadata.totalSubmissions} submissions`);
    
    return backupData;

  } catch (error) {
    console.error('❌ Error creating system backup:', error);
    throw new Error(`Backup failed: ${error.message}`);
  }
};

// Real-time dashboard updates
export const subscribeToRealTimeUpdates = (callback) => {
  const unsubscribers = [];

  try {
    // Listen to users collection
    const usersUnsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        console.log('👥 Users collection updated');
        callback({ type: 'users_updated', count: snapshot.size });
      }
    );

    // Listen to quizzes collection
    const quizzesUnsubscribe = onSnapshot(
      collection(db, 'quizzes'),
      (snapshot) => {
        console.log('📚 Quizzes collection updated');
        callback({ type: 'quizzes_updated', count: snapshot.size });
      }
    );

    unsubscribers.push(usersUnsubscribe, quizzesUnsubscribe);

    // Return cleanup function
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
      console.log('🔌 Real-time listeners cleaned up');
    };

  } catch (error) {
    console.error('❌ Error setting up real-time updates:', error);
    return () => {}; // Return empty cleanup function
  }
};

// User management functions
export const updateUserRole = async (userId, newRole) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      role: newRole,
      updatedAt: serverTimestamp()
    });
    console.log(`✅ User ${userId} role updated to ${newRole}`);
    return true;
  } catch (error) {
    console.error('❌ Error updating user role:', error);
    throw error;
  }
};

export const deleteUser = async (userId) => {
  try {
    await deleteDoc(doc(db, 'users', userId));
    console.log(`✅ User ${userId} deleted`);
    return true;
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    throw error;
  }
};

// Quiz management functions
export const updateQuizStatus = async (quizId, newStatus) => {
  try {
    await updateDoc(doc(db, 'quizzes', quizId), {
      status: newStatus,
      updatedAt: serverTimestamp()
    });
    console.log(`✅ Quiz ${quizId} status updated to ${newStatus}`);
    return true;
  } catch (error) {
    console.error('❌ Error updating quiz status:', error);
    throw error;
  }
};

export const deleteQuizGlobally = async (quizId) => {
  try {
    await runTransaction(db, async (transaction) => {
      // Delete quiz document
      transaction.delete(doc(db, 'quizzes', quizId));
      
      // Delete codes and submissions would need additional logic
      // This is a simplified version
    });
    console.log(`✅ Quiz ${quizId} deleted globally`);
    return true;
  } catch (error) {
    console.error('❌ Error deleting quiz globally:', error);
    throw error;
  }
};