import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, dropTestDb, createTestUser } from "@/tests/helpers/testDb";
import { hashToken } from "@/lib/auth/session";
import { createRefreshTokenRow, findRefreshTokenRow, rotateRefreshTokenRow, revokeRefreshTokenRow } from "@/lib/repo/authTokens";

describe("authTokens repo", () => {
  let db: any;
  beforeEach(async () => { db = await createTestDb(); });
  afterEach(async () => { await dropTestDb(db); });

  it("creates, finds, rotates, and revokes tokens", async () => {
    const id = "11111111-1111-1111-1111-111111111111";
    await createTestUser(db, id, "a@b.c");
    const row = { id: "22222222-2222-2222-2222-222222222222", userId: id, tokenHash: hashToken("tok"), expiresAt: Date.now() + 1000, createdAt: Date.now() };
    await createRefreshTokenRow(db, row);
    expect(await findRefreshTokenRow(db, hashToken("tok"))).not.toBeNull();

    await rotateRefreshTokenRow(db, row.id, hashToken("tok2"), Date.now() + 1000);
    expect(await findRefreshTokenRow(db, hashToken("tok"))).toBeUndefined();
    expect(await findRefreshTokenRow(db, hashToken("tok2"))).not.toBeUndefined();

    await revokeRefreshTokenRow(db, hashToken("tok2"));
    expect(await findRefreshTokenRow(db, hashToken("tok2"))).toBeUndefined();
  });
});
