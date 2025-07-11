// Debug utilities for Looma platform
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase/firebaseConfig';

// Debug: Check user data in Firestore
export const debugUserData = async () => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log("❌ NO USER AUTHENTICATED");
      return null;
    }

    console.log("🔍 DEBUGGING USER DATA:");
    console.log("Auth User:", {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName
    });

    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      console.log("✅ FIRESTORE USER DATA:", userData);
      return userData;
    } else {
      console.log("❌ NO USER DOCUMENT IN FIRESTORE");
      return null;
    }
  } catch (error) {
    console.error("❌ ERROR FETCHING USER DATA:", error);
    return null;
  }
};

// Debug: Check quiz submissions
export const debugQuizSubmissions = async (quizId) => {
  try {
    console.log(`🔍 DEBUGGING SUBMISSIONS FOR QUIZ: ${quizId}`);
    
    const submissionsRef = collection(db, 'quizzes', quizId, 'submissions');
    const snapshot = await getDocs(submissionsRef);
    
    console.log(`📊 FOUND ${snapshot.size} SUBMISSIONS:`);
    
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`Submission ${index + 1}:`, {
        id: doc.id,
        regNumber: data.regNumber,
        percentage: data.percentage,
        email: data.email,
        timeSpent: data.timeSpent,
        submittedAt: data.submittedAt
      });
    });

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("❌ ERROR FETCHING SUBMISSIONS:", error);
    return [];
  }
};

// Debug: Validate submission data
export const validateSubmissionData = (submissionData) => {
  console.log("🔍 VALIDATING SUBMISSION DATA:");
  
  const checks = {
    regNumber: submissionData.regNumber !== 'Anonymous' && submissionData.regNumber,
    email: submissionData.email !== 'No email provided' && submissionData.email,
    percentage: typeof submissionData.percentage === 'number' && submissionData.percentage >= 0,
    timeSpent: typeof submissionData.timeSpent === 'number' && submissionData.timeSpent >= 0,
    score: typeof submissionData.score === 'number' && submissionData.score >= 0,
    total: typeof submissionData.total === 'number' && submissionData.total > 0
  };

  Object.entries(checks).forEach(([field, isValid]) => {
    console.log(`${isValid ? '✅' : '❌'} ${field}:`, submissionData[field]);
  });

  const allValid = Object.values(checks).every(Boolean);
  console.log(`${allValid ? '✅' : '❌'} OVERALL VALIDATION:`, allValid ? 'PASSED' : 'FAILED');
  
  return { isValid: allValid, checks, data: submissionData };
};

// Debug: Test calculation functions
export const testCalculations = (correct, total, timeLimit, timeLeft) => {
  console.log("🔍 TESTING CALCULATIONS:");
  
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  const timeSpentInSeconds = Math.max(0, (timeLimit * 60) - (timeLeft || 0));
  const timeSpentInMinutes = Math.round(timeSpentInSeconds / 60);

  console.log("📊 CALCULATION RESULTS:");
  console.log(`Score: ${correct}/${total}`);
  console.log(`Percentage: ${percentage}%`);
  console.log(`Time Spent: ${timeSpentInSeconds}s (${timeSpentInMinutes}m)`);
  console.log(`Time Limit: ${timeLimit} minutes`);
  console.log(`Time Left: ${timeLeft} seconds`);

  return {
    score: correct,
    total,
    percentage,
    timeSpent: timeSpentInSeconds,
    timeSpentMinutes: timeSpentInMinutes
  };
};

// Global debug functions (attach to window for easy access)
if (typeof window !== 'undefined') {
  window.debugLooma = {
    checkUser: debugUserData,
    checkSubmissions: debugQuizSubmissions,
    validateData: validateSubmissionData,
    testCalc: testCalculations
  };
  
  console.log("🛠️ LOOMA DEBUG TOOLS LOADED!");
  console.log("Use: window.debugLooma.checkUser() to debug user data");
  console.log("Use: window.debugLooma.checkSubmissions('quizId') to debug submissions");
}