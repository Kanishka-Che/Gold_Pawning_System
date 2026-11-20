
import { useState } from "react";
import Sidebar from "../components/Sidebar/Sidebar.jsx";
import Header from "../components/Header/Header.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";
import Customers from "./pages/Customers/Customers.jsx";
import Login from "./pages/Login/Login.jsx";
import "./App.scss";

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [collapsed, setCollapsed] = useState(false);

  const [auth, setAuth] = useState(() => {
    const token = sessionStorage.getItem("sigiri_token");
    const userString = sessionStorage.getItem("sigiri_user");

    if (!token || !userString) return null;

    try {
      return {
        token,
        user: JSON.parse(userString),
      };
    } catch {
      sessionStorage.removeItem("sigiri_token");
      sessionStorage.removeItem("sigiri_user");
      return null;
    }
  });

  const handleLogin = (data) => {
    sessionStorage.setItem("sigiri_token", data.token);
    sessionStorage.setItem(
      "sigiri_user",
      JSON.stringify(data.user)
    );

    setAuth({
      token: data.token,
      user: data.user,
    });

    setActivePage("Dashboard");
  };

  const handleLogout = () => {
    sessionStorage.removeItem("sigiri_token");
    sessionStorage.removeItem("sigiri_user");

    setAuth(null);
    setActivePage("Dashboard");
  };

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
        />

        <main className="main-content">
          <Header />

          <div className="page-content">
            {activePage === "Dashboard" ? (
              <Dashboard />
            ) : activePage === "Customers" ? (
              <Customers />
            ) : (
              <div className="coming-soon">
                <h2>{activePage}</h2>
                <p>This module is under development.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        style={{
          position: "fixed",
          bottom: 18,
          right: 18,
          zIndex: 1000,
          padding: "11px 18px",
          background: "#f4c430",
          color: "#321017",
          border: "none",
          borderRadius: 9,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Logout ({auth.user.username})
      </button>
    </div>
  );
}

export default App;
