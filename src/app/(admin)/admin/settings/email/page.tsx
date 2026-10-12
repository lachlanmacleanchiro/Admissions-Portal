import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEmailConfig } from "@/lib/email";
import { EmailSendSettingsForm } from "../EmailSendSettingsForm";
import { EmailNotificationsToggle } from "../EmailNotificationsToggle";
import { SettingsNav } from "../SettingsNav";

export default async function EmailSettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF" || !session.user.isGlobalAdmin) redirect("/admin");

  const [settings, config] = await Promise.all([
    prisma.appSettings.findUnique({
      where: { id: "singleton" },
      select: { emailNotificationsEnabled: true, emailFromAddress: true, emailFromName: true, resendApiKeyLast4: true },
    }),
    getEmailConfig(),
  ]);

  return (
    <div className="px-8 py-7 w-full">
      <h1 className="font-serif text-2xl text-text mb-4">Settings</h1>
      <SettingsNav />

      <section>
        <h2 className="font-serif text-lg text-text mb-1">Email Sending</h2>
        <p className="text-sm text-text-muted mb-4">
          The Resend account and sender used for every email the portal sends. Use your own Resend account
          and a domain you&apos;ve verified there.
        </p>
        <EmailSendSettingsForm
          fromAddress={settings?.emailFromAddress ?? ""}
          fromName={settings?.emailFromName ?? ""}
          savedKeyLast4={config.savedKeyUnreadable ? null : settings?.resendApiKeyLast4 ?? null}
          savedKeyUnreadable={config.savedKeyUnreadable}
          apiKeySource={config.apiKeySource}
          envFromAddress={process.env.EMAIL_FROM_ADDRESS ?? null}
        />
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-lg text-text mb-4">Email Notifications</h2>
        <EmailNotificationsToggle enabled={settings?.emailNotificationsEnabled ?? false} />
      </section>
    </div>
  );
}
