"use client";
import Link from "next/link";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0D1117] text-white px-4">
      <div className="max-w-lg w-full bg-[#2D2D2D] rounded-2xl shadow-2xl p-10 flex flex-col items-center">
        <span className="text-5xl mb-4 animate-pulse">😵‍💫</span>
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-lg text-[#C4C4C4] mb-6 text-center">We hit a snag. Please try again, or return to your dashboard. If this keeps happening, contact support.</p>
        <div className="flex gap-4">
          <button
            onClick={() => reset()}
            className="bg-[#DC143C] hover:bg-[#DC143C]/90 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Try Again
          </button>
          <Link href="/dashboard/new">
            <button className="bg-white text-[#0D1117] font-semibold px-6 py-3 rounded-lg border border-[#3A3A3A] hover:bg-gray-100 transition-colors">
              Go to Dashboard
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
} 
