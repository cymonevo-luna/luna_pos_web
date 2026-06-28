import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
};

const stack = [
  ["Framework", "Next.js 16 (App Router, React 19)"],
  ["Language", "TypeScript"],
  ["Styling", "Tailwind CSS v4 + design tokens"],
  ["Theming", "next-themes (light / dark / system)"],
  ["Forms", "react-hook-form + zod"],
  ["Auth", "JWT with automatic refresh"],
  ["Testing", "Vitest + Testing Library"],
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20">
      <h1 className="text-4xl font-bold tracking-tight">About this template</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        This starter gives you a sensible, opinionated foundation so you can
        focus on your product instead of wiring up boilerplate. It pairs with
        the companion Go backend but works with any API that follows the same
        response envelope.
      </p>

      <h2 className="mt-12 text-2xl font-semibold">Tech stack</h2>
      <dl className="mt-6 divide-y divide-border rounded-xl border border-border">
        {stack.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-4 px-5 py-4"
          >
            <dt className="text-sm font-medium text-muted-foreground">
              {label}
            </dt>
            <dd className="text-right text-sm">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
