export default function PaymentRoot() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#0D1117] via-[#2D2D2D] to-[#1A1F26] text-white px-4">
      <div className="max-w-lg w-full bg-[#2D2D2D] rounded-2xl shadow-2xl p-10 flex flex-col items-center animate-fade-in">
        <span className="text-5xl mb-4 animate-pulse">💳</span>
        <h1 className="text-2xl font-bold mb-2 text-center">Payments</h1>
        <p className="text-lg text-[#C4C4C4] mb-6 text-center">
          Please select a payment option or return to your dashboard.
        </p>
        <a href="/dashboard/new">
          <button className="bg-[#00D4AA] hover:bg-[#00b894] text-white font-semibold px-8 py-3 rounded-lg text-lg transition-colors shadow-lg">
            Go to Dashboard
          </button>
        </a>
      </div>
    </div>
  );
} 
