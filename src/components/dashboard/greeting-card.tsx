import { Sun } from "lucide-react";

interface GreetingCardProps {
  name: string;
  message?: string;
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function GreetingCard({
  name,
  message = "Have a great day!",
}: GreetingCardProps) {
  return (
    <div className="bg-brand-gradient relative overflow-hidden rounded-2xl p-5 text-white shadow-card">
      <div className="relative z-10">
        <p className="text-lg font-semibold">
          {greetingForNow()}, {name}
        </p>
        <p className="mt-1 text-sm text-white/80">{message}</p>
      </div>
      <div className="absolute -right-2 top-1/2 z-10 -translate-y-1/2">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
          <Sun className="h-6 w-6" />
        </div>
      </div>
      <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
      <div className="absolute -bottom-12 right-12 h-28 w-28 rounded-full bg-white/5" />
    </div>
  );
}
