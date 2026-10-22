import React, { useEffect } from "react";
import AdminDashboard from "../components/AdminDashboard";

export default function AdminDashboardPage() {
  useEffect(() => {
    document.title = "CTMO Admin Dashboard | HapsayDalan";

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
  }, []);

  return <AdminDashboard />;
}
