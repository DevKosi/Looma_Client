import React, { useState } from "react";
import { auth, db } from "../firebase/firebaseConfig";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiMail, FiLock, FiArrowRight, FiAlertCircle } from "react-icons/fi";

export default function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [isResetSent, setIsResetSent] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
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
        setErrorMsg("Account not properly configured. Contact support.");
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
          setErrorMsg("Invalid role assigned. Contact support.");
      }

      // Clear form
      setFormData({ email: "", password: "" });
    } catch (error) {
      console.error(error);
      setErrorMsg(
        error.code === "auth/wrong-password"
          ? "Incorrect password"
          : error.code === "auth/user-not-found"
            ? "No account found with this email"
            : "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setErrorMsg("Please enter your email to reset password");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, formData.email);
      setIsResetSent(true);
      setErrorMsg("");
    } catch (error) {
      console.error(error);
      setErrorMsg("Failed to send reset email. Please try again.");
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
        transition={{ delay: 0.1 }}
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
              <FiAlertCircle className="mr-2" /> {errorMsg}
            </motion.div>
          )}
          {isResetSent && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#10B981]/10 text-[#10B981] p-3 rounded-lg mb-4 text-sm"
            >
              Password reset link sent to your email
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
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full p-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#6366F1] focus:border-transparent"
              placeholder="Enter your password"
            />
          </div>

          {/* Submit Button */}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white ${loading ? 'bg-[#6366F1]/80' : 'bg-[#6366F1] hover:bg-[#6366F1]/90'
              } transition-colors flex items-center justify-center`}
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
            className="text-[#6366F1] hover:text-[#0EA5E9] text-sm font-medium transition-colors"
          >
            Forgot password?
          </button>

          <div className="text-[#64748B] text-sm">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-[#6366F1] hover:underline font-medium"
            >
              Sign up
            </Link>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
