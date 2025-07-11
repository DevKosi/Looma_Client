import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import { Link } from "react-router-dom";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    setMsg({ type: "", text: "" });

    if (!email.trim()) {
      setMsg({ type: "error", text: "Please enter your registered email." });
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMsg({
        type: "success",
        text: "Password reset email sent! Check your inbox or spam.",
      });
      setEmail("");
    } catch (error) {
      setMsg({
        type: "error",
        text: error.message || "Failed to send reset email.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <form
        onSubmit={handleReset}
        className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg"
      >
        <h2 className="text-2xl font-bold text-center mb-6 text-blue-700">
          Reset Password
        </h2>

        {msg.text && (
          <p
            className={`mb-4 text-center ${
              msg.type === "error" ? "text-red-600" : "text-green-600"
            }`}
          >
            {msg.text}
          </p>
        )}

        <input
          type="email"
          placeholder="Enter your registered email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-6 p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          type="submit"
          disabled={loading}
          className={`w-full p-3 text-white font-bold rounded-md transition ${
            loading
              ? "bg-blue-300 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>

        <p className="text-center mt-6 text-sm text-gray-600">
          <Link to="/login" className="text-blue-600 hover:underline">
            Back to login
          </Link>
        </p>
      </form>
    </div>
  );
}
