import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import LoginPage from "./pages/LoginPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import MapPage from "./pages/MapPage";
import SubstationListPage from "./pages/SubstationListPage";
import SubstationDetailPage from "./pages/SubstationDetailPage";
import SubstationEditPage from "./pages/SubstationEditPage";
import "./App.css";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />

      <Route
        path="/map"
        element={
          <RequireAuth>
            <MapPage />
          </RequireAuth>
        }
      />

      <Route
        path="/substations"
        element={
          <RequireAuth>
            <SubstationListPage />
          </RequireAuth>
        }
      />
      {/* /new before /:ssCode so it is not swallowed by the param route */}
      <Route
        path="/substations/new"
        element={
          <RequireAuth roles={["admin", "editor"]}>
            <SubstationEditPage />
          </RequireAuth>
        }
      />
      <Route
        path="/substations/:ssCode"
        element={
          <RequireAuth>
            <SubstationDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/substations/:ssCode/edit"
        element={
          <RequireAuth roles={["admin", "editor"]}>
            <SubstationEditPage />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/map" replace />} />
    </Routes>
  );
}
