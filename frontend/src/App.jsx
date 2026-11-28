
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar/Sidebar.jsx";
import Header from "../components/Header/Header.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";
import Customers from "./pages/Customers/Customers.jsx";
import PawnLoans from "./pages/PawnLoans/PawnLoans.jsx";
import Payments from "./pages/Payments/Payments.jsx";
import Renewals from "./pages/Renewals/Renewals.jsx";
import Login from "./pages/Login/Login.jsx";
import { apiFetch } from "../utils/api.js";
import SystemSettings from "./pages/Settings/SystemSettings.jsx";
import Redemptions from
  "./pages/Redemptions/Redemptions.jsx";
  import Overdue from "./pages/Overdue/Overdue.jsx";
  import Reports from "./pages/Reports/Reports.jsx";
  import UserManagement from "./pages/UserManagement/UserManagement.jsx";
  import Profile from "./pages/Profile/Profile.jsx";
import "./App.scss";

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [collapsed, setCollapsed] = useState(false);

  const [auth, setAuth] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;


const checkAuthentication = async () => {
  try {
    const response = await apiFetch("/api/auth/session");

    if (!response.ok) {
      throw new Error("Session check failed");
    }

    const data = await response.json();

    if (!cancelled) {
      if (data.success && data.authenticated && data.user) {
        setAuth({ user: data.user });
      } else {
        setAuth(null);
      }
    }
  } catch (error) {
    console.error("Session check error:", error);

    if (!cancelled) {
      setAuth(null);
    }
  } finally {
    if (!cancelled) {
      setAuthLoading(false);
    }
  }
};


    checkAuthentication();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = (data) => {
    setAuth({ user: data.user });
    setActivePage("Dashboard");
  };

  const handleSessionEnded = () => {
  setAuth(null);
  setActivePage("Dashboard");
};

const handleProfileUpdated = (updatedUser) => {
  setAuth((previous) => {
    if (!previous?.user) {
      return previous;
    }

    if (
      String(previous.user.id) !==
      String(updatedUser.id)
    ) {
      return previous;
    }

    return {
      ...previous,

      user: {
        ...previous.user,
        ...updatedUser,
      },
    };
  });
};

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const response = await apiFetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      setAuth(null);
      setActivePage("Dashboard");
    } catch (error) {
      console.error("Logout error:", error);
      alert("Logout failed. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  };

  if (authLoading) {
    return (
      <div className="auth-loading">
        <p>Checking your session...</p>
      </div>
    );
  }

  if (!auth) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <div className="app-container">
        
<Sidebar
  activePage={activePage}
  setActivePage={setActivePage}
  collapsed={collapsed}
  setCollapsed={setCollapsed}
  user={auth.user}
/>


        <main className="main-content">
          <Header
  user={auth.user}
  setActivePage={setActivePage}
  onLogout={handleLogout}
  loggingOut={loggingOut}
/>

          <div className="page-content">
           
{activePage === "Dashboard" ? (
  <Dashboard />
) : activePage === "Customers" ? (
  <Customers />
) : activePage === "Pawn Loans" ? (
  <PawnLoans />
) : activePage === "Payments" ? (
  <Payments />
) : activePage === "Renewals" ? (
  <Renewals />
) :activePage === "Redemptions" ? (
  <Redemptions />
) :activePage === "Overdue" ? (
 <Overdue />
) : activePage === "Reports" ? (
  <Reports />
) : activePage === "My Profile" ? (
  <Profile
    mode="profile"
    onNavigate={setActivePage}
    onSessionEnded={handleSessionEnded}
    onProfileUpdated={handleProfileUpdated}
  />
) : activePage === "Change Password" ? (
  <Profile
    mode="password"
    onNavigate={setActivePage}
    onSessionEnded={handleSessionEnded}
    onProfileUpdated={handleProfileUpdated}
  />
) : activePage === "User Management" &&
  auth.user?.role === "admin" ? (
  <UserManagement currentUser={auth.user} />
) : activePage === "System Settings" &&
  auth.user?.role === "admin" ? (
  <SystemSettings />
) : (
  <div className="coming-soon">
    <h2>{activePage}</h2>
    <p>This module is under development.</p>
  </div>
)}

          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
