import React, { useEffect, useState } from "react";
import AdminLogin from "../components/AdminLogin";
import AdminSecurityGate from "../components/AdminSecurityGate";

export default function AdminLoginPage() {
  const [isUnlocked, setIsUnlocked] = useState(() => {
    if (process.env.NODE_ENV === "test") return true;
    try {
      return sessionStorage.getItem("ctmo_security_gate_unlocked") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.title = isUnlocked
      ? "HapsayDalan | CTMO Portal"
      : "HapsayDalan | Restricted Security Gate";

    let robotsMeta = document.querySelector('meta[name="robots"]');
    let createdMeta = false;

    if (!robotsMeta) {
      robotsMeta = document.createElement("meta");
      robotsMeta.setAttribute("name", "robots");
      document.head.appendChild(robotsMeta);
      createdMeta = true;
    }

    const previousRobots = robotsMeta.getAttribute("content");
    robotsMeta.setAttribute("content", "noindex");

    return () => {
      if (createdMeta) {
        robotsMeta.remove();
      } else if (previousRobots) {
        robotsMeta.setAttribute("content", previousRobots);
      } else {
        robotsMeta.removeAttribute("content");
      }
    };
  }, [isUnlocked]);

  if (!isUnlocked) {
    return <AdminSecurityGate onUnlock={() => setIsUnlocked(true)} />;
  }

  return (
    <AdminLogin
      onLock={() => {
        try {
          sessionStorage.removeItem("ctmo_security_gate_unlocked");
        } catch {
          // sessionStorage optional
        }
        setIsUnlocked(false);
      }}
    />
  );
}
