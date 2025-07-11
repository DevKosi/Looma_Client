import React, { useState } from "react";
import { auth, db } from "../firebase/firebaseConfig";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiUser, FiMail, FiLock, FiBook, FiAward } from "react-icons/fi";

export default function Register() {
  const [formData, setFormData] = useState({
    fullName: "",
    regNumber: "",
    department: "",
    email: "",
    password: ""
  });
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const departments = [
    "Physics", "Chemistry", "Biology", "Computer Science",
    "Mathematics", "Statistics", "Engineering", "Geology",
    "Applied Biology", "Microbiology", "Biochemistry", "Others"
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setLoading(true);

    try {
      // 1. Create Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );
      const uid = userCredential.user.uid;

      // 2. Save profile to Firestore
      await setDoc(doc(db, "users", uid), {
        fullName: formData.fullName,
        regNumber: formData.regNumber,
        department: formData.department,
        email: formData.email,
        role: "student",
        createdAt: new Date()
      });

      setSuccessMsg("Registration successful! Redirecting...");
      setTimeout(() => navigate("/login"), 2000);
      
      // Clear form
      setFormData({
        fullName: "",
        regNumber: "",
        department: "",
        email: "",
        password: ""
      });
    } catch (error) {
      setErrorMsg(
        error.message.includes("email-already-in-use")
          ? "Email already registered"
          : error.message.includes("weak-password")
          ? "Password should be at least 6 characters"
          : "Registration failed. Please try again."
      );
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
          <h2 className="text-2xl font-bold text-white">Create Your Account</h2>
          <p className="text-[#E2E8F0] mt-1">Join thousands of students using Looma</p>
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
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#10B981]/10 text-[#10B981] p-3 rounded-lg mb-4 text-sm flex items-center"
            >
              <span className="mr-2">✓</span> {successMsg}
            </motion.div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-[#1E293B] text-sm font-medium flex items-center">
              <FiUser className="mr-2" /> Full Name
            </label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              className="w-full p-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#6366F1] focus:border-transparent"
              placeholder="John Doe"
            />
          </div>

          {/* Registration Number */}
          <div className="space-y-1">
            <label className="text-[#1E293B] text-sm font-medium flex items-center">
              <FiAward className="mr-2" /> Registration Number
            </label>
            <input
              type="text"
              name="regNumber"
              value={formData.regNumber}
              onChange={handleChange}
              required
              className="w-full p-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#6366F1] focus:border-transparent"
              placeholder="EBSU/2023/01912"
            />
          </div>

          {/* Department */}
          <div className="space-y-1">
            <label className="text-[#1E293B] text-sm font-medium flex items-center">
              <FiBook className="mr-2" /> Department
            </label>
            <select
              name="department"
              value={formData.department}
              onChange={handleChange}
              required
              className="w-full p-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#6366F1] focus:border-transparent text-[#1E293B]"
            >
              <option value="">Select your department</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

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
              minLength={6}
              className="w-full p-3 border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#6366F1] focus:border-transparent"
              placeholder="At least 6 characters"
            />
          </div>

          {/* Submit Button */}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-white ${
              loading ? 'bg-[#6366F1]/80' : 'bg-[#6366F1] hover:bg-[#6366F1]/90'
            } transition-colors`}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              "Register Now"
            )}
          </motion.button>
        </form>

        {/* Footer */}
        <div className="px-6 pb-6 text-center">
          <p className="text-[#64748B] text-sm">
            Already have an account?{" "}
            <Link 
              to="/login" 
              className="text-[#6366F1] hover:underline font-medium"
            >
              Sign in here
            </Link>
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
