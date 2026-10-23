type Friendly = { en: string; vi: string };

const KNOWN: Record<string, Friendly> = {
  not_authenticated: { en: "Please sign in again.", vi: "Vui lòng đăng nhập lại." },
  not_paired: { en: "Pair with your partner first.", vi: "Hãy kết đôi với người ấy trước." },
  already_paired: { en: "You're already paired.", vi: "Bạn đã kết đôi rồi." },
  invalid_invitation: { en: "That code is invalid, expired or already used.", vi: "Mã không hợp lệ, đã hết hạn hoặc đã được dùng." },
  cannot_join_own_invitation: { en: "Share this code with your partner — you can't join it yourself.", vi: "Hãy gửi mã cho người ấy — bạn không thể tự tham gia." },
  couple_full: { en: "This home already has two members.", vi: "Ngôi nhà này đã đủ hai người." },
  insufficient_coins: { en: "Not enough Love Coins yet — keep learning!", vi: "Chưa đủ Xu tình yêu — học thêm nhé!" },
  duplicate_transaction: { en: "That was already processed.", vi: "Yêu cầu này đã được xử lý." },
  already_owned: { en: "You already own this.", vi: "Bạn đã có món này." },
  already_claimed: { en: "Reward already claimed.", vi: "Đã nhận thưởng rồi." },
  quest_not_complete: { en: "Finish the quest first.", vi: "Hãy hoàn thành nhiệm vụ trước." },
  home_level_too_low: { en: "Grow your home level to unlock this.", vi: "Nâng cấp nhà để mở khóa món này." },
  tile_occupied: { en: "That spot is taken.", vi: "Vị trí này đã có đồ." },
  out_of_bounds: { en: "That's outside the room.", vi: "Vị trí nằm ngoài căn phòng." },
  already_answered: { en: "You already answered today.", vi: "Hôm nay bạn đã trả lời rồi." },
  slow_down: { en: "Slow down a little.", vi: "Chậm lại một chút nhé." },
  lesson_incomplete: { en: "Answer every question first.", vi: "Hãy trả lời hết các câu hỏi." },
  empty_message: { en: "Write something first.", vi: "Hãy viết gì đó trước." },
  partner_missing: { en: "Your partner hasn't joined yet.", vi: "Người ấy chưa tham gia." },
  interaction_closed: { en: "This request has expired.", vi: "Yêu cầu này đã hết hạn." },
  reward_not_approved: { en: "Your partner needs to approve this first.", vi: "Người ấy cần đồng ý trước." },
  item_not_owned: { en: "You don't own that item yet.", vi: "Bạn chưa có món này." },
  "Invalid login credentials": { en: "Email or password is incorrect.", vi: "Email hoặc mật khẩu không đúng." },
  "User already registered": { en: "This email already has an account.", vi: "Email này đã có tài khoản." },
};

export function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return String(error ?? "");
}

export function friendlyError(error: unknown): Friendly {
  const code = errorCode(error);
  if (KNOWN[code]) return KNOWN[code];
  if (/fetch|network|Failed to fetch/i.test(code)) {
    return { en: "Can't reach the server. Check your connection.", vi: "Không kết nối được máy chủ. Kiểm tra mạng nhé." };
  }
  return { en: "Something went wrong. Please try again.", vi: "Có lỗi xảy ra. Vui lòng thử lại." };
}
