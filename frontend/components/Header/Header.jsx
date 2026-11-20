import { Bell, CircleUserRound } from "lucide-react";
import "./Header.scss";

export default function Header() {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <span className="topbar-gold">Zriolab</span>
        {" "}GOLD PAWNING SYSTEM
      </div>

      <div className="topbar-actions">
        <div className="notification-icon">
          <Bell size={20} />
        </div>

        <div className="user-avatar">
          <CircleUserRound size={22} />
        </div>
      </div>
    </header>
  );
}