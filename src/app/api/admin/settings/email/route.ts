import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { encryptSecret } from "@/lib/secrets";
import { NextRequest, NextResponse } from "next/server";

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

// Body: { fromAddress, fromName, apiKey?, clearApiKey? }
// The API key is write-only: it is encrypted at rest and never returned.
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF" || !session.user.isGlobalAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { fromAddress, fromName, apiKey, clearApiKey } = await req.json();

  const address = typeof fromAddress === "string" ? fromAddress.trim() : "";
  const name = typeof fromName === "string" ? fromName.trim().replace(/[<>"]/g, "") : "";
  if (address && !EMAIL_PATTERN.test(address)) {
    return NextResponse.json({ error: "Enter a valid sender email address." }, { status: 400 });
  }

  const newKey = typeof apiKey === "string" ? apiKey.trim() : "";
  if (newKey && /\s/.test(newKey)) {
    return NextResponse.json({ error: "The API key can't contain spaces." }, { status: 400 });
  }

  const keyData = newKey
    ? { resendApiKeyEncrypted: encryptSecret(newKey), resendApiKeyLast4: newKey.slice(-4) }
    : clearApiKey
    ? { resendApiKeyEncrypted: null, resendApiKeyLast4: null }
    : {};

  const data = { emailFromAddress: address || null, emailFromName: name || null, ...keyData };

  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });

  await logAudit({
    objectType: "AppSettings",
    objectId: "singleton",
    action: "UPDATE",
    actionDetail: `Email send settings updated${newKey ? " (new API key saved)" : clearApiKey ? " (saved API key removed)" : ""}`,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
