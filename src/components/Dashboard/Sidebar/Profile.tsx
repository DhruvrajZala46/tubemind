"use client";
import React from "react";

export default function SidebarProfile() {
  return (
    <div className="px-6 py-4 border-t border-[#3A3A3A] flex items-center gap-3 bg-[#000000] sticky bottom-0">
      <div className="w-9 h-9 rounded-full bg-[#303030] flex items-center justify-center text-[#FFFFFF] font-bold text-lg font-sans">DZ</div>
      <div className="flex-1">
        <div className="text-[#FFFFFF] font-medium text-[14px] leading-tight font-sans">Dhruvraj Zala</div>
        <div className="text-[#C4C4C4] text-xs font-normal leading-tight font-sans">Free plan</div>
      </div>
      <div className="text-[#C4C4C4] text-lg cursor-pointer ml-2">▼</div>
    </div>
  );
} 
