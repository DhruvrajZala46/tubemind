"use client";
import React from "react";

const starred = [
  { id: "1", title: "mvp1-complete-codes" },
];

export default function StarredList() {
  return (
    <div className="mt-6">
      <div className="text-[#8B949E] text-xs font-medium mb-2 px-6 font-sans">Starred</div>
      <ul className="space-y-1">
        {starred.map((item) => (
          <li
            key={item.id}
            className="px-6 py-2 rounded-lg text-[#F0F6FC] font-medium text-[14px] cursor-pointer truncate hover:bg-[#B1BAC41F] transition-colors font-sans"
          >
            {item.title}
          </li>
        ))}
      </ul>
    </div>
  );
} 