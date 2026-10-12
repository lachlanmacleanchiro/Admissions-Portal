import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  if (session.user.role === "STUDENT") {
    const document = await prisma.document.findFirst({
      where: { storageKey: filename, application: { studentId: session.user.id } },
      select: { id: true },
    });
    if (!document) return new Response("Not found", { status: 404 });
  }

  // Security: prevent path traversal
  const uploadDir = path.join(process.cwd(), "uploads");
  const filePath = path.join(uploadDir, filename);
  if (!filePath.startsWith(uploadDir)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
    };
    const contentType = mimeTypes[ext] ?? "application/octet-stream";

    return new Response(file, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
