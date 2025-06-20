"use client";
import React from "react";

export default function SidebarProfile() {
  return (
    <div className="px-6 py-4 border-t border-[#30363D] flex items-center gap-3 bg-[#161B22] sticky bottom-0">
      <div className="w-9 h-9 rounded-full bg-[#21262D] flex items-center justify-center text-[#F0F6FC] font-bold text-lg font-sans">DZ</div>
      <div className="flex-1">
        <div className="text-[#F0F6FC] font-medium text-[14px] leading-tight font-sans">Dhruvraj Zala</div>
        <div className="text-[#8B949E] text-xs font-normal leading-tight font-sans">Free plan</div>
      </div>
      <div className="text-[#8B949E] text-lg cursor-pointer ml-2">▼</div>
    </div>
  );
} 