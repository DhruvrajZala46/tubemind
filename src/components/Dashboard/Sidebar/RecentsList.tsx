"use client";
import React from "react";

const recents = [
  { id: "2", title: "YouTube Video Knowledge Extraction..." },
  { id: "3", title: "Video Content SaaS Naming Strategy" },
  { id: "4", title: "YouTube Transcript Summarization..." },
  { id: "5", title: "review my project perfectly. N..." },
];

export default function RecentsList() {
  return (
    <div className="mt-6 flex-1 overflow-y-auto scrollbar-hide">
      <div className="text-[#C4C4C4] text-xs font-medium mb-2 px-6 font-sans">Recents</div>
      <ul className="space-y-1">
        {recents.map((item) => (
          <li
            key={item.id}
            className="px-6 py-2 rounded-lg text-[#FFFFFF] font-medium text-[14px] cursor-pointer truncate hover:bg-[#B1BAC41F] transition-colors font-sans"
          >
            {item.title}
          </li>
        ))}
      </ul>
    </div>
  );
} 
