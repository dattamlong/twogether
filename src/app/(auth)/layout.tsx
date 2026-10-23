import Link from "next/link";
import { WelcomeArt } from "@/components/layout/welcome-art";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <Link href="/" className="mx-auto mb-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-sakura-400">
        Twogether
      </Link>
      <WelcomeArt className="mx-auto mb-4 w-56" />
      <div className="panel p-6">{children}</div>
    </main>
  );
}
