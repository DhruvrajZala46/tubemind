"use client";
import React from "react";

export default function NewDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-[#000000] font-sans">
      <main className="w-full flex items-center justify-center">
        {children}
      </main>
    </div>
  );
} 
