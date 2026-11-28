
import { useEffect, useRef, useState } from "react";

import {
  Bell,
  ChevronDown,
  Users,
  KeyRound,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import UserAvatar from
  "../UserAvatar/UserAvatar.jsx";

import "./Header.scss";

export default function Header({
  user,
  setActivePage,
  onLogout,
  loggingOut = false,
}) {
  const [profileOpen, setProfileOpen] = useState(false);

  const profileRef = useRef(null);
  const triggerRef = useRef(null);

  const isAdmin = user?.role === "admin";

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!profileOpen) return;

    const handleOutsideClick = (event) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener(
      "pointerdown",
      handleOutsideClick
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handleOutsideClick
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [profileOpen]);

  const handleNavigation = (page) => {
    setProfileOpen(false);
    setActivePage(page);
  };

  const handleLogout = async () => {
    if (loggingOut) return;

    setProfileOpen(false);
    await onLogout();
  };

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

        <div
          className="profile-wrapper"
          ref={profileRef}
        >
          <button
            ref={triggerRef}
            type="button"
            className={`profile-trigger ${
              profileOpen ? "open" : ""
            }`}
            onClick={() =>
              setProfileOpen((previous) => !previous)
            }
            aria-expanded={profileOpen}
            aria-controls="header-profile-dropdown"
            aria-label="Toggle account options"
          >
            <UserAvatar
  user={user}
  size={38}
/>

            <span className="profile-trigger-info">
              <strong>{user?.username}</strong>
              <small>
                {isAdmin ? "Administrator" : "Staff"}
              </small>
            </span>

            <ChevronDown
              size={16}
              className="profile-chevron"
            />
          </button>

          {profileOpen && (
            <div
              className="profile-dropdown"
              id="header-profile-dropdown"
            >
              <div className="profile-dropdown-header">
                <UserAvatar
  user={user}
  size={50}
/>

                <div className="dropdown-user-info">
                  <strong>{user?.username}</strong>

                  <span className="dropdown-role">
                    {isAdmin ? (
                      <ShieldCheck size={14} />
                    ) : (
                      <UserRound size={14} />
                    )}

                    {isAdmin
                      ? "Administrator"
                      : "Staff / Cashier"}
                  </span>
                </div>
              </div>

              <div className="profile-divider" />

              <div className="profile-menu-items">
                <button
  type="button"
  className="profile-menu-item"
  onClick={() =>
    handleNavigation("My Profile")
  }
>
  <UserRound size={18} />
  <span>My Profile</span>
</button>

                {isAdmin && (
                  <button
                    type="button"
                    className="profile-menu-item"
                    onClick={() =>
                      handleNavigation("User Management")
                    }
                  >
                    <Users size={18} />
                    <span>User Management</span>
                  </button>
                )}

                <button
  type="button"
  className="profile-menu-item"
  onClick={() =>
    handleNavigation("Change Password")
  }
>
  <KeyRound size={18} />
  <span>Change Password</span>
</button>
              </div>

              <div className="profile-divider" />

              <button
                type="button"
                className="profile-menu-item logout-item"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                <LogOut size={18} />

                <span>
                  {loggingOut
                    ? "Logging out..."
                    : "Logout"}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
