"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        if (result.forcePasswordChange) {
          router.push("/change-password");
        } else {
          router.push("/");
        }
      } else {
        setError(result.error || "Login failed");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "An error occurred");
    }

    setIsLoading(false);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo and branding */}
        <div className="text-center mb-8">
          <div className="relative inline-block">
            <div className="w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-cyan-500/30 transform hover:scale-105 transition-transform">
              <svg className="w-11 h-11 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div className="absolute -right-1 -bottom-1 w-5 h-5 bg-emerald-500 rounded-full border-4 border-slate-900" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            TireTrack Admin
          </h1>
          <p className="text-slate-500 mt-2">Sign in to your account</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-xl">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="block text-slate-400 text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/80 border border-slate-700 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all text-white placeholder:text-slate-600"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-sm font-medium mb-2">Password</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/80 border border-slate-700 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all text-white placeholder:text-slate-600"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-8 px-4 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-xl font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Sign In
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-6">
          TireTrack Admin Dashboard v1.0
        </p>
      </div>
    </main>
  );
}
