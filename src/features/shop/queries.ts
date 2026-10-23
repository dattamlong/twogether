"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Placement } from "@/game/world/placement";
import { friendlyError } from "@/lib/errors";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabase } from "@/lib/supabase/client";
import { requestId } from "@/lib/utils";
import { celebrate } from "@/stores/celebration-store";
import { toast } from "@/stores/toast-store";
import { qk } from "../query-keys";
import { useSession } from "../session/use-session";

export type ShopItemRow = Database["public"]["Tables"]["shop_items"]["Row"];

const showError = (error: unknown) => {
  const message = friendlyError(error);
  toast({ tone: "error", title: message.en, vi: message.vi });
};

export function useShopItems() {
  return useQuery({
    queryKey: qk.shopItems,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabase().from("shop_items").select("*").order("price");
      if (error) throw error;
      return data;
    },
  });
}

export function useInventory() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: qk.inventory,
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await getSupabase().from("inventories").select("*").order("acquired_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function usePlacements() {
  const { data: session } = useSession();
  const items = useShopItems();
  return useQuery({
    queryKey: [...qk.placements, Boolean(items.data)],
    enabled: Boolean(session?.couple && items.data),
    queryFn: async (): Promise<Placement[]> => {
      const { data, error } = await getSupabase().from("furniture_placements").select("inventory_id, x, y, flipped, inventories(item_id)");
      if (error) throw error;
      return data.flatMap((row) => {
        const itemId = row.inventories?.item_id;
        const item = items.data!.find((i) => i.id === itemId);
        if (!item) return [];
        return [{ inventoryId: row.inventory_id, itemId: item.id, x: row.x, y: row.y, w: item.footprint_w, h: item.footprint_h, flipped: row.flipped }];
      });
    },
  });
}

export function usePurchase() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await getSupabase().rpc("purchase_item", { item: itemId, request_id: requestId() });
      if (error) throw error;
      return data;
    },
    onSuccess: (reward) => celebrate(reward, "New treasure!"),
    onError: showError,
    onSettled: () => {
      client.invalidateQueries({ queryKey: qk.inventory });
      client.invalidateQueries({ queryKey: qk.progress });
      client.invalidateQueries({ queryKey: qk.achievements });
    },
  });
}

export function useSaveLayout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (placements: Placement[]) => {
      const layout = placements.map((p) => ({ inventoryId: p.inventoryId, x: p.x, y: p.y, flipped: p.flipped }));
      const { error } = await getSupabase().rpc("save_room_layout", { layout });
      if (error) throw error;
    },
    onSuccess: () => toast({ tone: "success", title: "Room saved", vi: "Đã lưu căn phòng" }),
    onError: showError,
    onSettled: () => client.invalidateQueries({ queryKey: qk.placements }),
  });
}
