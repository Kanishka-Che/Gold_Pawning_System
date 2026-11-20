import {
  LayoutDashboard,
  Users,
  Gem,
  Wallet,
  RefreshCw,
  FileText,
  Settings,
  LogOut,
  Menu,
  ChevronLeft,
} from "lucide-react";
import "./Sidebar.scss";

const menuItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Customers", icon: Users },
  { label: "Pawn Loans", icon: Gem },
  { label: "Payments", icon: Wallet },
  { label: "Renewals", icon: RefreshCw },
  { label: "Reports", icon: FileText },
  { label: "Settings", icon: Settings },
];

export default function Sidebar({
  activePage,
  setActivePage,
  collapsed,
  setCollapsed,
}) {
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Gem size={23} />
        </div>

        {!collapsed && (
          <div className="brand-text">
            <strong>Zriolab Gold</strong>
            <small>Pawning System</small>
          </div>
        )}

        <button
          className="collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label="Toggle sidebar"
        >
          {collapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <div className="menu-heading">
        {!collapsed && "MAIN MENU"}
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              className={`nav-item ${
                activePage === item.label ? "active" : ""
              }`}
              onClick={() => setActivePage(item.label)}
              title={item.label}
            >
              <Icon size={19} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <button
          className="nav-item"
          disabled
          title="Logout will be available after authentication"
        >
          <LogOut size={19} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}