import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full blur-xl opacity-20 animate-pulse" />
          <div className="relative p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-medium text-slate-700">Loading...</p>
          <p className="text-sm text-slate-500">Please wait a moment</p>
        </div>
      </div>
    </div>
  );
}
