import React, { useState } from "react";
import { auth, db } from "../firebase/firebaseConfig";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiMail, FiLock, FiArrowRight, FiAlertCircle, FiCheckCircle, FiEye, FiEyeOff, FiUser, FiShield } from "react-icons/fi";

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
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4 relative overflow-hidden"
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-primary-200/20 to-primary-300/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-accent1-200/20 to-accent1-300/10 rounded-full blur-3xl"></div>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden w-full max-w-md relative z-10"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-accent1-600 p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-600/20 to-accent1-600/20"></div>
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiShield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
            <p className="text-white/90 font-medium">Sign in to your account</p>
          </div>
        </div>

        {/* Messages */}
        <div className="px-8 pt-6">
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="status-error mb-6 flex items-center gap-3"
            >
              <FiAlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{errorMsg}</span>
            </motion.div>
          )}
          {isResetSent && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="status-success mb-6 flex items-center gap-3"
            >
              <FiCheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">Password reset link sent to your email. Please check your inbox and spam folder.</span>
            </motion.div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="px-8 pb-8 space-y-6">
          {/* Email */}
          <div className="space-y-2">
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2">
              <FiMail className="w-4 h-4" /> Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="input-field"
              placeholder="your@email.com"
            />
            {validationErrors.email && (
              <p className="text-red-500 text-xs font-medium">{validationErrors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-slate-700 text-sm font-semibold flex items-center gap-2">
              <FiLock className="w-4 h-4" /> Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="input-field pr-12"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-primary-600 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
              </button>
            </div>
            {validationErrors.password && (
              <p className="text-red-500 text-xs font-medium">{validationErrors.password}</p>
            )}
          </div>

          {/* Submit Button */}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            className={`w-full btn-primary flex items-center justify-center gap-2 ${
              loading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing In...
              </>
            ) : (
              <>
                Continue <FiArrowRight className="w-4 h-4" />
              </>
            )}
          </motion.button>
        </form>

        {/* Footer Links */}
        <div className="px-8 pb-8 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-slate-100 pt-6">
          <button
            onClick={handleForgotPassword}
            disabled={loading}
            className="text-primary-600 hover:text-primary-700 text-sm font-semibold transition-colors disabled:opacity-50"
          >
            Forgot password?
          </button>

          <div className="text-slate-600 text-sm">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-primary-600 hover:text-primary-700 font-semibold transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
