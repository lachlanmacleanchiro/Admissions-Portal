import { redirect } from "next/navigation";

// Subject-based conversations now live in the single Messages inbox.
export default function StudentMailThreadsPage() {
  redirect("/messages");
}
