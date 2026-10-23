import { describe, expect, it } from "vitest";
import { friendlyError } from "./errors";

describe("friendlyError", () => {
  it("explains Supabase auth rate limits instead of a generic message", () => {
    expect(friendlyError({ message: "email rate limit exceeded", code: "over_email_send_rate_limit" }).en).toMatch(/Too many sign-ups/);
    expect(friendlyError({ message: "For security purposes, you can only request this after 30 seconds", code: "over_request_rate_limit" }).vi).toMatch(/Đợi/);
    expect(friendlyError({ message: "Request rate limit reached" }).en).toMatch(/Too many attempts/);
  });

  it("maps database RPC errors by message", () => {
    expect(friendlyError({ message: "insufficient_coins", code: "P0001" }).en).toMatch(/Love Coins/);
  });
});
