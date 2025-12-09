"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

type Admin = {
  id: string;
  email: string;
  name: string;
  role: "superadmin" | "admin" | "viewer";
  allowedLocations: string[];
  forcePasswordChange: boolean;
};

type AuthContextType = {
  admin: Admin | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; forcePasswordChange?: boolean }>;
  logout: () => void;
  updateAdminState: (updates: Partial<Admin>) => void;
  canManageAdmins: boolean;
  canEdit: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [adminId, setAdminId] = useState<string | null>(null);

  const loginMutation = useMutation(api.auth.login);
  const adminData = useQuery(
    api.auth.getAdmin,
    adminId ? { adminId: adminId as any } : "skip"
  );

  // Check for stored session on mount
  useEffect(() => {
    const stored = localStorage.getItem("adminSession");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setAdminId(parsed.id);
        setAdmin(parsed);
      } catch {
        localStorage.removeItem("adminSession");
      }
    }
    setIsLoading(false);
  }, []);

  // Update admin when query returns
  useEffect(() => {
    if (adminData) {
      const updatedAdmin = adminData as Admin;
      setAdmin(updatedAdmin);
      localStorage.setItem("adminSession", JSON.stringify(updatedAdmin));
    } else if (adminData === null && adminId) {
      localStorage.removeItem("adminSession");
      setAdminId(null);
      setAdmin(null);
    }
  }, [adminData, adminId]);

  const login = async (email: string, password: string) => {
    const result = await loginMutation({ email, password });
    if (result.success && result.admin) {
      localStorage.setItem("adminSession", JSON.stringify(result.admin));
      setAdminId(result.admin.id);
      setAdmin(result.admin as Admin);
      return { success: true, forcePasswordChange: result.admin.forcePasswordChange };
    }
    return { success: false, error: result.error };
  };

  const logout = () => {
    localStorage.removeItem("adminSession");
    setAdminId(null);
    setAdmin(null);
  };

  const updateAdminState = (updates: Partial<Admin>) => {
    if (admin) {
      const updated = { ...admin, ...updates };
      setAdmin(updated);
      localStorage.setItem("adminSession", JSON.stringify(updated));
    }
  };

  const canManageAdmins = admin?.role === "superadmin";
  const canEdit = admin?.role === "superadmin" || admin?.role === "admin";

  return (
    <AuthContext.Provider value={{ admin, isLoading, login, logout, updateAdminState, canManageAdmins, canEdit }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
