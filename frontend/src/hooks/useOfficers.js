import { useEffect, useState } from "react";
import API from "../services/api";

export default function useOfficers(version) {
  const [officers, setOfficers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    setLoading(true);
    API.get("admin/officers/").then(({ data }) => {
      if (!Array.isArray(data)) throw new Error("Invalid officer list");
      if (alive) { setOfficers(data); setError(""); }
    }).catch(() => {
      if (alive) setError("Could not load officers. Refresh the officer list to try again.");
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [version]);
  return { officers, loading, error };
}
