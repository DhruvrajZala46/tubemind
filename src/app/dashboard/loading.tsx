import { ElegantLoader } from '../../components/ui/elegant-loader';

export default function DashboardLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
      <ElegantLoader size="lg" />
      <p className="text-gray-400 mt-4">Loading Dashboard...</p>
    </div>
  );
} 