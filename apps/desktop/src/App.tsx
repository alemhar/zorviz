import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@zorviz/ui";
import { useAuthStore } from "./stores/auth";
import LoginPage from "./pages/login";
import DashboardPage from "./pages/dashboard";
import RepairPage from "./pages/repair";
import "@zorviz/ui/src/styles.css";

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <HashRouter>
        <Routes>
          <Route
            path="/login"
            element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />}
          />
          <Route
            path="/"
            element={isAuthenticated ? <DashboardPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/repair"
            element={isAuthenticated ? <RepairPage /> : <Navigate to="/login" />}
          />
        </Routes>
      </HashRouter>
    </ThemeProvider>
  );
}

export default App;
