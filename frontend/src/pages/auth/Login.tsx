import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Printer, AlertCircle, Loader2 } from "lucide-react";

interface Props {
  onSwitchToRegister: () => void;
}

export const Login: React.FC<Props> = ({ onSwitchToRegister }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-pe-bg p-4">
      <div className="w-full max-w-md bg-pe-surface rounded-pe-md shadow-pe-card border border-pe-border p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-pe-sm bg-pe-accent text-white mb-3 shadow-sm">
            <Printer className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-semibold text-pe-text tracking-tight">PrintEasy</h1>
          <p className="text-sm font-normal text-pe-text-secondary mt-1">Digital College Printing Management System</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-pe-sm bg-[#FDEBED] border border-[#F8C8CC] text-[#B80012] text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-pe-text mb-1.5">College Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@college.edu"
              className="w-full px-3.5 py-2.5 border border-pe-border rounded-pe-sm text-sm text-pe-text placeholder:text-pe-text-secondary/60 bg-pe-surface focus:outline-none focus:ring-2 focus:ring-pe-accent/20 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-pe-text mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 border border-pe-border rounded-pe-sm text-sm text-pe-text placeholder:text-pe-text-secondary/60 bg-pe-surface focus:outline-none focus:ring-2 focus:ring-pe-accent/20 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] py-2.5 px-4 bg-pe-accent hover:bg-pe-accent-hover active:bg-pe-accent-pressed text-white font-semibold text-sm rounded-pe-sm transition disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In to PrintEasy"}
          </button>
        </form>

        {/* Demo Fast Fill Section */}
        <div className="mt-6 pt-5 border-t border-pe-border-subtle">
          <p className="text-xs font-semibold text-pe-text-secondary uppercase tracking-wider text-center mb-3">
            Quick Fill Demo Accounts
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleDemoFill("student@college.edu", "Password123!")}
              className="min-h-[44px] px-2 py-2 text-sm font-semibold text-pe-text bg-pe-surface hover:bg-pe-surface-secondary border border-pe-border rounded-pe-sm transition text-center shadow-sm"
            >
              🎓 Student
            </button>
            <button
              type="button"
              onClick={() => handleDemoFill("staff@college.edu", "Password123!")}
              className="min-h-[44px] px-2 py-2 text-sm font-semibold text-pe-text bg-pe-surface hover:bg-pe-surface-secondary border border-pe-border rounded-pe-sm transition text-center shadow-sm"
            >
              💼 Staff
            </button>
            <button
              type="button"
              onClick={() => handleDemoFill("admin@college.edu", "Password123!")}
              className="min-h-[44px] px-2 py-2 text-sm font-semibold text-pe-text bg-pe-surface hover:bg-pe-surface-secondary border border-pe-border rounded-pe-sm transition text-center shadow-sm"
            >
              🛡️ Admin
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-pe-text-secondary">
          Don't have an account?{" "}
          <button
            onClick={onSwitchToRegister}
            className="text-pe-accent hover:underline font-semibold"
          >
            Create account
          </button>
        </div>
      </div>
    </div>
  );
};
