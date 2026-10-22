import { createContext, useContext, useState } from "react";

// Login has been removed for this build — the backend has no auth routes.
// This stub keeps existing components that call useAuth() (e.g. TopBar
// showing a user name) from crashing, without making any network calls.
const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user] = useState({ name: "Guest", email: "" });
  const [loading] = useState(false);

  const value = {
    user,
    mongoUser: user,
    loading,
    signup: async () => user,
    login: async () => user,
    logout: async () => {},
    updateUserProfile: async () => user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
