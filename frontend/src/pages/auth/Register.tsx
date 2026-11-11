import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Printer, AlertCircle, Loader2 } from "lucide-react";

interface Props {
  onSwitchToLogin: () => void;
}

export const Register: React.FC<Props> = ({ onSwitchToLogin }) => {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email, password, name, role);
    } catch (err: any) {
      setError(err.message || "Failed to create account. Please check the fields.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-pe-bg p-4">
      <div className="w-full max-w-md bg-pe-surface rounded-pe-md shadow-pe-card border border-pe-border p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-pe-sm bg-pe-accent text-white mb-3 shadow-sm">
            <Printer className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-semibold text-pe-text tracking-tight">Create Account</h1>
          <p className="text-xs text-pe-text-secondary mt-1">Join PrintEasy College Print Center</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-pe-sm bg-[#FDEBED] border border-[#F8C8CC] text-[#D70015] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-pe-text mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jane Doe"
              className="w-full px-3.5 py-2.5 border border-pe-border rounded-pe-sm text-sm bg-pe-surface text-pe-text focus:outline-none focus:ring-2 focus:ring-pe-accent/20 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-pe-text mb-1">College Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@college.edu"
              className="w-full px-3.5 py-2.5 border border-pe-border rounded-pe-sm text-sm bg-pe-surface text-pe-text focus:outline-none focus:ring-2 focus:ring-pe-accent/20 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-pe-text mb-1">Password (min 8 chars)</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 border border-pe-border rounded-pe-sm text-sm bg-pe-surface text-pe-text focus:outline-none focus:ring-2 focus:ring-pe-accent/20 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-pe-text mb-1">Account Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-pe-border rounded-pe-sm text-sm bg-pe-surface text-pe-text focus:outline-none focus:ring-2 focus:ring-pe-accent/20 transition"
            >
              <option value="student">Student (Submit & track print jobs)</option>
              <option value="staff">Staff (Operator & queue management)</option>
              <option value="admin">Administrator (System config & audits)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[44px] py-2.5 px-4 bg-pe-accent hover:bg-pe-accent-hover active:bg-pe-accent-pressed text-white font-medium text-sm rounded-pe-sm transition disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Register"}
          </button>
        </form>

        <div className="mt-5 text-center text-xs text-pe-text-secondary">
          Already have an account?{" "}
          <button
            onClick={onSwitchToLogin}
            className="text-pe-accent hover:underline font-medium"
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
};
