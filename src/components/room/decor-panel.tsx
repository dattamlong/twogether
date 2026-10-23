"use client";

import { FlipHorizontal2, Trash2 } from "lucide-react";
import Link from "next/link";
import { ItemArt } from "@/components/rewards/item-art";
import { Button } from "@/components/ui/button";
import { Vi } from "@/components/ui/panel";
import type { ShopItemRow } from "@/features/shop/queries";
import type { Placement } from "@/game/world/placement";
import { cn } from "@/lib/utils";

type Owned = { inventoryId: string; item: ShopItemRow };

export function DecorPanel({
  owned,
  draft,
  selected,
  onSelect,
  onRemove,
  onFlip,
  onSave,
  onCancel,
  saving,
  dirty,
}: {
  owned: Owned[];
  draft: Placement[];
  selected: string | null;
  onSelect: (inventoryId: string | null) => void;
  onRemove: (inventoryId: string) => void;
  onFlip: (inventoryId: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  dirty: boolean;
}) {
  return (
    <div className="panel flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">Decorate our room</h2>
          <Vi>Chọn món đồ, rồi chạm vào ô trống trong phòng</Vi>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" variant="mint" onClick={onSave} loading={saving} disabled={!dirty}>
            Save
          </Button>
        </div>
      </div>
      {owned.length === 0 ? (
        <p className="rounded-2xl bg-white/70 p-4 text-sm text-plum-500">
          You don&apos;t have furniture yet.{" "}
          <Link href="/shop" className="font-bold text-sakura-500 underline">
            Visit the Love Shop
          </Link>{" "}
          to find something cozy.
        </p>
      ) : (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {owned.map(({ inventoryId, item }) => {
            const placed = draft.find((p) => p.inventoryId === inventoryId);
            const active = selected === inventoryId;
            return (
              <li key={inventoryId} className="shrink-0">
                <div className={cn("flex w-24 flex-col items-center gap-1 rounded-2xl bg-white/80 p-2 ring-2", active ? "ring-sakura-300" : placed ? "ring-mint-200" : "ring-white")}>
                  <button className="flex flex-col items-center" onClick={() => onSelect(active ? null : inventoryId)} aria-pressed={active}>
                    <ItemArt itemId={item.id} size={48} />
                    <span className="text-center text-[11px] font-semibold leading-tight">{item.name}</span>
                    <span className="text-[10px] text-cocoa-400">{active ? "Tap a tile" : placed ? "Placed · move" : "Place"}</span>
                  </button>
                  {placed ? (
                    <div className="flex gap-1">
                      <button className="grid size-7 place-items-center rounded-lg bg-lavender-100" onClick={() => onFlip(inventoryId)} aria-label={`Flip ${item.name}`}>
                        <FlipHorizontal2 size={14} />
                      </button>
                      <button className="grid size-7 place-items-center rounded-lg bg-sakura-100" onClick={() => onRemove(inventoryId)} aria-label={`Put away ${item.name}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
