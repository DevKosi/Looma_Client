import { Link } from "react-router-dom";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <h1 className="text-4xl font-bold text-blue-700 mb-6">Welcome to Looma 🚀</h1>

      <p className="mb-8 text-gray-600 text-center max-w-md">
        A powerful quiz platform where students take and track quizzes, and departments host
        competitive assessments — fast, secure, and smart.
      </p>

      <div className="flex gap-4">
        <Link to="/register">
          <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg shadow transition">
            Register
          </button>
        </Link>

        <Link to="/login">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow transition">
            Login
          </button>
        </Link>
      </div>
    </div>
  );
}
