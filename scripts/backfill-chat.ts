import { backfillChat } from "@/lib/chat-backfill";
import { closeSql } from "@/lib/pg";

function redact(message: string): string {
  const secrets = [process.env.DATABASE_URL ?? "", process.env.DATA_ENCRYPTION_KEY ?? "", process.env.AUTH_SECRET ?? ""].filter((item) => item.length >= 4);
  let out = message;
  for (const secret of secrets) {
    out = out.split(secret).join("[redacted]");
    try {
      out = out.split(encodeURIComponent(secret)).join("[redacted]");
    } catch {
      // The secret is not a URI component.
    }
  }
  return out.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]");
}

backfillChat()
  .then(async (counts) => {
    console.log(
      `chat_backfill messages_encrypted=${counts.messagesEncrypted} messages_already=${counts.messagesAlready} drafts_encrypted=${counts.draftsEncrypted} drafts_already=${counts.draftsAlready} conversations=${counts.conversations} replies_set=${counts.repliesSet}`,
    );
    await closeSql();
  })
  .catch(async (error: unknown) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error(redact(message));
    await closeSql();
    process.exit(1);
  });
