import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import type { EmailTemplateKey } from "@/generated/prisma/client";
import fs from "fs";
import path from "path";

let client: Resend | null = null;

function getClient() {
  if (!client) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}

function getFromAddress() {
  const address = process.env.EMAIL_FROM_ADDRESS;
  const name = process.env.EMAIL_FROM_NAME;
  if (!address) throw new Error("EMAIL_FROM_ADDRESS is not set");
  return name ? `${name} <${address}>` : address;
}

/** Builds an absolute link to a path on the canonical app URL, for use in emails. */
export function buildAppUrl(path: string) {
  const base = process.env.AUTH_URL;
  if (!base) throw new Error("AUTH_URL is not set");
  return new URL(path, base).toString();
}

function render(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] ?? match);
}

const DEFAULT_FOOTER_NOTE =
  "This is an automated message from the NZCC Applicant Portal. Please do not reply directly to this email.";

let cachedLogoDataUri: string | null = null;

function getLogoDataUri(): string {
  if (cachedLogoDataUri !== null) return cachedLogoDataUri;
  try {
    const logoPath = path.join(process.cwd(), "public", "nzcc-logo-white.png");
    const buffer = fs.readFileSync(logoPath);
    cachedLogoDataUri = `data:image/png;base64,${buffer.toString("base64")}`;
  } catch {
    cachedLogoDataUri = "";
  }
  return cachedLogoDataUri;
}

function wrapInBrandedLayout(bodyHtml: string, footerNote = DEFAULT_FOOTER_NOTE): string {
  const logoUrl = getLogoDataUri();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Zealand College of Chiropractic</title>
  </head>
  <body style="margin:0; padding:0; background-color:#F2F2F0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Calibri, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2F2F0; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
            <!-- Letterhead -->
            <tr>
              <td style="background-color:#054B37; padding: 28px 32px;">
                ${logoUrl ? `<img src="${logoUrl}" alt="New Zealand College of Chiropractic" height="40" style="display:block; height:40px; width:auto;" />` : `<span style="color:#ffffff; font-size:18px; font-weight:bold;">New Zealand College of Chiropractic</span>`}
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding: 36px 32px; color:#222222; font-size:15px; line-height:1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="background-color:#F8F8F6; padding: 24px 32px; border-top: 1px solid rgba(0,0,0,0.06);">
                <p style="margin:0 0 6px 0; font-size:13px; font-weight:600; color:#054B37;">New Zealand College of Chiropractic</p>
                <p style="margin:0; font-size:12px; color:#888888; line-height:1.5;">
                  Te Kāreti Kaikorohiti o Aotearoa<br />
                  ${footerNote}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Renders a branded call-to-action button for use inside email template bodies. */
function ctaButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin: 20px 0;"><tr><td style="border-radius:8px; background-color:#00733F;"><a href="${href}" style="display:inline-block; padding: 12px 24px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">${label}</a></td></tr></table>`;
}

export const DEFAULT_EMAIL_TEMPLATES: Record<
  EmailTemplateKey,
  { name: string; description: string; subject: string; bodyHtml: string }
> = {
  ACCOUNT_VERIFICATION: {
    name: "Account Verification",
    description: "Sent when a student registers, to confirm their email address.",
    subject: "Verify your New Zealand College of Chiropractic account",
    bodyHtml: `<p>Kia ora {{firstName}},</p>
<p>Welcome to the New Zealand College of Chiropractic (NZCC) Applicant Portal. Please confirm your email address to activate your account:</p>
${ctaButton("{{verifyUrl}}", "Verify my email")}
<p style="color:#888888; font-size:13px;">This link expires in 24 hours. If you didn't create this account, you can ignore this email.</p>`,
  },
  PASSWORD_RESET: {
    name: "Password Reset",
    description: "Sent when a user requests a password reset.",
    subject: "Reset your NZCC Admissions password",
    bodyHtml: `<p>Kia ora {{firstName}},</p>
<p>We received a request to reset your password. Click below to choose a new one:</p>
${ctaButton("{{resetUrl}}", "Reset my password")}
<p style="color:#888888; font-size:13px;">This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
  },
  STAFF_ACCOUNT_CREATED: {
    name: "Staff Account Created",
    description: "Sent when a global admin creates a new staff account.",
    subject: "Your NZCC Admissions staff account",
    bodyHtml: `<p>Kia ora {{firstName}},</p>
<p>An NZCC Admissions staff account has been created for you.</p>
<p>Email: <strong>{{email}}</strong></p>
<p>Please verify your email to activate your account:</p>
${ctaButton("{{verifyUrl}}", "Verify my email")}`,
  },
  STAGE_CHANGE_NOTIFICATION: {
    name: "Application Stage Changed",
    description: "Sent to a student when their application moves to a new stage.",
    subject: "Your application status has been updated",
    bodyHtml: `<p>Kia ora {{firstName}},</p>
<p>Your application has been updated. Please log in to your account for details.</p>
${ctaButton("{{portalUrl}}", "View your application")}`,
  },
  TASKS_ASSIGNED: {
    name: "New Tasks Assigned",
    description: "Sent to a student when one or more new tasks are assigned to their application.",
    subject: "New tasks assigned to your application",
    bodyHtml: `<p>Kia ora {{firstName}},</p>
<p>Please complete your tasks. The following have been added to your application:</p>
<ul>{{taskList}}</ul>
${ctaButton("{{portalUrl}}", "View your tasks")}`,
  },
  TASK_REMINDER: {
    name: "Task Reminder",
    description: "Sent on demand by staff to remind a student of outstanding tasks.",
    subject: "Reminder: you have outstanding tasks",
    bodyHtml: `<p>Kia ora {{firstName}},</p>
<p>This is a reminder that you still have outstanding tasks on your application:</p>
<ul>{{taskList}}</ul>
<p>Please complete these as soon as possible.</p>
${ctaButton("{{portalUrl}}", "View your tasks")}`,
  },
  TASKS_ALL_COMPLETE_ADMIN: {
    name: "Student Completed All Tasks",
    description: "Sent to staff when a student completes all of their required tasks.",
    subject: "{{studentName}} has completed all required tasks",
    bodyHtml: `<p><strong>{{studentName}}</strong> has completed all of their required tasks:</p>
<ul>{{taskList}}</ul>
${ctaButton("{{applicantUrl}}", "View application")}`,
  },
  OFFER_ISSUED: {
    name: "Offer Issued",
    description: "Sent to a student when an offer of place is issued.",
    subject: "You have received an offer from NZCC",
    bodyHtml: `<p>Kia ora {{firstName}},</p>
<p>Congratulations — you have received a <strong style="color:#00733F;">{{offerType}}</strong> offer of place.</p>
<p>{{deadlineText}}</p>
${ctaButton("{{portalUrl}}", "View your offer")}`,
  },
  OFFER_RESPONSE_ADMIN: {
    name: "Student Responded to Offer",
    description: "Sent to staff when a student accepts or declines an offer.",
    subject: "{{studentName}} has {{responseVerb}} their offer",
    bodyHtml: `<p><strong>{{studentName}}</strong> has <strong>{{responseVerb}}</strong> their {{offerType}} offer.</p>
${ctaButton("{{applicantUrl}}", "View application")}`,
  },
  DOCUMENT_UPLOADED_ADMIN: {
    name: "Student Uploaded a Document",
    description: "Sent to staff when a student uploads a new document for review.",
    subject: "{{studentName}} uploaded a document",
    bodyHtml: `<p><strong>{{studentName}}</strong> has uploaded a new document: <strong>{{filename}}</strong>.</p>
${ctaButton("{{applicantUrl}}", "Review document")}`,
  },
  DOCUMENT_REJECTED: {
    name: "Document Rejected",
    description: "Sent to a student when staff reject an uploaded document.",
    subject: "Action needed: a document was not accepted",
    bodyHtml: `<p>Kia ora {{firstName}},</p>
<p>Your document <strong>{{filename}}</strong> was not accepted.</p>
<p>{{note}}</p>
<p>Please upload a replacement as soon as possible.</p>
${ctaButton("{{portalUrl}}", "View your documents")}`,
  },
  APPLICATION_DECLINED: {
    name: "Application Declined",
    description: "Sent to a student when the admissions committee declines their application.",
    subject: "Update on your NZCC application",
    bodyHtml: `<p>Kia ora {{firstName}},</p>
<p>Thank you for your interest in the Bachelor of Chiropractic at NZCC and for the time you invested in your application.</p>
<p>After careful consideration by our admissions committee, we are unable to offer you a place at this time.</p>
<p>{{note}}</p>
<p>We wish you well in your future endeavours.</p>`,
  },
  ACCOUNT_DELETION_REQUESTED: {
    name: "Account Deletion Requested",
    description: "Sent to staff when a student requests deletion of their account.",
    subject: "Account deletion requested: {{studentName}}",
    bodyHtml: `<p><strong>{{studentName}}</strong> ({{studentEmail}}) has requested that their account be deleted.</p>
<p>The student can no longer sign in to the portal. Please review and action this request in line with our data retention policy.</p>
${ctaButton("{{applicantUrl}}", "View application")}`,
  },
  BANK_TRANSFER_SUBMITTED_ADMIN: {
    name: "Bank Transfer Submitted",
    description: "Sent to staff when a student confirms they have made a bank transfer for their enrolment deposit.",
    subject: "{{studentName}} has submitted a bank transfer",
    bodyHtml: `<p><strong>{{studentName}}</strong> has confirmed a bank transfer for their enrolment deposit.</p>
<p>Please check bank records and approve the transfer once confirmed. Their offer will not be accepted until you do so.</p>
${ctaButton("{{applicantUrl}}", "Review application")}`,
  },
  BANK_TRANSFER_APPROVED: {
    name: "Bank Transfer Approved",
    description: "Sent to a student when staff confirm their bank transfer and accept their offer.",
    subject: "Your deposit has been confirmed",
    bodyHtml: `<p>Kia ora {{firstName}},</p>
<p>We've confirmed your bank transfer and your offer of place has now been accepted. Welcome to NZCC!</p>
${ctaButton("{{portalUrl}}", "View your application")}`,
  },
};

async function getTemplate(key: EmailTemplateKey) {
  const row = await prisma.emailTemplate.findUnique({ where: { key } });
  if (row) return { subject: row.subject, bodyHtml: row.bodyHtml };
  return DEFAULT_EMAIL_TEMPLATES[key];
}

export async function sendTemplatedEmail(
  key: EmailTemplateKey,
  to: string,
  variables: Record<string, string>
) {
  const template = await getTemplate(key);
  await sendEmail({
    to,
    subject: render(template.subject, variables),
    bodyHtml: render(template.bodyHtml, variables),
  });
}

/** Sends a one-off email (already-rendered body HTML) inside the branded NZCC layout. */
export async function sendEmail({
  to,
  subject,
  bodyHtml,
  footerNote,
}: {
  to: string;
  subject: string;
  bodyHtml: string;
  footerNote?: string;
}) {
  const { error } = await getClient().emails.send({
    from: getFromAddress(),
    to,
    subject,
    html: wrapInBrandedLayout(bodyHtml, footerNote),
  });

  if (error) {
    throw new Error(`Resend rejected email to ${to}: ${error.message}`);
  }
}
