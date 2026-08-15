import { useContext } from "react";
import { AuthContextValue } from "./authContextValue";

export function useAuth() {
  const context = useContext(AuthContextValue);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
