"use client";
import React from "react";

export default function SidebarHeader() {
  return (
    <div className="px-6 pt-8 pb-4 border-b border-[#30363D] flex flex-col gap-6 bg-[#161B22]">
      {/* App Logo/Icon */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#FF0033] rounded-lg flex items-center justify-center text-white font-bold text-xl">YT</div>
        <div className="flex flex-col">
          <h1 className="text-lg font-bold">YouTube Summary</h1>
          <button className="bg-[#FF0033] hover:bg-[#FF0033]/90 text-white font-medium text-[14px] rounded-lg px-4 py-2 w-full transition-colors mb-2 font-sans">
            New Summary
          </button>
        </div>
      </div>
      {/* Chats Section Header */}
      <div className="text-[#8B949E] text-xs font-medium mb-1 mt-2 font-sans">Chats</div>
    </div>
  );
} 