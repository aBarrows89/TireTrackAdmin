"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../auth-context";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { admin, updateAdminState } = useAuth();

  const changePassword = useMutation(api.auth.changePassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from current password");
      return;
    }

    setIsLoading(true);

    const result = await changePassword({
      adminId: admin?.id as any,
      currentPassword,
      newPassword,
    });

    if (result.success) {
      updateAdminState({ forcePasswordChange: false });
      router.push("/");
    } else {
      setError(result.error || "Failed to change password");
    }

    setIsLoading(false);
  };

  if (!admin) {
    router.push("/login");
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="relative inline-block">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-amber-500/30 transform hover:scale-105 transition-transform">
              <svg className="w-11 h-11 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div className="absolute -right-1 -bottom-1 w-5 h-5 bg-amber-400 rounded-full border-4 border-slate-900 animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            Change Password
          </h1>
          <p className="text-slate-500 mt-2">Please set a new password to continue</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-xl">
          {/* Warning Banner */}
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-amber-400 text-sm">
              You must change your temporary password before continuing.
            </p>
          </div>

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
              <label className="block text-slate-400 text-sm font-medium mb-2">Current Password</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/80 border border-slate-700 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all text-white placeholder:text-slate-600"
                  placeholder="Your temporary password"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-sm font-medium mb-2">New Password</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/80 border border-slate-700 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all text-white placeholder:text-slate-600"
                  placeholder="At least 8 characters"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-sm font-medium mb-2">Confirm New Password</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/80 border border-slate-700 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all text-white placeholder:text-slate-600"
                  placeholder="Confirm new password"
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
                Changing Password...
              </>
            ) : (
              <>
                Change Password
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
