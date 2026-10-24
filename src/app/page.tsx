import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { WelcomeArt } from "@/components/layout/welcome-art";
import { Button } from "@/components/ui/button";
import { BookIcon, GamepadIcon, HeartIcon, HouseIcon } from "@/components/ui/icons";

const FEATURES = [
  { icon: HouseIcon, title: "A home for two", vi: "Một ngôi nhà cho hai người", text: "Decorate a cozy isometric room and meet each other there." },
  { icon: BookIcon, title: "Real English practice", vi: "Luyện tiếng Anh thật sự", text: "Short lessons with Vietnamese explanations and smart review." },
  { icon: GamepadIcon, title: "Play together", vi: "Cùng nhau chơi", text: "Word Battle and Sentence Puzzle turn practice into play." },
  { icon: HeartIcon, title: "Grow your story", vi: "Viết tiếp câu chuyện", text: "Daily love questions, messages, gifts and shared memories." },
];

export default function WelcomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col items-center px-5 pb-16 pt-[calc(var(--safe-top)+2rem)]">
      <Logo size={88} className="motion-safe:animate-float" />
      <p className="mt-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-sakura-400">Twogether</p>
      <h1 className="mt-2 text-center text-4xl font-bold text-plum-700 sm:text-6xl">Our Little World</h1>
      <p className="mt-3 text-center font-display text-xl text-plum-500">Two hearts. One adventure.</p>
      <p lang="vi" className="text-center text-sm text-cocoa-400">Hai trái tim. Một hành trình.</p>

      <WelcomeArt className="mt-6 w-full max-w-md drop-shadow-[0_20px_30px_rgba(69,54,91,0.18)]" />

      <div className="mt-8 flex w-full max-w-sm flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="flex-1">
          <Link href="/signup">Start our adventure</Link>
        </Button>
        <Button asChild size="lg" variant="soft" className="flex-1">
          <Link href="/login">I have an account</Link>
        </Button>
      </div>

      <ul className="mt-12 grid w-full gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, vi, text }) => (
          <li key={title} className="panel flex gap-4 p-5">
            <Icon size={44} className="shrink-0" />
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p lang="vi" className="text-xs text-cocoa-400">{vi}</p>
              <p className="mt-1 text-sm text-plum-500">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
