"use client";

import { useAuth } from "./auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function Protected({ children }: { children: React.ReactNode }) {
  const { admin, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !admin) {
      router.push("/login");
    } else if (!isLoading && admin?.forcePasswordChange) {
      router.push("/change-password");
    }
  }, [admin, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!admin || admin.forcePasswordChange) {
    return null;
  }

  return <>{children}</>;
}
