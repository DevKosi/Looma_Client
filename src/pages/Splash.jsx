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
        staggerChildren: 0.2,
        when: "beforeChildren"
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 10
      }
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={container}
      className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#F8FAFC]" // Ghost White background
    >
      {/* Lottie Animation Container */}
      <motion.div
        variants={item}
        className="w-72 h-72 md:w-80 md:h-80 mb-8"
      >
        <DotLottieReact
          src="https://lottie.host/0c1127bb-0a90-4ff0-909a-333acce7ddae/2cdt6ZJh8i.lottie"
          loop
          autoplay
        />
      </motion.div>

      {/* Text Content */}
      <motion.div 
        variants={item}
        className="text-center space-y-4"
      >
        <motion.h1 
          className="text-4xl md:text-5xl font-bold text-[#1E293B]" // Charcoal text
          whileHover={{ scale: 1.02 }}
        >
          Welcome to Looma
        </motion.h1>
        
        <motion.p 
          className="text-lg text-[#6366F1] font-medium" // Electric Indigo secondary text
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
        >
          Smarter quizzes, smarter students.
        </motion.p>
      </motion.div>

      {/* Progress Bar */}
      <motion.div 
        className="mt-12 w-64"
        variants={item}
      >
        <div className="h-2 w-full bg-[#E2E8F0] rounded-full overflow-hidden"> {/* Light Slate background */}
          <motion.div
            className="h-full bg-[#6366F1]" // Electric Indigo fill
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 3.8, ease: "linear" }}
          />
        </div>
      </motion.div>

      {/* Footer */}
      <motion.div
        className="absolute bottom-8"
        variants={item}
      >
        <p className="text-[#1E293B]/80 text-sm">© {new Date().getFullYear()} Looma Education</p>
      </motion.div>
    </motion.div>
  );
}
