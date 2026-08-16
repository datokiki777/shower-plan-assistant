import { Suspense } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAppUiStore } from "@/app/providers/appUiStore";
import { IconButton } from "@/shared/ui/IconButton";
import "./AppShell.css";

const PRIMARY_NAV = [
  { to: "/", label: "მთავარი", icon: "🏠" },
  { to: "/jobs", label: "სამუშაოები", icon: "🧾" },
  { to: "/loading", label: "დატვირთვა", icon: "🚚" },
  { to: "/periods", label: "პერიოდები", icon: "👷" }
];

const SECONDARY_NAV = [
  { to: "/clients", label: "კლიენტები" },
  { to: "/groups", label: "ჯგუფები" },
  { to: "/templates", label: "შაბლონები" },
  { to: "/settings", label: "პარამეტრები" }
];

export function AppShell() {
  const secondaryMenuOpen = useAppUiStore((s) => s.secondaryMenuOpen);
  const toggleSecondaryMenu = useAppUiStore((s) => s.toggleSecondaryMenu);
  const closeSecondaryMenu = useAppUiStore((s) => s.closeSecondaryMenu);

  return (
    <div className="app-shell">
      <header className="app-shell__topbar">
        <span className="app-shell__brand">Plans</span>
        <IconButton label="მეტი" onClick={toggleSecondaryMenu}>
          ⋯
        </IconButton>
      </header>

      {secondaryMenuOpen && (
        <nav className="app-shell__secondary-menu" aria-label="დამატებითი ნავიგაცია">
          {SECONDARY_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={closeSecondaryMenu} className="app-shell__secondary-link">
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}

      <main className="app-shell__content">
        <Suspense fallback={<div className="app-shell__loading">იტვირთება…</div>}>
          <Outlet />
        </Suspense>
      </main>

      <nav className="app-shell__bottom-nav" aria-label="მთავარი ნავიგაცია">
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => `app-shell__nav-item${isActive ? " app-shell__nav-item--active" : ""}`}
          >
            <span aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
