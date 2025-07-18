import React from 'react';

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)] px-4">
      <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-center">About TubeMind</h1>
      <p className="max-w-xl text-center text-[var(--text-secondary)] text-base sm:text-lg">
        This is a placeholder About page. We will be sharing our story, mission, and values here soon.
      </p>
    </div>
  );
} 