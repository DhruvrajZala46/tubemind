"use client";
import React from "react";

export default function SidebarHeader() {
  return (
    <div className="px-6 pt-8 pb-4 border-b border-[#3A3A3A] flex flex-col gap-6 bg-[#000000]">
      {/* App Logo/Icon */}
      <div className="flex items-center gap-4">
        <a href="/" className="inline-block">
          <img src="/logo.svg" alt="TubeMind Logo" className="w-12 h-12 rounded-lg" />
        </a>
        <div className="flex flex-col justify-center">
          <h1 className="text-lg font-bold" style={{ fontFamily: 'EB Garamond, serif' }}>TubeMind</h1>
          <button className="bg-white hover:bg-white/90 text-black font-medium text-[14px] rounded-lg px-4 py-2 w-full transition-colors mb-2 font-sans">
            New Summary
          </button>
        </div>
      </div>
      {/* Chats Section Header */}
      <div className="text-[#C4C4C4] text-xs font-medium mb-1 mt-2 font-sans">Chats</div>
    </div>
  );
} 
