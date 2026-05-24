import React, { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import BlogPage from "./pages/Blog";
import AuthorsPage from "./pages/Authors";

const ITEM_TO_PATH = {
  Dashboard: "/dashboard",
  Blogs: "/blog",
  "View Authors": "/authors",
  "System Settings": "/settings",
};

const PATH_TO_ITEM = Object.fromEntries(
  Object.entries(ITEM_TO_PATH).map(([item, path]) => [path, item])
);

const DEFAULT_PATH = "/blog";

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (!PATH_TO_ITEM[currentPath]) {
      window.history.replaceState({}, "", DEFAULT_PATH);
      setCurrentPath(DEFAULT_PATH);
    }
  }, [currentPath]);

  const handleNavClick = (item) => {
    const nextPath = ITEM_TO_PATH[item];
    if (!nextPath || nextPath === currentPath) return;

    window.history.pushState({}, "", nextPath);
    setCurrentPath(nextPath);
  };

  const activeItem = PATH_TO_ITEM[currentPath] || "Blogs";

  return (
    <div className="flex min-h-screen font-sans bg-gray-100">
      <Sidebar activeItem={activeItem} onNavClick={handleNavClick} />

      {activeItem === "Blogs" ? (
        <BlogPage />
      ) : activeItem === "View Authors" ? (
        <AuthorsPage />
      ) : (
        <main className="flex-1 flex items-center justify-center text-gray-400 text-sm">
          <p>{activeItem} - coming soon</p>
        </main>
      )}
    </div>
  );
}