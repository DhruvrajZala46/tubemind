"use client";
import React, { useState } from "react";
import styles from './MainContent.module.css';
import { ElegantLoader } from "../../ui/elegant-loader";

const buttons = [
  { label: "Summarize", color: "#DC143C", primary: true },
  { label: "Download", color: "#404040", primary: false },
  { label: "Share", color: "#404040", primary: false }
];

export default function ActionButtons() {
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);

  const handleClick = async (index: number) => {
    setLoadingIndex(index);
    // Simulate async action
    await new Promise((res) => setTimeout(res, 1200));
    setLoadingIndex(null);
  };

  return (
    <div className="flex flex-wrap gap-3 sm:gap-4 justify-center items-center">
      {buttons.map((btn, index) => (
        <button
          key={index}
          className={`
            px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium text-[14px] sm:text-[15px] transition-all duration-200
            ${btn.primary 
              ? "bg-[#DC143C] hover:bg-[#DC143C]/90 text-white shadow-sm hover:shadow-md" 
              : "bg-[#2F2F2F] hover:bg-[#404040] text-[#F0F6FC] border border-[#404040] hover:border-[#525252]"}
            disabled:opacity-50 disabled:cursor-not-allowed btn-instant relative ${styles.actionButton}
          `}
          style={{
            minWidth: '110px',
            fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
          }}
          onClick={() => handleClick(index)}
          disabled={loadingIndex !== null}
        >
          {loadingIndex === index ? <ElegantLoader size="sm" className="absolute left-3 top-1/2 -translate-y-1/2" /> : null}
          {btn.label}
        </button>
      ))}
    </div>
  );
} 