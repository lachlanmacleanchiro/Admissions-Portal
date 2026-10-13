import { prisma } from "@/lib/prisma";

/**
 * Everything assigned to one staff member, in one shape: personal to-dos
 * (StaffTask) and applicant tasks assigned to them (Task.assignedToId).
 * Shared by My Tasks, the dashboard and the sidebar badge so counts agree.
 */
export interface MyTaskItem {
  key: string;
  kind: "todo" | "applicant";
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  /** Set for applicant tasks, and for to-dos linked to an applicant. */
  applicant: { id: string; name: string; applicantNumber: string } | null;
  /** Applicant-task status, e.g. SUBMITTED. */
  status: string | null;
  /** STAFF tasks are done by staff; STUDENT tasks are done by the applicant and reviewed by staff. */
  audience: "STAFF" | "STUDENT" | null;
  assignedByName: string | null;
  /**
   * review    — a student task you follow that's been submitted, awaiting your review
   * work      — internal tasks and to-dos you're doing
   * following — a student task you follow that's still with the student
   */
  group: "review" | "work" | "following";
  /** True when the next step is the staff member's (review or work), not the applicant's. */
  needsMyAction: boolean;
}

export async function getMyTasks(userId: string): Promise<MyTaskItem[]> {
  const [todos, applicantTasks] = await Promise.all([
    prisma.staffTask.findMany({
      where: { assignedToId: userId, status: "PENDING" },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        application: { select: { id: true, applicantNumber: true, student: { select: { firstName: true, lastName: true } } } },
      },
    }),
    prisma.task.findMany({
      where: { assignedToId: userId, status: { not: "APPROVED" } },
      include: {
        assignedBy: { select: { firstName: true, lastName: true } },
        application: { select: { id: true, applicantNumber: true, student: { select: { firstName: true, lastName: true } } } },
      },
    }),
  ]);

  const items: MyTaskItem[] = [
    ...todos.map((t): MyTaskItem => ({
      key: `todo-${t.id}`,
      kind: "todo",
      id: t.id,
      title: t.title,
      description: t.description,
      dueDate: t.dueDate,
      applicant: t.application
        ? { id: t.application.id, name: `${t.application.student.firstName} ${t.application.student.lastName}`, applicantNumber: t.application.applicantNumber }
        : null,
      status: null,
      audience: null,
      assignedByName: t.createdBy.id === userId ? null : `${t.createdBy.firstName} ${t.createdBy.lastName}`,
      group: "work",
      needsMyAction: true,
    })),
    ...applicantTasks.map((t): MyTaskItem => ({
      key: `task-${t.id}`,
      kind: "applicant",
      id: t.id,
      title: t.title,
      description: t.description,
      dueDate: t.dueDate,
      applicant: {
        id: t.application.id,
        name: `${t.application.student.firstName} ${t.application.student.lastName}`,
        applicantNumber: t.application.applicantNumber,
      },
      status: t.status,
      audience: t.audience,
      assignedByName: `${t.assignedBy.firstName} ${t.assignedBy.lastName}`,
      // Internal tasks are the assignee's work; student tasks are followed until submitted for review.
      group: t.audience === "STAFF" ? "work" : t.status === "SUBMITTED" ? "review" : "following",
      needsMyAction: t.audience === "STAFF" || t.status === "SUBMITTED",
    })),
  ];

  // Soonest due first; undated last.
  return items.sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity));
}

export async function countMyActionableTasks(userId: string): Promise<number> {
  const [todos, staffTasks, reviews] = await Promise.all([
    prisma.staffTask.count({ where: { assignedToId: userId, status: "PENDING" } }),
    prisma.task.count({ where: { assignedToId: userId, audience: "STAFF", status: { not: "APPROVED" } } }),
    prisma.task.count({ where: { assignedToId: userId, audience: "STUDENT", status: "SUBMITTED" } }),
  ]);
  return todos + staffTasks + reviews;
}
