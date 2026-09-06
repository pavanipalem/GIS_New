import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/RequireAuth";
import LoginPage from "./pages/LoginPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import MapPage from "./pages/MapPage";
import SubstationListPage from "./pages/SubstationListPage";
import SubstationDetailPage from "./pages/SubstationDetailPage";
import SubstationEditPage from "./pages/SubstationEditPage";
import LineListPage from "./pages/LineListPage";
import LineDetailPage from "./pages/LineDetailPage";
import LineEditPage from "./pages/LineEditPage";
import TowerEditPage from "./pages/TowerEditPage";
import SolarPlantsPage from "./pages/SolarPlantsPage";
import EhvConsumersPage from "./pages/EhvConsumersPage";
import UsersPage from "./pages/UsersPage";
import HomePage from "./pages/HomePage";
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

      <Route
        path="/lines"
        element={
          <RequireAuth>
            <LineListPage />
          </RequireAuth>
        }
      />
      {/* /new before /:feederId so it is not swallowed by the param route */}
      <Route
        path="/lines/new"
        element={
          <RequireAuth roles={["admin", "editor"]}>
            <LineEditPage />
          </RequireAuth>
        }
      />
      <Route
        path="/lines/:feederId"
        element={
          <RequireAuth>
            <LineDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/lines/:feederId/edit"
        element={
          <RequireAuth roles={["admin", "editor"]}>
            <LineEditPage />
          </RequireAuth>
        }
      />
      <Route
        path="/lines/:feederId/towers/new"
        element={
          <RequireAuth roles={["admin", "editor"]}>
            <TowerEditPage />
          </RequireAuth>
        }
      />
      <Route
        path="/towers/:towerId/edit"
        element={
          <RequireAuth roles={["admin", "editor"]}>
            <TowerEditPage />
          </RequireAuth>
        }
      />

      <Route
        path="/solar-plants"
        element={
          <RequireAuth>
            <SolarPlantsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/ehv-consumers"
        element={
          <RequireAuth>
            <EhvConsumersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/users"
        element={
          <RequireAuth roles={["admin"]}>
            <UsersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
