"use client";

import { Copy, Link2, LogOut, RefreshCw, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { WelcomeArt } from "@/components/layout/welcome-art";
import { Button } from "@/components/ui/button";
import { Panel, Vi } from "@/components/ui/panel";
import { ErrorBlock, LoadingBlock } from "@/components/ui/states";
import { useAcceptInvitation, useActiveInvitation, useCreateInvitation, useRevokeInvitation, useSignOut } from "@/features/couples/queries";
import { useSession } from "@/features/session/use-session";
import { friendlyError } from "@/lib/errors";
import { toast } from "@/stores/toast-store";

export function PairingScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session, isLoading, error, refetch } = useSession();
  const invitation = useActiveInvitation();
  const create = useCreateInvitation();
  const revoke = useRevokeInvitation();
  const accept = useAcceptInvitation();
  const signOut = useSignOut();
  const [code, setCode] = useState(params.get("code")?.toUpperCase() ?? "");

  useEffect(() => {
    if (session?.couple && session.partner) router.replace("/home");
  }, [session, router]);

  if (isLoading) return <main className="mx-auto max-w-lg p-6"><LoadingBlock /></main>;
  if (error || !session) return <main className="mx-auto max-w-lg p-6"><ErrorBlock error={error ?? "not_authenticated"} onRetry={() => refetch()} /></main>;

  const inviteLink = invitation.data ? `${window.location.origin}/pair?code=${invitation.data.code}` : "";

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ tone: "success", title: "Copied!", vi: "Đã sao chép!" });
    } catch {
      toast({ tone: "error", title: "Couldn't copy — select it manually.", vi: "Không sao chép được — hãy chọn thủ công." });
    }
  }

  async function onJoin(event: FormEvent) {
    event.preventDefault();
    accept.mutate(code.trim(), {
      onSuccess: () => {
        toast({ tone: "love", title: "You're together now!", vi: "Hai bạn đã kết đôi!" });
        router.replace("/home");
      },
    });
  }

  const waiting = Boolean(session.couple && !session.partner);
  const joinError = accept.error ? friendlyError(accept.error) : null;
  const createError = create.error ? friendlyError(create.error) : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 px-4 py-8 pt-[calc(var(--safe-top)+2rem)]">
      <header className="text-center">
        <WelcomeArt className="mx-auto w-52" />
        <h1 className="mt-2 text-3xl font-bold">Hi {session.profile.display_name}! Let&apos;s find your partner</h1>
        <Vi>Hãy kết nối với người ấy để cùng chia sẻ một ngôi nhà nhỏ</Vi>
      </header>

      <Panel>
        <h2 className="text-xl font-semibold">{waiting ? "Your invitation" : "Invite your partner"}</h2>
        <Vi>{waiting ? "Gửi mã này cho người ấy" : "Tạo mã mời và gửi cho người ấy"}</Vi>
        {waiting && invitation.isLoading ? <LoadingBlock className="mt-4" /> : null}
        {invitation.data ? (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-center gap-1.5 rounded-3xl bg-sakura-50 p-4" aria-label={`Invitation code ${invitation.data.code.split("").join(" ")}`}>
              {invitation.data.code.split("").map((ch, i) => (
                <span key={i} className="grid h-12 w-9 place-items-center rounded-xl bg-white font-display text-2xl font-bold text-plum-700 shadow-[var(--shadow-pop)]">
                  {ch}
                </span>
              ))}
            </div>
            <p className="text-center text-xs text-cocoa-400">
              Expires {new Date(invitation.data.expires_at).toLocaleString()} · single use
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="soft" size="sm" onClick={() => copy(invitation.data!.code)}>
                <Copy size={16} /> Copy code
              </Button>
              <Button variant="soft" size="sm" onClick={() => copy(inviteLink)}>
                <Link2 size={16} /> Copy link
              </Button>
              <Button variant="soft" size="sm" loading={create.isPending} onClick={() => create.mutate()}>
                <RefreshCw size={16} /> New code
              </Button>
              <Button variant="ghost" size="sm" loading={revoke.isPending} onClick={() => revoke.mutate(invitation.data!.id)}>
                <X size={16} /> Revoke
              </Button>
            </div>
            <Button className="mt-2" variant="secondary" onClick={() => router.push("/home")}>
              Explore our home while I wait
            </Button>
          </div>
        ) : (
          <div className="mt-4">
            <Button size="lg" className="w-full" loading={create.isPending} onClick={() => create.mutate()}>
              Create invitation code
            </Button>
            {waiting && !invitation.isLoading ? <p className="mt-2 text-center text-sm text-cocoa-400">Your previous code expired or was revoked.</p> : null}
          </div>
        )}
        {createError ? <p role="alert" className="mt-3 text-sm text-rose-err">{createError.en}</p> : null}
      </Panel>

      {!waiting ? (
        <Panel>
          <h2 className="text-xl font-semibold">Join with a code</h2>
          <Vi>Nhập mã người ấy gửi cho bạn</Vi>
          <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={onJoin}>
            <label className="sr-only" htmlFor="invite-code">Invitation code</label>
            <input
              id="invite-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
              placeholder="ABCD2345"
              autoComplete="off"
              inputMode="text"
              className="h-14 flex-1 rounded-2xl border-2 border-lavender-100 bg-white px-4 text-center font-display text-2xl tracking-[0.3em] outline-none focus:border-sakura-300 focus:shadow-[var(--shadow-glow)]"
            />
            <Button type="submit" size="lg" disabled={code.length !== 8} loading={accept.isPending}>
              Join
            </Button>
          </form>
          {joinError ? (
            <p role="alert" className="mt-3 text-sm text-rose-err">
              {joinError.en} <span lang="vi" className="block text-xs text-cocoa-400">{joinError.vi}</span>
            </p>
          ) : null}
        </Panel>
      ) : null}

      <Button variant="ghost" className="mx-auto" onClick={signOut}>
        <LogOut size={16} /> Sign out
      </Button>
    </main>
  );
}
