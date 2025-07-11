import React, { useState } from "react";
import { auth, db } from "../firebase/firebaseConfig";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiMail, FiLock, FiArrowRight, FiAlertCircle, FiCheckCircle, FiEye, FiEyeOff } from "react-icons/fi";

export default function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [isResetSent, setIsResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const navigate = useNavigate();

  const validateForm = () => {
    const errors = {};
    
    if (!formData.email) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }
    
    if (!formData.password) {
      errors.password = "Password is required";
    } else if (formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear validation error when user starts typing
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: "" }));
    }
    
    // Clear general error message when user makes changes
    if (errorMsg) {
      setErrorMsg("");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setErrorMsg("");
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const uid = userCredential.user.uid;

      // Check user role in Firestore
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        setErrorMsg("Account not properly configured. Please contact support.");
        return;
      }

      const userData = docSnap.data();

      // Redirect based on role
      switch (userData.role) {
        case "student":
          navigate("/student-dashboard");
          break;
        case "admin":
          navigate("/admin-dashboard");
          break;
        case "superadmin":
          navigate("/superadmin-dashboard");
          break;
        default:
          setErrorMsg("Invalid role assigned. Please contact support.");
      }

      // Clear form
      setFormData({ email: "", password: "" });
    } catch (error) {
      console.error("Login error:", error);
      
      // Enhanced error handling
      let errorMessage = "Login failed. Please try again.";
      
      switch (error.code) {
        case "auth/wrong-password":
          errorMessage = "Incorrect password. Please check your password and try again.";
          break;
        case "auth/user-not-found":
          errorMessage = "No account found with this email address. Please check your email or create a new account.";
          break;
        case "auth/invalid-email":
          errorMessage = "Invalid email address format.";
          break;
        case "auth/user-disabled":
          errorMessage = "This account has been disabled. Please contact support.";
          break;
        case "auth/too-many-requests":
          errorMessage = "Too many failed login attempts. Please try again later or reset your password.";
          break;
        case "auth/network-request-failed":
          errorMessage = "Network error. Please check your internet connection and try again.";
          break;
        default:
          errorMessage = "An unexpected error occurred. Please try again or contact support.";
      }
      
      setErrorMsg(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setErrorMsg("Please enter your email address to reset your password.");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, formData.email);
      setIsResetSent(true);
      setErrorMsg("");
    } catch (error) {
      console.error("Password reset error:", error);
      
      let errorMessage = "Failed to send reset email. Please try again.";
      
      switch (error.code) {
        case "auth/user-not-found":
          errorMessage = "No account found with this email address.";
          break;
        case "auth/invalid-email":
          errorMessage = "Invalid email address format.";
          break;
        case "auth/too-many-requests":
          errorMessage = "Too many reset attempts. Please try again later.";
          break;
      }
      
      setErrorMsg(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl shadow-lg overflow-hidden w-full max-w-md"
      >
        {/* Header */}
        <div className="bg-[#6366F1] p-6 text-center">
          <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
          <p className="text-[#E2E8F0] mt-1">Sign in to your account</p>
        </div>

        {/* Messages */}
        <div className="px-6 pt-4">
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#F43F5E]/10 text-[#F43F5E] p-3 rounded-lg mb-4 text-sm flex items-center"
            >
              <span className="mr-2">⚠️</span> {errorMsg}
            </motion.div>
          )}
          {isResetSent && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#10B981]/10 text-[#10B981] p-3 rounded-lg mb-4 text-sm flex items-center"
            >
              <span className="mr-2">✓</span> Password reset link sent to your email. Please check your inbox and spam folder.
            </motion.div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="p-6 space-y-4">
          {/* Email */}
          <div className="space-y-1">
            <label className="text-[#1E293B] text-sm font-medium flex items-center">
              <FiMail className="mr-2" /> Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full p-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#6366F1] focus:border-transparent"
              placeholder="your@email.com"
            />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-[#1E293B] text-sm font-medium flex items-center">
              <FiLock className="mr-2" /> Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full p-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#6366F1] focus:border-transparent pr-10"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-[#6366F1]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors ${
              loading 
                ? 'bg-[#6366F1]/70 cursor-not-allowed' 
                : 'bg-[#6366F1] hover:bg-[#4F46E5] focus:ring-2 focus:ring-[#6366F1] focus:ring-offset-2'
            } flex items-center justify-center`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing In...
              </>
            ) : (
              <>
                Continue <FiArrowRight className="ml-2" />
              </>
            )}
          </motion.button>
        </form>

        {/* Footer Links */}
        <div className="px-6 pb-6 flex flex-col sm:flex-row justify-between items-center gap-2">
          <button
            onClick={handleForgotPassword}
            disabled={loading}
            className="text-[#6366F1] hover:text-[#4F46E5] text-sm font-medium transition-colors disabled:opacity-50"
          >
            Forgot password?
          </button>

          <div className="text-[#64748B] text-sm">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-[#6366F1] hover:text-[#4F46E5] font-medium"
            >
              Sign up
            </Link>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
