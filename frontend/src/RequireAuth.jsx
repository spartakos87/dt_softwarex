// RequireAuth.jsx
import { Navigate, Outlet } from "react-router-dom";

export default function RequireAuth() {
  const token = sessionStorage.getItem("token");
  return token ? <Outlet /> : <Navigate to="/" replace />;
}
