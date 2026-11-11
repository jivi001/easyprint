import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole, AuthResponse } from "../types";
import { api } from "../services/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = localStorage.getItem("printeasy_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .getCurrentUser()
      .then((u) => setUser(u))
      .catch(() => {
        localStorage.removeItem("printeasy_token");
        localStorage.removeItem("printeasy_user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const authData: AuthResponse = await api.login({ email, password });
    localStorage.setItem("printeasy_token", authData.access_token);
    const currentUser = await api.getCurrentUser();
    setUser(currentUser);
    localStorage.setItem("printeasy_user", JSON.stringify(currentUser));
  };

  const register = async (email: string, password: string, name: string, role?: string) => {
    await api.register({ email, password, name, role });
    // Automatically log in after registration
    await login(email, password);
  };

  const logout = () => {
    localStorage.removeItem("printeasy_token");
    localStorage.removeItem("printeasy_user");
    setUser(null);
  };

  const hasRole = (role: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    if (Array.isArray(role)) {
      return role.includes(user.role);
    }
    return user.role === role;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!user,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
