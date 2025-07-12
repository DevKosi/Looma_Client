// src/pages/Splash.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { motion } from "framer-motion";

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate("/login"), 4000);
    return () => clearTimeout(timer);
  }, [navigate]);

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.3,
        when: "beforeChildren"
      }
    }
  };

  const item = {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 80,
        damping: 15
      }
    }
  };

  const logoAnimation = {
    hidden: { scale: 0.8, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 12,
        delay: 0.2
      }
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={container}
      className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 relative overflow-hidden"
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-primary-200/30 to-primary-300/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-accent1-200/30 to-accent1-300/20 rounded-full blur-3xl"></div>
      </div>

      {/* Main content container */}
      <div className="relative z-10 flex flex-col items-center justify-center max-w-md mx-auto text-center">
        {/* Lottie Animation Container */}
        <motion.div
          variants={logoAnimation}
          className="w-64 h-64 md:w-72 md:h-72 mb-8 relative"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary-100/50 to-accent1-100/50 rounded-full blur-2xl"></div>
          <div className="relative z-10">
            <DotLottieReact
              src="https://lottie.host/0c1127bb-0a90-4ff0-909a-333acce7ddae/2cdt6ZJh8i.lottie"
              loop
              autoplay
            />
          </div>
        </motion.div>

        {/* Text Content */}
        <motion.div 
          variants={item}
          className="space-y-6"
        >
          <motion.h1 
            className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-slate-800 via-primary-600 to-accent1-600 bg-clip-text text-transparent leading-tight"
            whileHover={{ scale: 1.02 }}
          >
            Welcome to Looma
          </motion.h1>
          
          <motion.p 
            className="text-lg md:text-xl text-slate-600 font-medium leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 1 }}
          >
            Smarter quizzes, smarter students.
          </motion.p>

          <motion.p 
            className="text-sm md:text-base text-slate-500 font-normal max-w-sm mx-auto leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 1 }}
          >
            Experience the future of education with our intelligent quiz platform designed for modern learning.
          </motion.p>
        </motion.div>

        {/* Progress Bar */}
        <motion.div 
          className="mt-12 w-72 md:w-80"
          variants={item}
        >
          <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner">
            <motion.div
              className="h-full bg-gradient-to-r from-primary-500 to-accent1-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 3.5, ease: "easeInOut" }}
            />
          </div>
          <motion.p 
            className="text-xs text-slate-500 mt-2 font-medium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2, duration: 0.5 }}
          >
            Loading your learning experience...
          </motion.p>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        variants={item}
      >
        <div className="text-center">
          <p className="text-slate-500/80 text-sm font-medium">
            © {new Date().getFullYear()} Looma Education
          </p>
          <p className="text-slate-400/60 text-xs mt-1">
            Empowering students through technology
          </p>
        </div>
      </motion.div>

      {/* Loading dots */}
      <motion.div
        className="absolute bottom-24 left-1/2 transform -translate-x-1/2 flex space-x-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-primary-400 rounded-full"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.2
            }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}
