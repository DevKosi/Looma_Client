// src/pages/SuperAdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FiBarChart2, 
  FiCheckCircle, 
  FiAlertTriangle, 
  FiUsers,
  FiBook,
  FiClock,
  FiSearch
} from 'react-icons/fi';
import { db } from '../firebase/firebaseConfig';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeQuizzes: 0,
    pendingApprovals: 0,
    departments: 0
  });
  const [pendingQuizzes, setPendingQuizzes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState({
    stats: true,
    quizzes: true
  });

  // Fetch platform stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Get total users
        const usersQuery = query(collection(db, 'users'));
        const usersSnapshot = await getDocs(usersQuery);
        
        // Get quizzes
        const quizzesQuery = query(collection(db, 'quizzes'));
        const quizzesSnapshot = await getDocs(quizzesQuery);
        
        // Get departments
        const deptQuery = query(collection(db, 'departments'));
        const deptSnapshot = await getDocs(deptQuery);

        const pending = quizzesSnapshot.docs.filter(
          q => q.data().status === 'pending'
        ).length;

        setStats({
          totalUsers: usersSnapshot.size,
          activeQuizzes: quizzesSnapshot.size - pending,
          pendingApprovals: pending,
          departments: deptSnapshot.size
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(prev => ({ ...prev, stats: false }));
      }
    };

    // Fetch pending quizzes
    const fetchPendingQuizzes = async () => {
      try {
        const q = query(
          collection(db, 'quizzes'),
          where('status', '==', 'pending')
        );
        const querySnapshot = await getDocs(q);
        setPendingQuizzes(querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })));
      } catch (error) {
        console.error("Error fetching quizzes:", error);
      } finally {
        setLoading(prev => ({ ...prev, quizzes: false }));
      }
    };

    fetchStats();
    fetchPendingQuizzes();
  }, []);

  const handleApproveQuiz = async (quizId) => {
    try {
      await updateDoc(doc(db, 'quizzes', quizId), {
        status: 'approved',
        approvedAt: new Date()
      });
      setPendingQuizzes(prev => prev.filter(q => q.id !== quizId));
      setStats(prev => ({
        ...prev,
        pendingApprovals: prev.pendingApprovals - 1,
        activeQuizzes: prev.activeQuizzes + 1
      }));
    } catch (error) {
      console.error("Error approving quiz:", error);
    }
  };

  const handleRejectQuiz = async (quizId) => {
    try {
      await updateDoc(doc(db, 'quizzes', quizId), {
        status: 'rejected',
        rejectedAt: new Date()
      });
      setPendingQuizzes(prev => prev.filter(q => q.id !== quizId));
      setStats(prev => ({
        ...prev,
        pendingApprovals: prev.pendingApprovals - 1
      }));
    } catch (error) {
      console.error("Error rejecting quiz:", error);
    }
  };

  const filteredQuizzes = pendingQuizzes.filter(quiz =>
    quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quiz.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[#F8FAFC] p-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#1E293B]">Super Admin Dashboard</h1>
          <p className="text-[#64748B]">Platform oversight and management</p>
        </div>
        <div className="relative mt-4 md:mt-0 w-full md:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="text-[#64748B]" />
          </div>
          <input
            type="text"
            placeholder="Search quizzes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-[#E2E8F0] rounded-lg focus:ring-2 focus:ring-[#6366F1] focus:border-transparent"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          icon={<FiUsers className="text-[#6366F1]" size={24} />}
          title="Total Users"
          value={stats.totalUsers}
          loading={loading.stats}
          color="bg-[#6366F1]/10"
        />
        <StatCard 
          icon={<FiBook className="text-[#10B981]" size={24} />}
          title="Active Quizzes"
          value={stats.activeQuizzes}
          loading={loading.stats}
          color="bg-[#10B981]/10"
        />
        <StatCard 
          icon={<FiAlertTriangle className="text-[#F59E0B]" size={24} />}
          title="Pending Approvals"
          value={stats.pendingApprovals}
          loading={loading.stats}
          color="bg-[#F59E0B]/10"
        />
        <StatCard 
          icon={<FiBarChart2 className="text-[#0EA5E9]" size={24} />}
          title="Departments"
          value={stats.departments}
          loading={loading.stats}
          color="bg-[#0EA5E9]/10"
        />
      </div>

      {/* Pending Approvals Section */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[#E2E8F0]">
          <h2 className="text-xl font-semibold text-[#1E293B] flex items-center">
            <FiClock className="mr-2 text-[#F59E0B]" />
            Quizzes Pending Approval ({pendingQuizzes.length})
          </h2>
        </div>

        {loading.quizzes ? (
          <div className="p-6 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#6366F1]"></div>
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <div className="p-6 text-center text-[#64748B]">
            {searchTerm ? 'No matching quizzes found' : 'No quizzes pending approval'}
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {filteredQuizzes.map((quiz) => (
              <motion.div
                key={quiz.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 flex flex-col md:flex-row md:items-center justify-between"
              >
                <div className="mb-4 md:mb-0">
                  <h3 className="font-medium text-[#1E293B]">{quiz.title}</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="text-sm px-2 py-1 bg-[#E2E8F0] rounded-full text-[#1E293B]">
                      {quiz.department}
                    </span>
                    <span className="text-sm px-2 py-1 bg-[#E2E8F0] rounded-full text-[#1E293B]">
                      {quiz.questions?.length || 0} questions
                    </span>
                    <span className="text-sm px-2 py-1 bg-[#E2E8F0] rounded-full text-[#1E293B]">
                      Created by: {quiz.createdBy || 'Admin'}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleApproveQuiz(quiz.id)}
                    className="px-4 py-2 bg-[#10B981] text-white rounded-lg flex items-center"
                  >
                    <FiCheckCircle className="mr-2" /> Approve
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleRejectQuiz(quiz.id)}
                    className="px-4 py-2 bg-[#F43F5E] text-white rounded-lg flex items-center"
                  >
                    <FiAlertTriangle className="mr-2" /> Reject
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Additional sections can be added here for:
         - User management
         - Department management
         - Platform analytics
      */}
    </motion.div>
  );
}

// StatCard Component
const StatCard = ({ icon, title, value, loading, color }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className={`p-6 rounded-xl ${color} flex items-center`}
  >
    <div className="p-3 rounded-full bg-white mr-4">
      {icon}
    </div>
    <div>
      <p className="text-sm text-[#64748B]">{title}</p>
      {loading ? (
        <div className="h-8 w-16 bg-[#E2E8F0] rounded mt-1 animate-pulse"></div>
      ) : (
        <h3 className="text-2xl font-bold text-[#1E293B]">{value}</h3>
      )}
    </div>
  </motion.div>
);
