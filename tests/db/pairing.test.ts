import { describe, expect, it } from "vitest";
import { admin, createCouple, createUser, errorMessage, expectOk } from "./helpers";

describe("couple pairing", () => {
  it("pairs two users through an invitation code", async () => {
    const { a, b, coupleId } = await createCouple();
    const members = expectOk(await a.client.from("couple_members").select("user_id, slot").order("slot"));
    expect(members.map((m) => m.user_id)).toEqual([a.id, b.id]);
    expect(expectOk(await b.client.rpc("my_couple_id"))).toBe(coupleId);
    const partner = expectOk(await a.client.from("profiles").select("display_name").eq("id", b.id).single());
    expect(partner.display_name).toBe("Minh");
  });

  it("rejects joining your own invitation, a used code, and a third member", async () => {
    const owner = await createUser();
    const invite = expectOk(await owner.client.rpc("create_invitation"));
    expect(errorMessage(await owner.client.rpc("accept_invitation", { invite_code: invite.code }))).toBe("already_paired");

    const partner = await createUser();
    expectOk(await partner.client.rpc("accept_invitation", { invite_code: invite.code.toLowerCase() }));

    const intruder = await createUser();
    expect(errorMessage(await intruder.client.rpc("accept_invitation", { invite_code: invite.code }))).toBe("invalid_invitation");
    expect(errorMessage(await owner.client.rpc("create_invitation"))).toBe("couple_full");
  });

  it("rejects expired and revoked invitations", async () => {
    const owner = await createUser();
    const expired = expectOk(await owner.client.rpc("create_invitation"));
    await admin().from("couple_invitations").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", expired.id);
    const joiner = await createUser();
    expect(errorMessage(await joiner.client.rpc("accept_invitation", { invite_code: expired.code }))).toBe("invalid_invitation");

    const fresh = expectOk(await owner.client.rpc("create_invitation"));
    expectOk(await owner.client.rpc("revoke_invitation", { invitation_id: fresh.id }));
    expect(errorMessage(await joiner.client.rpc("accept_invitation", { invite_code: fresh.code }))).toBe("invalid_invitation");
  });

  it("creating a new invitation revokes the previous one", async () => {
    const owner = await createUser();
    const first = expectOk(await owner.client.rpc("create_invitation"));
    expectOk(await owner.client.rpc("create_invitation"));
    const joiner = await createUser();
    expect(errorMessage(await joiner.client.rpc("accept_invitation", { invite_code: first.code }))).toBe("invalid_invitation");
  });

  it("keeps couple data private from other users", async () => {
    const { a, coupleId } = await createCouple();
    expectOk(await a.client.rpc("send_love_message", { message_kind: "text", message_body: "Good morning!" }));
    const outsider = await createUser();

    expect(expectOk(await outsider.client.from("couples").select("id").eq("id", coupleId))).toHaveLength(0);
    expect(expectOk(await outsider.client.from("love_messages").select("id").eq("couple_id", coupleId))).toHaveLength(0);
    expect(expectOk(await outsider.client.from("memories").select("id").eq("couple_id", coupleId))).toHaveLength(0);
    expect(expectOk(await outsider.client.from("profiles").select("id").eq("id", a.id))).toHaveLength(0);
    expect(errorMessage(await outsider.client.rpc("send_love_message", { message_kind: "text", message_body: "hi" }))).toBe("not_paired");
  });

  it("blocks direct writes to protected tables", async () => {
    const { a, coupleId } = await createCouple();
    const write = await a.client.from("couple_members").insert({ couple_id: coupleId, user_id: a.id, slot: 1 });
    expect(write.error).not.toBeNull();
    const coins = await a.client.from("user_progress").update({ coins: 99999 }).eq("user_id", a.id);
    expect(coins.error).not.toBeNull();
  });

  it("unpairing removes both members and closes access", async () => {
    const { a, b, coupleId } = await createCouple();
    expectOk(await b.client.rpc("leave_couple"));
    expect(expectOk(await a.client.rpc("my_couple_id"))).toBeNull();
    expect(expectOk(await a.client.from("couples").select("id").eq("id", coupleId))).toHaveLength(0);
    const again = expectOk(await a.client.rpc("create_invitation"));
    expect(again.couple_id).not.toBe(coupleId);
  });
});
