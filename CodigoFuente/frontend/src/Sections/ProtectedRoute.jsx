// CodigoFuente/frontend/src/sections/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = !!localStorage.getItem("token"); // adapt to your auth logic
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default ProtectedRoute;