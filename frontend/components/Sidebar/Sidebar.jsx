
import {
  LayoutDashboard,
  Users,
  Gem,
  Wallet,
  RefreshCw,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  HandCoins,
  CalendarClock,
} from "lucide-react";
import "./Sidebar.scss";


const menuItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Customers", icon: Users },
  { label: "Pawn Loans", icon: Gem },
  { label: "Payments", icon: Wallet },
  { label: "Renewals", icon: RefreshCw },
  { label: "Reports", icon: FileText },
  { label: "Redemptions", icon: HandCoins },
  { label: "Overdue", icon: CalendarClock },
  {
    label: "System Settings",
    icon: Settings,
    adminOnly: true,
  },
];




export default function Sidebar({
  activePage,
  setActivePage,
  collapsed,
  setCollapsed,
  onLogout,
  user,
}) {

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      
<div className="sidebar-brand">
  <button
    type="button"
    className="brand-icon"
    onClick={() => {
      if (collapsed) setCollapsed(false);
    }}
    title={collapsed ? "Expand sidebar" : "Zriolab Gold"}
    aria-label={collapsed ? "Expand sidebar" : "Zriolab Gold"}
  >
    <Gem size={23} />
  </button>

  {!collapsed && (
    <div className="brand-text">
      <strong>Zriolab Gold</strong>
      <small>Pawning System</small>
    </div>
  )}

  {!collapsed && (
    <button
      type="button"
      className="collapse-btn"
      onClick={() => setCollapsed(true)}
      title="Collapse sidebar"
      aria-label="Collapse sidebar"
    >
      <ChevronLeft size={18} />
    </button>
  )}
</div>


      <div className="menu-heading">
        {!collapsed && "MAIN MENU"}
      </div>

      <nav className="sidebar-nav">
        
{menuItems
  .filter((item) => !item.adminOnly || user?.role === "admin")
  .map((item) => {

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
    type="button"
    className="nav-item"
    onClick={onLogout}
    title="Logout"
  >
    <LogOut size={19} />
    {!collapsed && <span>Logout</span>}
  </button>
</div>
    </aside>
  );
}