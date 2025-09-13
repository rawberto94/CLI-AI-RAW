import { BackButton } from "@/components/ui/back-button";

export default function Test() {
  return (
    <div className="m-6 rounded-xl bg-slate-100 p-6">
      <div className="mb-2"><BackButton hrefFallback="/" /></div>
      <h1 className="text-2xl font-bold text-blue-600">Tailwind working ✅</h1>
      <p className="mt-2 text-gray-600">If you see styling, Tailwind is loaded!</p>
    </div>
  );
}
