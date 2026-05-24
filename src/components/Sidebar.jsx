import React, { useState } from "react";
import { MdDashboard, MdSettings } from "react-icons/md";
import { BsStarFill } from "react-icons/bs";
import { MdManageAccounts } from "react-icons/md";

const navItems = [
  { label: "Dashboard",          shortLabel: "Dashboard", Icon: MdDashboard },
  { label: "Blogs",              shortLabel: "Blogs",     Icon: BsStarFill },
   { label: "View Authors",    shortLabel: "Authors",  Icon: MdManageAccounts },
  { label: "System Settings",    shortLabel: "Settings",  Icon: MdSettings },
  
];



export default function Sidebar({ activeItem, onNavClick }) {
  const [editing, setEditing] = useState(false);
  const [author, setAuthor] = useState({
    name: "Admin User Profile",
    role: "Executive Admin",
    email: "admin@clinical.io",
  });

  const handleNav = (label) => {
    if (label === "Edit Author") { setEditing(true); return; }
    onNavClick?.(label);
  };

  return (
    <>
      {/*  Desktop sidebar (md and up)  */}
      <aside className="hidden md:flex flex-col w-72 min-h-screen bg-gray-50 border-r border-gray-200">

        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="w-10 h-10 rounded-lg bg-teal-700 flex items-center justify-center flex-shrink-0 text-white text-xl">
            <BsStarFill />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-tight">Healzy</p>
            <p className="text-xs text-gray-500 uppercase tracking-widest">Admin Panel</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {navItems.map(({ label, Icon }) => {
            const isActive = (activeItem ?? "Blogs") === label;
            return (
              <button
                key={label}
                onClick={() => handleNav(label)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium
                            transition-all duration-150 text-left
                            ${isActive
                              ? "bg-teal-700 text-white"
                              : "text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                            }`}
              >
                <span className={`text-lg ${isActive ? "text-white" : "text-gray-400"}`}>
                  <Icon />
                </span>
                {label}
              </button>
            );
          })}

          {/* Edit Author nav item */}
         
        </nav>

        {/* Profile */}
        <div className="px-5 py-4 border-t border-gray-200 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-300 overflow-hidden flex-shrink-0">
            <img src="https://i.pravatar.cc/40?img=12" alt="Author" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{author.name}</p>
            <p className="text-xs text-gray-500 truncate">{author.role}</p>
          </div>
        </div>
      </aside>

      {/*  Mobile bottom nav (below md)  */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex bg-gray-50 border-t border-gray-200">
        {navItems.map(({ label, shortLabel, Icon }) => {
          const isActive = (activeItem ?? "Blogs") === label;
          return (
            <button
              key={label}
              onClick={() => handleNav(label)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1
                          text-[10px] font-medium border-none bg-transparent cursor-pointer transition-colors
                          ${isActive ? "text-teal-700" : "text-gray-400 hover:text-gray-700"}`}
            >
              <span className="text-xl"><Icon /></span>
              {shortLabel}
            </button>
          );
        })}
        {/* Edit Author in mobile nav too */}
        <button
          onClick={() => setEditing(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1
                     text-[10px] font-medium border-none bg-transparent cursor-pointer
                     text-gray-400 hover:text-gray-700 transition-colors"
        >
          <span className="text-xl"><MdManageAccounts /></span>
          Author
        </button>
      </nav>

      <div className="md:hidden h-16" />

      {/* Edit Author modal */}
      {editing && (
        <EditAuthorModal
          author={author}
          onSave={data => { setAuthor(data); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      )}
    </>
  );
}

