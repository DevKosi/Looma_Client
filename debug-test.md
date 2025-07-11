# Quick Test Guide for Looma Platform

## 🧪 Testing Steps

### 1. Open http://localhost:5173 in browser
### 2. Open Console (F12 → Console tab)
### 3. Paste this debug script:

```javascript
// Debug helper for Looma platform
console.log("🧪 LOOMA DEBUG HELPER LOADED");
console.log("=".repeat(50));

// Check if we're on quiz page
if (window.location.pathname.includes('/quiz/')) {
    console.log("📝 QUIZ PAGE DETECTED");
    console.log("- Check for user data logs during submission");
    console.log("- Look for 'Calculated values' in console");
}

// Check if we're on admin dashboard
if (window.location.pathname.includes('/admin')) {
    console.log("👨‍💼 ADMIN DASHBOARD DETECTED");
    console.log("- Go to Results tab to see processed data");
    console.log("- Look for 'Raw submission data' logs");
}

// Monitor localStorage for user data
const userData = localStorage.getItem('user');
if (userData) {
    console.log("👤 USER DATA FOUND:", JSON.parse(userData));
} else {
    console.log("❌ NO USER DATA IN LOCALSTORAGE");
}

console.log("=".repeat(50));
console.log("🔍 Start testing and watch console output above");
```

## 🎯 Test Scenarios

### A. Student Registration Test
1. Register new student: `testuser@email.com` / `EBSU/2024/DEBUG01`
2. Check console for registration success
3. Login and verify user data

### B. Quiz Submission Test  
1. Take any quiz as student
2. Watch console during submission
3. Look for these specific logs:
   - "Fetching user data for: [uid]"
   - "Calculated values - Score: X Total: Y Percentage: Z"
   - "Submission successful with ID: [id]"

### C. Admin Results Test
1. Login as admin
2. Go to "Quiz Results" tab
3. Select quiz and check console:
   - "Raw submission data: {...}"
   - "Processed results data: [...]"

## 🚨 Report These Issues
- Still seeing "Anonymous" registration numbers?
- Still seeing 0% percentages?
- Still seeing "No email" in results?
- Still seeing "N/A" for time spent?
- Any console errors?

## ✅ Expected Good Results
- Registration numbers: "EBSU/2024/DEBUG01"  
- Percentages: "67%" (actual calculated values)
- Emails: "testuser@email.com"
- Time spent: "2 mins" (actual time)