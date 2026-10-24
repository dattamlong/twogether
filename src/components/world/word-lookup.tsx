"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkCheck, BookmarkPlus } from "lucide-react";
import { WordCard } from "@/components/learning/word-card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Vi } from "@/components/ui/panel";
import { ErrorBlock, LoadingBlock } from "@/components/ui/states";
import type { WordCard as Word } from "@/features/learning/types";
import { qk } from "@/features/query-keys";
import { rpc } from "@/features/world/queries";
import { toast } from "@/stores/toast-store";

type Lookup = { questionId: string; language: "en" | "zh"; word: Word; saved: boolean } | null;

export function WordLookup({ term, onClose }: { term: string | null; onClose: () => void }) {
  const client = useQueryClient();
  const lookup = useQuery({
    queryKey: ["world", "lookup", term?.toLowerCase() ?? ""],
    enabled: Boolean(term),
    queryFn: () => rpc<Lookup>("lookup_vocabulary", { term }),
  });
  const save = useMutation({
    mutationFn: (question: string) => rpc<boolean>("save_vocabulary", { question }),
    onSuccess: () => {
      toast({ tone: "success", title: "Saved to your Word Bank", vi: "Đã lưu vào kho từ — sẽ xuất hiện trong Smart Review" });
      client.invalidateQueries({ queryKey: ["world", "lookup"] });
      client.invalidateQueries({ queryKey: qk.wordBank });
      client.invalidateQueries({ queryKey: qk.reviewQueue });
    },
  });
  const found = lookup.data;

  return (
    <Modal open={Boolean(term)} onOpenChange={(o) => !o && onClose()} title={term ?? ""} subtitle="English Café dictionary">
      {lookup.isLoading ? <LoadingBlock /> : null}
      {lookup.error ? <ErrorBlock error={lookup.error} /> : null}
      {lookup.isSuccess && !found ? (
        <div className="flex flex-col gap-2 rounded-3xl bg-white/80 p-4">
          <p className="font-display font-semibold">No verified entry for “{term}” yet.</p>
          <p className="text-sm text-plum-500">We only show meanings that come from TWOGETHER&apos;s reviewed lesson vocabulary, so we don&apos;t guess translations.</p>
          <Vi>Từ này chưa có trong bộ từ vựng đã kiểm duyệt của TWOGETHER.</Vi>
        </div>
      ) : null}
      {found ? (
        <div className="flex flex-col gap-3">
          <WordCard word={found.word} showRecorder={false} />
          {found.saved ? (
            <Button variant="soft" disabled>
              <BookmarkCheck size={18} /> In your Word Bank
            </Button>
          ) : (
            <Button onClick={() => save.mutate(found.questionId)} loading={save.isPending}>
              <BookmarkPlus size={18} /> Save to Word Bank
            </Button>
          )}
          {save.error ? <ErrorBlock error={save.error} /> : null}
          <p className="text-xs text-cocoa-400">
            Saved words join Smart Review{found.language === "zh" ? " when Chinese is your study language" : " when English is your study language"}.
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
