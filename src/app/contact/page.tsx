import React from 'react';

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] text-[var(--text-primary)] px-4">
      <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-center">Contact Us</h1>
      <p className="max-w-md text-center text-[var(--text-secondary)] text-base sm:text-lg mb-6">
        Have any questions or feedback? Reach out — we'd love to hear from you.
      </p>
      <div className="space-y-2 text-center text-sm sm:text-base">
        <p>Email: <span className="font-mono">tubemind@gmail.com</span></p>
        <p>Twitter: <a href="#" className="text-blue-400 underline">@tubemind</a></p>
        <p>Youtube: <a href="#" className="text-blue-400 underline">TubeMind</a></p>
      </div>
    </div>
  );
} 