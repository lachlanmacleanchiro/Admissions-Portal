import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { NextResponse } from "next/server";

// Sends a test email to the signed-in admin using the saved email settings.
export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF" || !session.user.isGlobalAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await sendEmail({
      to: session.user.email!,
      subject: "Test email from the NZCC Applicant Portal",
      bodyHtml: `<p>Kia ora ${session.user.firstName},</p><p>This is a test email. If you're reading it, the portal's email settings are working.</p>`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "The test email couldn't be sent." },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, sentTo: session.user.email });
}
