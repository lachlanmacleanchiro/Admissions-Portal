import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildContentDisposition, safeContentType } from "@/lib/contentDisposition";
import { NextRequest } from "next/server";
import path from "path";
import fs from "fs/promises";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { key } = await params;
  const filename = key.join("/");

  // Students may only open files attached to their own application.
  const isStudent = session.user.role === "STUDENT";
  const document = await prisma.document.findFirst({
    where: { storageKey: filename, ...(isStudent && { application: { studentId: session.user.id } }) },
    select: { filename: true, mimeType: true },
  });
  if (isStudent && !document) return new Response("Not found", { status: 404 });

  // Security: prevent path traversal
  const uploadDir = path.join(process.cwd(), "uploads");
  const filePath = path.join(uploadDir, filename);
  if (!filePath.startsWith(uploadDir)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const file = await fs.readFile(filePath);
    const contentType = safeContentType(document?.mimeType, filename);

    return new Response(file, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": buildContentDisposition(document?.filename ?? path.basename(filename), contentType),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
