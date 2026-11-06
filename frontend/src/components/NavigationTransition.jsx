import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PageLoadingScreen from "./PageLoadingScreen";

export default function NavigationTransition() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [transition, setTransition] = useState({ id: 0, duration: 720 });
  const previousPathRef = useRef(location.pathname);
  const isNavigatingRef = useRef(false);
  const isTest = process.env.NODE_ENV === "test";

  const startTransition = useCallback((path, duration = 700) => {
    if (isTest) return;
    setTransition((current) => ({ id: current.id + 1, duration }));
    setIsLoading(true);
    isNavigatingRef.current = true;
  }, [isTest]);

  const handleLoadingComplete = useCallback(() => {
    setIsLoading(false);
    isNavigatingRef.current = false;
  }, []);

  // Intercept all internal standard <a> link clicks
  useEffect(() => {
    if (isTest) return;

    const handleDocumentClick = (event) => {
      // Find closest anchor tag
      const anchor = event.target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Ignore external links, mailto, tel, javascript:, new tabs, or modifier keys
      if (
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:") ||
        href.startsWith("//") ||
        anchor.getAttribute("target") === "_blank" ||
        anchor.getAttribute("download") ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      ) {
        return;
      }

      // If it's a hash link on the same page, allow standard scrolling
      if (href.startsWith("#") || (href.startsWith("/#") && location.pathname === "/")) {
        return;
      }

      // Check if it is an internal route
      if (href.startsWith("/")) {
        event.preventDefault();

        // If clicking the link for the exact same page, show brief refresh animation
        if (href === location.pathname) {
          startTransition(href, 500);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }

        startTransition(href, 750);
        navigate(href);
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [location.pathname, navigate, startTransition, isTest]);

  // Handle route change when navigation is triggered outside of link clicks (e.g. popstate or programmatic)
  useEffect(() => {
    if (isTest) return;

    if (location.pathname !== previousPathRef.current) {
      if (!isNavigatingRef.current) {
        startTransition(location.pathname, 600);
      }
      previousPathRef.current = location.pathname;
    }
  }, [location.pathname, startTransition, isTest]);

  // Allow other components to trigger the loading animation via custom event
  useEffect(() => {
    const handleCustomTrigger = (event) => {
      const { path, duration } = event.detail || {};
      startTransition(path || location.pathname, duration || 700);
    };

    window.addEventListener("hapsay:show-loader", handleCustomTrigger);
    return () => {
      window.removeEventListener("hapsay:show-loader", handleCustomTrigger);
    };
  }, [location.pathname, startTransition]);

  if (isTest) return null;

  return (
    <PageLoadingScreen
      key={transition.id}
      active={isLoading}
      duration={transition.duration}
      onComplete={handleLoadingComplete}
    />
  );
}

