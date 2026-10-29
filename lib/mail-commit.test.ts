import { describe, expect, it, vi } from "vitest";
import { retryMailedWrite } from "@/lib/mail-commit";

describe("mailed status write", () => {
  it("treats a timeout after the email was stored as success", async () => {
    const write = vi.fn()
      .mockRejectedValueOnce(new Error("The database connection timed out."))
      .mockRejectedValueOnce(new Error("The database connection timed out."));
    const saved = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await expect(retryMailedWrite(write, saved)).resolves.toBeUndefined();
    expect(write).toHaveBeenCalledTimes(2);
    expect(saved).toHaveBeenCalledTimes(2);
  });

  it("throws the database error when the sent row never lands", async () => {
    const write = vi.fn().mockRejectedValue(new Error("The database connection timed out."));
    const saved = vi.fn().mockResolvedValue(false);
    await expect(retryMailedWrite(write, saved)).rejects.toThrow(/timed out/);
    expect(write).toHaveBeenCalledTimes(3);
  });
});
