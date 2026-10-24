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
  invalid_credentials: { en: "Email or password is incorrect.", vi: "Email hoặc mật khẩu không đúng." },
  "User already registered": { en: "This email already has an account.", vi: "Email này đã có tài khoản." },
  user_already_exists: { en: "This email already has an account — try signing in.", vi: "Email này đã có tài khoản — hãy đăng nhập." },
  email_exists: { en: "This email already has an account — try signing in.", vi: "Email này đã có tài khoản — hãy đăng nhập." },
  email_not_confirmed: { en: "Please confirm your email first, then sign in.", vi: "Hãy xác nhận email trước rồi đăng nhập." },
  email_address_invalid: { en: "That email address doesn't look valid.", vi: "Địa chỉ email không hợp lệ." },
  weak_password: { en: "Please choose a stronger password (at least 8 characters).", vi: "Hãy chọn mật khẩu mạnh hơn (ít nhất 8 ký tự)." },
  over_email_send_rate_limit: { en: "Too many sign-ups right now. Please wait a few minutes and try again.", vi: "Đang có quá nhiều lượt đăng ký. Đợi vài phút rồi thử lại nhé." },
  over_request_rate_limit: { en: "Too many attempts. Please wait a minute and try again.", vi: "Thử quá nhiều lần. Đợi một chút rồi thử lại nhé." },
  boss_locked: { en: "Finish the unit review to face the boss.", vi: "Hoàn thành phần ôn tập để gặp boss." },
  finish_unit_lessons_first: { en: "Finish every lesson in this unit first.", vi: "Hãy học hết các bài trong unit trước." },
  unit_not_available: { en: "This unit isn't unlocked yet.", vi: "Unit này chưa được mở khóa." },
  challenge_incomplete: { en: "Answer every question first.", vi: "Hãy trả lời hết các câu hỏi." },
  placement_not_available: { en: "Placement isn't available for this world.", vi: "Thế giới này chưa có bài kiểm tra xếp lớp." },
  adventure_completed: { en: "You've already finished this adventure together.", vi: "Hai bạn đã hoàn thành cuộc phiêu lưu này." },
  already_completed: { en: "You've already finished your part.", vi: "Bạn đã hoàn thành phần của mình." },
  adventure_not_found: { en: "Adventure not found.", vi: "Không tìm thấy cuộc phiêu lưu." },
  no_content: { en: "There aren't enough questions here yet.", vi: "Chưa có đủ câu hỏi." },
  subject_not_found: { en: "That world doesn't exist.", vi: "Thế giới này không tồn tại." },
  no_playable_levels: { en: "No playable levels yet.", vi: "Chưa có cấp độ nào để chơi." },
  invalid_channel: { en: "That chat channel doesn't exist.", vi: "Kênh chat không tồn tại." },
  message_too_long: { en: "That message is too long.", vi: "Tin nhắn quá dài." },
  duplicate_message: { en: "You just sent that — try saying something new.", vi: "Bạn vừa gửi câu này rồi." },
  invalid_message: { en: "Couldn't send that message.", vi: "Không gửi được tin nhắn." },
  not_allowed: { en: "You can't do that.", vi: "Bạn không thể làm việc này." },
  invalid_target: { en: "That player can't be found.", vi: "Không tìm thấy người chơi." },
  invalid_reason: { en: "Please pick a reason.", vi: "Hãy chọn lý do." },
  cannot_interact: { en: "You can't interact with this player.", vi: "Bạn không thể tương tác với người này." },
  couple_not_found: { en: "That home doesn't exist anymore.", vi: "Ngôi nhà này không còn tồn tại." },
  own_guestbook: { en: "This is your own guestbook — visitors sign it.", vi: "Đây là sổ lưu bút của bạn." },
  request_not_found: { en: "That friend request is gone.", vi: "Lời mời kết bạn không còn." },
  player_not_found: { en: "That player can't be found.", vi: "Không tìm thấy người chơi." },
  game_not_multiplayer: { en: "That game isn't multiplayer yet.", vi: "Trò này chưa hỗ trợ chơi cùng." },
  invitation_pending: { en: "There's already an invitation waiting between you two.", vi: "Đã có lời mời đang chờ." },
  invitation_not_found: { en: "That invitation can't be found.", vi: "Không tìm thấy lời mời." },
  invitation_closed: { en: "That invitation has expired or was answered.", vi: "Lời mời đã hết hạn hoặc đã được trả lời." },
  invalid_sort: { en: "Unknown sort.", vi: "Cách sắp xếp không hợp lệ." },
  invalid_game_session: { en: "This game session has ended.", vi: "Lượt chơi đã kết thúc." },
  question_not_found: { en: "That word can't be found.", vi: "Không tìm thấy từ này." },
  love_ping_cooldown: { en: "Your love is already on its way! 💗 Give them a little time to respond.", vi: "Tình yêu đang trên đường rồi! 💗 Cho người ấy chút thời gian nhé." },
  invalid_love_ping: { en: "Pick a Love Ping message.", vi: "Hãy chọn lời nhắn Love Ping." },
  invalid_quiet_hours: { en: "Pick both a start and end hour.", vi: "Hãy chọn giờ bắt đầu và kết thúc." },
  signup_disabled: { en: "Sign-ups are closed right now.", vi: "Hiện chưa mở đăng ký." },
};

export function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return String(error ?? "");
}

function authCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error && typeof (error as { code: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return null;
}

export function friendlyError(error: unknown): Friendly {
  const code = errorCode(error);
  const auth = authCode(error);
  if (auth && KNOWN[auth]) return KNOWN[auth];
  if (KNOWN[code]) return KNOWN[code];
  if (/rate limit/i.test(code)) return KNOWN.over_request_rate_limit;
  if (/fetch|network|Failed to fetch/i.test(code)) {
    return { en: "Can't reach the server. Check your connection.", vi: "Không kết nối được máy chủ. Kiểm tra mạng nhé." };
  }
  return { en: "Something went wrong. Please try again.", vi: "Có lỗi xảy ra. Vui lòng thử lại." };
}
