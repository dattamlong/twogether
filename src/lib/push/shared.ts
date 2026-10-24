export type PushPayload = { id: string; type: string; title: string; body: string; url: string };

export function isSafeDestination(destination: unknown): destination is string {
  return typeof destination === "string" && /^\/[A-Za-z0-9/_?=&%.-]*$/.test(destination) && !destination.startsWith("//") && destination.length <= 200;
}

export function pushCategory(type: string): "love" | "study" | "game" | "community" | "inapp" {
  switch (type) {
    case "love_ping":
    case "gift_received":
      return "love";
    case "study_invitation":
      return "study";
    case "game_invitation":
      return "game";
    case "friend_request":
    case "guestbook_signed":
    case "world_event":
      return "community";
    default:
      return "inapp";
  }
}
