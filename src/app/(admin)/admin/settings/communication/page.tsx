import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMessagingMode } from "@/lib/messaging";
import { MessagingModeSelector } from "../MessagingModeSelector";
import { SettingsNav } from "../SettingsNav";

export default async function CommunicationSettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "STAFF" || !session.user.isGlobalAdmin) redirect("/admin");

  const mode = await getMessagingMode();

  return (
    <div className="px-8 py-7 w-full">
      <h1 className="font-serif text-2xl text-text mb-4">Settings</h1>
      <SettingsNav />

      <section>
        <h2 className="font-serif text-lg text-text mb-1">Messaging Style</h2>
        <p className="text-sm text-text-muted mb-4">
          Choose how applicants and staff message each other. This applies to the student portal and to every applicant&apos;s page.
        </p>
        <MessagingModeSelector mode={mode} />
      </section>
    </div>
  );
}
