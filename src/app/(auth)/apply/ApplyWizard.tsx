"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { uploadWithProgress } from "@/lib/uploadWithProgress";
import { UploadProgress } from "@/components/ui/UploadProgress";

const STEPS = [
  "Choose Path",
  "Personal Details",
  "Support & Disclosure",
  "Contact Details",
  "Education Record",
  "English Proficiency",
  "Academic Integrity",
  "Chiropractic Experience",
  "Personal Statement",
  "General Information",
  "Finalisation",
];

interface EducationEntry {
  level: "SECONDARY" | "TERTIARY";
  institutionName: string;
  country: string;
  yearStarted: string;
  qualification: string;
  yearCompleted: string;
}

interface ExperienceEntry {
  chiropractorName: string;
  status: "OBSERVING" | "UNDER_CARE";
}

interface FormState {
  category: "DOMESTIC" | "INTERNATIONAL" | "";
  yearLevel: "YEAR_1" | "YEAR_2" | "";
  intakeYearId: string;

  firstName: string;
  lastName: string;
  middleName: string;
  preferredFirstName: string;
  email: string;
  password: string;
  confirmPassword: string;
  dateOfBirth: string;
  gender: string;
  preferredPronouns: string;
  maoriPacificaStatus: string;
  citizenshipCountry: string;

  hasDisabilitySupportNeed: boolean;
  disabilitySupportCategory: string;
  hasCriminalConviction: boolean;
  criminalConvictionDetails: string;
  hasPendingLegalProceedings: boolean;
  pendingLegalProceedingsDetails: string;

  address: string;
  suburb: string;
  city: string;
  postcode: string;
  country: string;
  useAlternativeAddress: boolean;
  alternativeAddress: string;
  alternativeSuburb: string;
  alternativeCity: string;
  alternativePostcode: string;
  alternativeCountry: string;
  phone: string;

  hasCompletedTertiaryStudy: boolean;
  nationalStudentNumber: string;
  educationHistory: EducationEntry[];

  englishProficiencyStatus: string;
  ieltsTestDate: string;
  englishProficiencyDetails: string;

  hasPriorAcademicIssues: boolean;
  priorAcademicIssuesDetails: string;
  hasPriorComplaints: boolean;
  priorComplaintsDetails: string;
  hasDishonestyAllegations: boolean;
  dishonestyAllegationsDetails: string;

  chiropracticExperience: ExperienceEntry[];

  personalStatement: string;
  referralSource: string;

  declarationAccepted: boolean;
  declarationSignatureName: string;

  guardianName: string;
  guardianEmail: string;
  guardianPhone: string;
  guardianRelation: string;
}

const INITIAL_STATE: FormState = {
  category: "", yearLevel: "", intakeYearId: "",
  firstName: "", lastName: "", middleName: "", preferredFirstName: "", email: "", password: "", confirmPassword: "",
  dateOfBirth: "", gender: "", preferredPronouns: "", maoriPacificaStatus: "", citizenshipCountry: "",
  hasDisabilitySupportNeed: false, disabilitySupportCategory: "",
  hasCriminalConviction: false, criminalConvictionDetails: "",
  hasPendingLegalProceedings: false, pendingLegalProceedingsDetails: "",
  address: "", suburb: "", city: "", postcode: "", country: "", phone: "",
  useAlternativeAddress: false, alternativeAddress: "", alternativeSuburb: "", alternativeCity: "", alternativePostcode: "", alternativeCountry: "",
  hasCompletedTertiaryStudy: false, nationalStudentNumber: "", educationHistory: [],
  englishProficiencyStatus: "", ieltsTestDate: "", englishProficiencyDetails: "",
  hasPriorAcademicIssues: false, priorAcademicIssuesDetails: "",
  hasPriorComplaints: false, priorComplaintsDetails: "",
  hasDishonestyAllegations: false, dishonestyAllegationsDetails: "",
  chiropracticExperience: [],
  personalStatement: "", referralSource: "",
  declarationAccepted: false, declarationSignatureName: "",
  guardianName: "", guardianEmail: "", guardianPhone: "", guardianRelation: "",
};

function StepShell({
  stepIndex,
  children,
}: {
  stepIndex: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-8">
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#999" }}>
          Step {stepIndex + 1} of {STEPS.length}
        </p>
        <p className="text-xs" style={{ color: "#bbb" }}>{STEPS[stepIndex]}</p>
      </div>
      <div className="w-full h-1 rounded-full mb-8" style={{ backgroundColor: "#F0F0EE" }}>
        <div
          className="h-1 rounded-full transition-all"
          style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%`, backgroundColor: "#114E3B" }}
        />
      </div>
      <h2 className="font-serif text-xl text-text mb-6">{STEPS[stepIndex]}</h2>
      {children}
    </div>
  );
}

interface IntakeYearOption {
  id: string;
  year: number;
  label: string;
}

export function ApplyWizard({ openIntakeYears }: { openIntakeYears: IntakeYearOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [citizenshipProof, setCitizenshipProof] = useState<File | null>(null);
  const [ieltsCertificate, setIeltsCertificate] = useState<File | null>(null);
  const [recommendationLetter, setRecommendationLetter] = useState<File | null>(null);
  const [fileErrors, setFileErrors] = useState<{ citizenshipProof?: string; ieltsCertificate?: string; recommendationLetter?: string }>({});
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // 0–1 while the application and its files upload; null otherwise.
  const [submitProgress, setSubmitProgress] = useState<number | null>(null);
  const [savedEducationIndices, setSavedEducationIndices] = useState<Set<number>>(new Set());
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [emailCheckStatus, setEmailCheckStatus] = useState<"idle" | "checking" | "taken" | "available">("idle");

  useEffect(() => {
    const email = form.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailCheckStatus("idle");
      return;
    }

    setEmailCheckStatus("checking");
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/apply/check-email?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        setEmailCheckStatus(data.exists ? "taken" : "available");
      } catch {
        setEmailCheckStatus("idle");
      }
    }, 1500);

    return () => clearTimeout(timeout);
  }, [form.email]);

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
  const ALLOWED_UPLOAD_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ];
  const DOC_ONLY_UPLOAD_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const PDF_ONLY_UPLOAD_TYPES = ["application/pdf"];

  function handleFileSelect(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (file: File | null) => void,
    field: "citizenshipProof" | "ieltsCertificate" | "recommendationLetter",
    allowedTypes: string[] = ALLOWED_UPLOAD_TYPES
  ) {
    const file = e.target.files?.[0] ?? null;
    if (!file) { setter(null); setFileErrors((prev) => ({ ...prev, [field]: undefined })); return; }
    if (file.size > MAX_UPLOAD_SIZE) {
      setFileErrors((prev) => ({ ...prev, [field]: "File exceeds the 10MB size limit." }));
      e.target.value = "";
      setter(null);
      return;
    }
    if (!allowedTypes.includes(file.type)) {
      setFileErrors((prev) => ({ ...prev, [field]: "Unsupported file type." }));
      e.target.value = "";
      setter(null);
      return;
    }
    setFileErrors((prev) => ({ ...prev, [field]: undefined }));
    setter(file);
  }

  function validateStep(): string | null {
    switch (step) {
      case 0:
        if (!form.category || !form.yearLevel) return "Please select your applicant type and year of enrolment.";
        if (!form.intakeYearId) return "Please select an intake year.";
        return null;
      case 1: {
        if (!form.firstName || !form.lastName || !form.email || !form.password) return "Please complete all required fields.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Please enter a valid email address.";
        if (emailCheckStatus === "taken") return "An account with this email already exists.";
        if (emailCheckStatus === "checking") return "Please wait while we check your email address.";
        if (form.password !== form.confirmPassword) return "Passwords do not match.";
        if (form.password.length < 8) return "Password must be at least 8 characters.";
        if (!form.dateOfBirth || !form.gender || !form.maoriPacificaStatus || !form.citizenshipCountry) return "Please complete all required fields.";
        if (fileErrors.citizenshipProof) return "Please resolve the citizenship / residency proof upload error.";
        if (!citizenshipProof) return "Please upload your citizenship / residency proof.";
        return null;
      }
      case 2:
        if (form.hasDisabilitySupportNeed && !form.disabilitySupportCategory.trim()) return "Please describe your support category.";
        if (form.hasCriminalConviction && !form.criminalConvictionDetails.trim()) return "Please provide details of your criminal conviction(s).";
        if (form.hasPendingLegalProceedings && !form.pendingLegalProceedingsDetails.trim()) return "Please provide details of your pending legal proceedings.";
        return null;
      case 3:
        if (!form.address || !form.city || !form.country || !form.postcode.trim()) return "Please complete your permanent address, including postcode.";
        if (form.useAlternativeAddress && (!form.alternativeAddress.trim() || !form.alternativeCity.trim() || !form.alternativeCountry.trim())) {
          return "Please complete your alternative postal address, or untick the checkbox.";
        }
        return null;
      case 4:
        if (form.category === "DOMESTIC" && !form.nationalStudentNumber.trim()) return "Please provide your National Student Number (NSN).";
        if (form.educationHistory.length === 0) return "Please add at least one education history entry.";
        for (const e of form.educationHistory) {
          if (!e.institutionName.trim() || !e.country.trim() || !e.yearStarted.trim()) {
            return "Please complete or remove all education history entries before continuing.";
          }
        }
        return null;
      case 5:
        if (!form.englishProficiencyStatus) return "Please select your English proficiency status.";
        if (form.englishProficiencyStatus === "IELTS_BOOKED" && !form.ieltsTestDate) return "Please provide your IELTS test date.";
        if (form.englishProficiencyStatus === "IELTS_CERTIFIED") {
          if (fileErrors.ieltsCertificate) return "Please resolve the IELTS certificate upload error.";
          if (!ieltsCertificate) return "Please upload your IELTS certificate.";
        }
        if (form.englishProficiencyStatus === "HANDBOOK_MET" && !form.englishProficiencyDetails.trim()) return "Please provide details.";
        return null;
      case 6:
        if (form.hasPriorAcademicIssues && !form.priorAcademicIssuesDetails.trim()) return "Please provide details of your prior academic issues.";
        if (form.hasPriorComplaints && !form.priorComplaintsDetails.trim()) return "Please provide details of the complaint(s).";
        if (form.hasDishonestyAllegations && !form.dishonestyAllegationsDetails.trim()) return "Please provide details of the allegation(s).";
        return null;
      case 7:
        if (fileErrors.recommendationLetter) return "Please resolve the recommendation letter upload error.";
        for (const e of form.chiropracticExperience) {
          if (!e.chiropractorName.trim()) {
            return "Please complete or remove all chiropractic experience entries before continuing.";
          }
        }
        return null;
      case 8:
        if (!form.personalStatement.trim()) return "Please write your personal statement.";
        if (form.personalStatement.trim().split(/\s+/).length > 300) return "Personal statement should be around 250 words (max 300).";
        return null;
      case 9:
        if (!form.referralSource) return "Please tell us how you heard about NZCC.";
        return null;
      case 10:
        if (!form.declarationAccepted) return "You must accept the declaration to continue.";
        if (!form.declarationSignatureName.trim()) return "Please type your full legal name as your signature.";
        return null;
      default:
        return null;
    }
  }

  function next() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setError("");
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError("");
    setIsLoading(true);

    const payload = {
      category: form.category, yearLevel: form.yearLevel, intakeYearId: form.intakeYearId,
      firstName: form.firstName, lastName: form.lastName, middleName: form.middleName || undefined,
      preferredFirstName: form.preferredFirstName || undefined, email: form.email, password: form.password,
      dateOfBirth: form.dateOfBirth, gender: form.gender, preferredPronouns: form.preferredPronouns || undefined,
      maoriPacificaStatus: form.maoriPacificaStatus, citizenshipCountry: form.citizenshipCountry,
      hasDisabilitySupportNeed: form.hasDisabilitySupportNeed, disabilitySupportCategory: form.disabilitySupportCategory || undefined,
      hasCriminalConviction: form.hasCriminalConviction, criminalConvictionDetails: form.hasCriminalConviction ? form.criminalConvictionDetails : undefined,
      hasPendingLegalProceedings: form.hasPendingLegalProceedings, pendingLegalProceedingsDetails: form.hasPendingLegalProceedings ? form.pendingLegalProceedingsDetails : undefined,
      phone: form.phone || undefined, address: form.address, suburb: form.suburb || undefined, city: form.city,
      postcode: form.postcode, country: form.country,
      useAlternativeAddress: form.useAlternativeAddress,
      alternativeAddress: form.useAlternativeAddress ? form.alternativeAddress : undefined,
      alternativeSuburb: form.useAlternativeAddress ? form.alternativeSuburb : undefined,
      alternativeCity: form.useAlternativeAddress ? form.alternativeCity : undefined,
      alternativePostcode: form.useAlternativeAddress ? form.alternativePostcode : undefined,
      alternativeCountry: form.useAlternativeAddress ? form.alternativeCountry : undefined,
      hasCompletedTertiaryStudy: form.hasCompletedTertiaryStudy, nationalStudentNumber: form.nationalStudentNumber || undefined,
      educationHistory: form.educationHistory.map((e) => ({
        level: e.level, institutionName: e.institutionName, country: e.country,
        yearStarted: parseInt(e.yearStarted, 10), qualification: e.qualification || undefined,
        yearCompleted: e.yearCompleted ? parseInt(e.yearCompleted, 10) : undefined,
      })),
      chiropracticExperience: form.chiropracticExperience.map((e) => ({
        chiropractorName: e.chiropractorName, status: e.status,
      })),
      englishProficiencyStatus: form.englishProficiencyStatus,
      ieltsTestDate: form.ieltsTestDate || undefined,
      englishProficiencyDetails: form.englishProficiencyDetails || undefined,
      hasPriorAcademicIssues: form.hasPriorAcademicIssues, priorAcademicIssuesDetails: form.hasPriorAcademicIssues ? form.priorAcademicIssuesDetails : undefined,
      hasPriorComplaints: form.hasPriorComplaints, priorComplaintsDetails: form.hasPriorComplaints ? form.priorComplaintsDetails : undefined,
      hasDishonestyAllegations: form.hasDishonestyAllegations, dishonestyAllegationsDetails: form.hasDishonestyAllegations ? form.dishonestyAllegationsDetails : undefined,
      personalStatement: form.personalStatement, referralSource: form.referralSource,
      declarationSignatureName: form.declarationSignatureName,
      guardianName: form.guardianName || undefined, guardianEmail: form.guardianEmail || undefined,
      guardianPhone: form.guardianPhone || undefined, guardianRelation: form.guardianRelation || undefined,
    };

    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));
    if (citizenshipProof) formData.append("citizenshipProof", citizenshipProof);
    if (ieltsCertificate) formData.append("ieltsCertificate", ieltsCertificate);
    if (recommendationLetter) formData.append("recommendationLetter", recommendationLetter);

    setSubmitProgress(0);
    const res = await uploadWithProgress<{ error?: string }>("/api/apply", formData, setSubmitProgress);
    setIsLoading(false);
    setSubmitProgress(null);

    if (!res.ok) {
      setError(res.data?.error ?? "Submission failed. Check your connection and try again.");
      return;
    }

    setIsSubmitted(true);
  }

  function addEducationEntry() {
    set("educationHistory", [
      ...form.educationHistory,
      { level: "SECONDARY", institutionName: "", country: "", yearStarted: "", qualification: "", yearCompleted: "" },
    ]);
  }

  function updateEducationEntry(index: number, field: keyof EducationEntry, value: string) {
    const next = [...form.educationHistory];
    next[index] = { ...next[index], [field]: value };
    set("educationHistory", next);
  }

  function removeEducationEntry(index: number) {
    set("educationHistory", form.educationHistory.filter((_, i) => i !== index));
    setSavedEducationIndices((prev) => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      }
      return next;
    });
  }

  function saveEducationEntry(index: number) {
    setSavedEducationIndices((prev) => new Set(prev).add(index));
  }

  function editEducationEntry(index: number) {
    setSavedEducationIndices((prev) => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  }

  function addExperienceEntry() {
    set("chiropracticExperience", [
      ...form.chiropracticExperience,
      { chiropractorName: "", status: "OBSERVING" },
    ]);
  }

  function updateExperienceEntry(index: number, field: keyof ExperienceEntry, value: string) {
    const next = [...form.chiropracticExperience];
    next[index] = { ...next[index], [field]: value };
    set("chiropracticExperience", next);
  }

  function removeExperienceEntry(index: number) {
    set("chiropracticExperience", form.chiropracticExperience.filter((_, i) => i !== index));
  }

  const wordCount = form.personalStatement.trim() ? form.personalStatement.trim().split(/\s+/).length : 0;

  if (isSubmitted) {
    return (
      <div className="bg-white rounded-xl shadow-sm px-10 py-14 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: "rgba(34,197,94,0.12)" }}>
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: "#22c55e" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-serif text-2xl text-text mb-4">Your Application Has Been Submitted</h2>
        <p className="text-sm text-text-muted max-w-lg leading-relaxed">
          Thank you for applying to the New Zealand College of Chiropractic. One of our team will be in touch
          with you soon to discuss your application.
        </p>
        <p className="text-sm text-text-muted max-w-lg leading-relaxed mt-4">
          You can track the progress of your application at any time through the applicant portal, using the
          email address (<strong>{form.email}</strong>) and password you just set.
        </p>
        <Button onClick={() => router.push("/login?registered=1")} className="mt-8">
          Go to Login
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <StepShell stepIndex={step}>
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-muted mb-2">Select the option that best describes your application.</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                ["DOMESTIC", "YEAR_1", "NZ Domestic — Year 1"],
                ["DOMESTIC", "YEAR_2", "NZ Domestic — Year 2"],
                ["INTERNATIONAL", "YEAR_1", "International — Year 1"],
                ["INTERNATIONAL", "YEAR_2", "International — Year 2"],
              ] as const).map(([cat, yr, label]) => {
                const isSelected = form.category === cat && form.yearLevel === yr;
                return (
                  <button
                    key={label}
                    onClick={() => { set("category", cat); set("yearLevel", yr); }}
                    className="px-4 py-5 rounded-xl text-sm font-semibold text-left transition-colors"
                    style={{
                      backgroundColor: isSelected ? "#114E3B" : "#F8F8F6",
                      color: isSelected ? "#fff" : "#333",
                      border: `1.5px solid ${isSelected ? "#114E3B" : "rgba(0,0,0,0.1)"}`,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="mt-2">
              <label className="text-sm font-semibold text-text mb-1.5 block">Intake year *</label>
              {openIntakeYears.length === 0 ? (
                <p className="text-sm" style={{ color: "#c0392b" }}>
                  There are no intakes currently open for applications. Please check back later.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {openIntakeYears.map((iy) => {
                    const isSelected = form.intakeYearId === iy.id;
                    return (
                      <button
                        key={iy.id}
                        onClick={() => set("intakeYearId", iy.id)}
                        className="px-4 py-3 rounded-xl text-sm font-semibold text-left transition-colors"
                        style={{
                          backgroundColor: isSelected ? "#114E3B" : "#F8F8F6",
                          color: isSelected ? "#fff" : "#333",
                          border: `1.5px solid ${isSelected ? "#114E3B" : "rgba(0,0,0,0.1)"}`,
                        }}
                      >
                        {iy.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First / given name *" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
              <Input label="Last / family name *" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
              <Input label="Middle name" value={form.middleName} onChange={(e) => set("middleName", e.target.value)} />
              <Input label="Preferred first name" value={form.preferredFirstName} onChange={(e) => set("preferredFirstName", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email-address" className="text-sm font-semibold text-text">Email address *</label>
              <div className="relative">
                <input
                  id="email-address"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 rounded-lg text-sm text-text placeholder:text-text-light focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{
                    backgroundColor: "#F8F8F6",
                    border: emailCheckStatus === "taken" ? "1.5px solid #c0392b" : "1.5px solid rgba(0,0,0,0.1)",
                  }}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {emailCheckStatus === "checking" && (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" style={{ color: "#888" }}>
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
                      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  )}
                  {emailCheckStatus === "available" && (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#2F964A" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              {emailCheckStatus === "taken" && (
                <p className="text-xs text-red-flag">Email is already registered.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Password *" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
              <Input label="Confirm password *" type="password" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} autoComplete="new-password" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Date of birth *" type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
              <Select label="Gender *" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                <option value="">Select…</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="DIVERSE">Diverse</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <Select label="Preferred pronouns" value={form.preferredPronouns} onChange={(e) => set("preferredPronouns", e.target.value)}>
              <option value="">Prefer not to say</option>
              <option value="She/Her">She/Her</option>
              <option value="He/Him">He/Him</option>
              <option value="They/Them">They/Them</option>
            </Select>
            <Select label="Māori / Pacifica status *" value={form.maoriPacificaStatus} onChange={(e) => set("maoriPacificaStatus", e.target.value)}>
              <option value="">Select…</option>
              <option value="NEITHER">Neither</option>
              <option value="MAORI">Māori</option>
              <option value="PACIFICA">Pacifica</option>
              <option value="BOTH">Both</option>
            </Select>
            <Input label="Country of citizenship *" value={form.citizenshipCountry} onChange={(e) => set("citizenshipCountry", e.target.value)} />
            <div>
              <label className="text-sm font-semibold text-text mb-1.5 block">Citizenship / residency proof *</label>
              <p className="text-xs text-text-muted mb-2">Passport, birth certificate, whakapapa, or refugee documentation. PDF only · Max 10MB.</p>
              <input type="file" onChange={(e) => handleFileSelect(e, setCitizenshipProof, "citizenshipProof", PDF_ONLY_UPLOAD_TYPES)} accept=".pdf" className="text-sm" />
              {fileErrors.citizenshipProof && <p className="text-xs text-red-flag mt-1">{fileErrors.citizenshipProof}</p>}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-sm font-semibold text-text mb-2">Do you have a disability or learning support need? *</p>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={form.hasDisabilitySupportNeed} onChange={() => set("hasDisabilitySupportNeed", true)} /> Yes</label>
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={!form.hasDisabilitySupportNeed} onChange={() => set("hasDisabilitySupportNeed", false)} /> No</label>
              </div>
              {form.hasDisabilitySupportNeed && (
                <div className="mt-3">
                  <Input label="Please describe your support category" value={form.disabilitySupportCategory} onChange={(e) => set("disabilitySupportCategory", e.target.value)} />
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-text mb-2">Do you have any criminal convictions? *</p>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={form.hasCriminalConviction} onChange={() => set("hasCriminalConviction", true)} /> Yes</label>
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={!form.hasCriminalConviction} onChange={() => { set("hasCriminalConviction", false); set("criminalConvictionDetails", ""); }} /> No</label>
              </div>
              {form.hasCriminalConviction && (
                <div className="mt-3">
                  <Textarea label="Please provide details *" rows={3} value={form.criminalConvictionDetails} onChange={(e) => set("criminalConvictionDetails", e.target.value)} />
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-text mb-2">Do you have any pending legal proceedings? *</p>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={form.hasPendingLegalProceedings} onChange={() => set("hasPendingLegalProceedings", true)} /> Yes</label>
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={!form.hasPendingLegalProceedings} onChange={() => { set("hasPendingLegalProceedings", false); set("pendingLegalProceedingsDetails", ""); }} /> No</label>
              </div>
              {form.hasPendingLegalProceedings && (
                <div className="mt-3">
                  <Textarea label="Please provide details *" rows={3} value={form.pendingLegalProceedingsDetails} onChange={(e) => set("pendingLegalProceedingsDetails", e.target.value)} />
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <Input label="Phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            <p className="text-[11px] font-semibold uppercase tracking-widest mt-2" style={{ color: "#999" }}>Permanent Address</p>
            <Input label="Street address *" value={form.address} onChange={(e) => set("address", e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Suburb" value={form.suburb} onChange={(e) => set("suburb", e.target.value)} />
              <Input label="City *" value={form.city} onChange={(e) => set("city", e.target.value)} />
              <Input label="Postcode *" value={form.postcode} onChange={(e) => set("postcode", e.target.value)} />
              <Input label="Country *" value={form.country} onChange={(e) => set("country", e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm mt-2">
              <input type="checkbox" checked={form.useAlternativeAddress} onChange={(e) => set("useAlternativeAddress", e.target.checked)} />
              I have an alternative postal address
            </label>
            {form.useAlternativeAddress && (
              <div className="flex flex-col gap-3 mt-1">
                <Input label="Street address" value={form.alternativeAddress} onChange={(e) => set("alternativeAddress", e.target.value)} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Suburb" value={form.alternativeSuburb} onChange={(e) => set("alternativeSuburb", e.target.value)} />
                  <Input label="City" value={form.alternativeCity} onChange={(e) => set("alternativeCity", e.target.value)} />
                  <Input label="Postcode" value={form.alternativePostcode} onChange={(e) => set("alternativePostcode", e.target.value)} />
                  <Input label="Country" value={form.alternativeCountry} onChange={(e) => set("alternativeCountry", e.target.value)} />
                </div>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-sm font-semibold text-text mb-2">Have you completed any tertiary education? *</p>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={form.hasCompletedTertiaryStudy} onChange={() => set("hasCompletedTertiaryStudy", true)} /> Yes</label>
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={!form.hasCompletedTertiaryStudy} onChange={() => set("hasCompletedTertiaryStudy", false)} /> No</label>
              </div>
            </div>
            <Input
              label={`National Student Number (NSN)${form.category === "DOMESTIC" ? " *" : ""}`}
              value={form.nationalStudentNumber}
              onChange={(e) => set("nationalStudentNumber", e.target.value)}
            />

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#999" }}>Education History *</p>
                <button onClick={addEducationEntry} className="text-xs font-semibold" style={{ color: "#114E3B" }}>+ Add entry</button>
              </div>
              {form.educationHistory.length === 0 && <p className="text-xs text-text-muted">Please add at least one entry.</p>}
              <div className="flex flex-col gap-3">
                {form.educationHistory.map((entry, i) => {
                  const isSaved = savedEducationIndices.has(i);
                  if (isSaved) {
                    return (
                      <div key={i} className="p-4 rounded-lg flex items-center justify-between gap-3" style={{ backgroundColor: "#F8F8F6", border: "1px solid rgba(0,0,0,0.06)" }}>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "#222" }}>
                            {entry.institutionName || "Untitled institution"}
                            <span className="ml-2 text-xs font-normal" style={{ color: "#888" }}>
                              {entry.level === "SECONDARY" ? "Secondary" : "Tertiary"}
                            </span>
                          </p>
                          <p className="text-xs truncate" style={{ color: "#888" }}>
                            {[entry.country, entry.qualification, [entry.yearStarted, entry.yearCompleted].filter(Boolean).join("–")].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <div className="flex gap-3 flex-shrink-0">
                          <button onClick={() => editEducationEntry(i)} className="text-xs font-semibold" style={{ color: "#114E3B" }}>Edit</button>
                          <button onClick={() => removeEducationEntry(i)} className="text-xs" style={{ color: "#c0392b" }}>Remove</button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="p-4 rounded-lg flex flex-col gap-2" style={{ backgroundColor: "#F8F8F6", border: "1px solid rgba(0,0,0,0.06)" }}>
                      <div className="flex items-center justify-between">
                        <Select value={entry.level} onChange={(e) => updateEducationEntry(i, "level", e.target.value)} className="w-40">
                          <option value="SECONDARY">Secondary</option>
                          <option value="TERTIARY">Tertiary</option>
                        </Select>
                        <button onClick={() => removeEducationEntry(i)} className="text-xs" style={{ color: "#c0392b" }}>Remove</button>
                      </div>
                      <Input label="Institution name" value={entry.institutionName} onChange={(e) => updateEducationEntry(i, "institutionName", e.target.value)} />
                      <div className="grid grid-cols-2 gap-2">
                        <Input label="Country" value={entry.country} onChange={(e) => updateEducationEntry(i, "country", e.target.value)} />
                        <Input label="Qualification" value={entry.qualification} onChange={(e) => updateEducationEntry(i, "qualification", e.target.value)} />
                        <Input label="Year started" type="number" value={entry.yearStarted} onChange={(e) => updateEducationEntry(i, "yearStarted", e.target.value)} />
                        <Input label="Year completed" type="number" value={entry.yearCompleted} onChange={(e) => updateEducationEntry(i, "yearCompleted", e.target.value)} />
                      </div>
                      <div className="flex justify-end mt-1">
                        <Button size="sm" onClick={() => saveEducationEntry(i)}>Save</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col gap-4">
            <Select label="English proficiency status *" value={form.englishProficiencyStatus} onChange={(e) => set("englishProficiencyStatus", e.target.value)}>
              <option value="">Select…</option>
              <option value="FIRST_LANGUAGE">English is my first language</option>
              <option value="IELTS_BOOKED">I have booked an IELTS test</option>
              <option value="IELTS_CERTIFIED">I hold an IELTS certificate</option>
              <option value="HANDBOOK_MET">I meet a Student Handbook requirement</option>
            </Select>
            {form.englishProficiencyStatus === "IELTS_BOOKED" && (
              <Input label="IELTS test date" type="date" value={form.ieltsTestDate} onChange={(e) => set("ieltsTestDate", e.target.value)} />
            )}
            {form.englishProficiencyStatus === "IELTS_CERTIFIED" && (
              <div>
                <label className="text-sm font-semibold text-text mb-1.5 block">IELTS certificate *</label>
                <p className="text-xs text-text-muted mb-2">PDF only · Max 10MB. Certificate must have been issued within the last 2 years.</p>
                <input type="file" onChange={(e) => handleFileSelect(e, setIeltsCertificate, "ieltsCertificate", PDF_ONLY_UPLOAD_TYPES)} accept=".pdf" className="text-sm" />
                {fileErrors.ieltsCertificate && <p className="text-xs text-red-flag mt-1">{fileErrors.ieltsCertificate}</p>}
              </div>
            )}
            {form.englishProficiencyStatus === "HANDBOOK_MET" && (
              <Textarea label="Please provide details" rows={3} value={form.englishProficiencyDetails} onChange={(e) => set("englishProficiencyDetails", e.target.value)} />
            )}
          </div>
        )}

        {step === 6 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-sm font-semibold text-text mb-2">Have you had any prior academic issues? *</p>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={form.hasPriorAcademicIssues} onChange={() => set("hasPriorAcademicIssues", true)} /> Yes</label>
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={!form.hasPriorAcademicIssues} onChange={() => { set("hasPriorAcademicIssues", false); set("priorAcademicIssuesDetails", ""); }} /> No</label>
              </div>
              {form.hasPriorAcademicIssues && (
                <div className="mt-3">
                  <Textarea label="Please provide details *" rows={3} value={form.priorAcademicIssuesDetails} onChange={(e) => set("priorAcademicIssuesDetails", e.target.value)} />
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-text mb-2">Have any complaints been made against you by students or institutions? *</p>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={form.hasPriorComplaints} onChange={() => set("hasPriorComplaints", true)} /> Yes</label>
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={!form.hasPriorComplaints} onChange={() => { set("hasPriorComplaints", false); set("priorComplaintsDetails", ""); }} /> No</label>
              </div>
              {form.hasPriorComplaints && (
                <div className="mt-3">
                  <Textarea label="Please provide details *" rows={3} value={form.priorComplaintsDetails} onChange={(e) => set("priorComplaintsDetails", e.target.value)} />
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-text mb-2">Have you ever faced allegations of academic dishonesty? *</p>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={form.hasDishonestyAllegations} onChange={() => set("hasDishonestyAllegations", true)} /> Yes</label>
                <label className="flex items-center gap-2 text-sm"><input type="radio" checked={!form.hasDishonestyAllegations} onChange={() => { set("hasDishonestyAllegations", false); set("dishonestyAllegationsDetails", ""); }} /> No</label>
              </div>
              {form.hasDishonestyAllegations && (
                <div className="mt-3">
                  <Textarea label="Please provide details *" rows={3} value={form.dishonestyAllegationsDetails} onChange={(e) => set("dishonestyAllegationsDetails", e.target.value)} />
                </div>
              )}
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">This section is optional — complete it if you have prior exposure to chiropractic care.</p>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#999" }}>Chiropractic Experience</p>
              <button onClick={addExperienceEntry} className="text-xs font-semibold" style={{ color: "#114E3B" }}>+ Add entry</button>
            </div>
            {form.chiropracticExperience.length === 0 && <p className="text-xs text-text-muted">No entries added yet.</p>}
            <div className="flex flex-col gap-3">
              {form.chiropracticExperience.map((entry, i) => (
                <div key={i} className="p-4 rounded-lg flex flex-col gap-2" style={{ backgroundColor: "#F8F8F6", border: "1px solid rgba(0,0,0,0.06)" }}>
                  <div className="flex items-center justify-between">
                    <Select value={entry.status} onChange={(e) => updateExperienceEntry(i, "status", e.target.value)} className="w-48">
                      <option value="OBSERVING">Observing</option>
                      <option value="UNDER_CARE">Under care</option>
                    </Select>
                    <button onClick={() => removeExperienceEntry(i)} className="text-xs" style={{ color: "#c0392b" }}>Remove</button>
                  </div>
                  <Input label="Chiropractor name" value={entry.chiropractorName} onChange={(e) => updateExperienceEntry(i, "chiropractorName", e.target.value)} />
                </div>
              ))}
            </div>
            <div>
              <label className="text-sm font-semibold text-text mb-1.5 block">Chiropractor recommendation letter</label>
              <p className="text-xs text-text-muted mb-2">PDF or Word document · Max 10MB.</p>
              <input type="file" onChange={(e) => handleFileSelect(e, setRecommendationLetter, "recommendationLetter", DOC_ONLY_UPLOAD_TYPES)} accept=".pdf,.doc,.docx" className="text-sm" />
              {fileErrors.recommendationLetter && <p className="text-xs text-red-flag mt-1">{fileErrors.recommendationLetter}</p>}
            </div>
          </div>
        )}

        {step === 8 && (
          <div className="flex flex-col gap-2">
            <Textarea
              label="Tell us about yourself and your motivation to study chiropractic *"
              rows={10}
              value={form.personalStatement}
              onChange={(e) => set("personalStatement", e.target.value)}
              placeholder="Around 250 words…"
            />
            <p className="text-xs" style={{ color: wordCount > 300 ? "#c0392b" : "#aaa" }}>{wordCount} words</p>
          </div>
        )}

        {step === 9 && (
          <div className="flex flex-col gap-4">
            <Select label="How did you hear about NZCC? *" value={form.referralSource} onChange={(e) => set("referralSource", e.target.value)}>
              <option value="">Select…</option>
              <option value="ADVERTISEMENT">Advertisement</option>
              <option value="CAREER_FAIR">Career fair</option>
              <option value="ADVISOR">Advisor</option>
              <option value="INTERNET">Internet</option>
              <option value="EXPO">Expo</option>
              <option value="SOCIAL_MEDIA">Social media</option>
              <option value="CHIROPRACTOR">A chiropractor</option>
              <option value="NZCC_ALUMNUS">NZCC alumnus</option>
              <option value="FRIEND_FAMILY">Friend or family</option>
              <option value="FACULTY_STAFF">Faculty or staff</option>
              <option value="OTHER">Other</option>
            </Select>

            <p className="text-[11px] font-semibold uppercase tracking-widest mt-2" style={{ color: "#999" }}>Next of Kin (optional)</p>
            <Input label="Full name" value={form.guardianName} onChange={(e) => set("guardianName", e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Email" type="email" value={form.guardianEmail} onChange={(e) => set("guardianEmail", e.target.value)} />
              <Input label="Phone" type="tel" value={form.guardianPhone} onChange={(e) => set("guardianPhone", e.target.value)} />
            </div>
            <Input label="Relationship" value={form.guardianRelation} onChange={(e) => set("guardianRelation", e.target.value)} />
          </div>
        )}

        {step === 10 && (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-lg text-sm" style={{ backgroundColor: "#F8F8F6" }}>
              <p className="font-semibold mb-1">Privacy Act Notice</p>
              <p className="text-text-muted text-xs">
                Information collected in this application is used solely for the purpose of assessing your enrolment
                and will be handled in accordance with the Privacy Act 2020.
              </p>
            </div>
            <div className="p-4 rounded-lg text-sm" style={{ backgroundColor: "#F8F8F6" }}>
              <p className="font-semibold mb-1">Student Handbook</p>
              <p className="text-text-muted text-xs">
                By submitting this application, you confirm that you have reviewed the{" "}
                <a
                  href="https://chiropractic.ac.nz/wp-content/uploads/NZCC_260805_Student-Handbook-2026.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                  style={{ color: "#114E3B" }}
                >
                  NZCC Student Handbook
                </a>{" "}
                and agree to abide by its policies if enrolled.
              </p>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={form.declarationAccepted} onChange={(e) => set("declarationAccepted", e.target.checked)} className="mt-0.5" />
              I declare that the information provided in this application is true and complete to the best of my knowledge. *
            </label>
            <Input
              label="Digital signature — type your full legal name *"
              value={form.declarationSignatureName}
              onChange={(e) => set("declarationSignatureName", e.target.value)}
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-flag bg-red-flag/5 border border-red-flag/20 rounded-lg px-3 py-2 mt-5">
            {error}
          </p>
        )}

        {submitProgress !== null && (
          <div className="mt-5 rounded-lg px-4 py-3" style={{ backgroundColor: "#F8F8F6", border: "1px solid rgba(17,78,59,0.15)" }}>
            <UploadProgress
              progress={submitProgress}
              fileName={citizenshipProof || ieltsCertificate || recommendationLetter ? "your application and documents" : "your application"}
              processingLabel="Creating your account…"
            />
          </div>
        )}

        <div className="flex justify-between mt-8">
          <Button variant="ghost" onClick={back} disabled={step === 0 || isLoading}>Back</Button>
          {step === STEPS.length - 1 ? (
            <Button onClick={handleSubmit} isLoading={isLoading}>Submit Application</Button>
          ) : (
            <Button onClick={next}>Next</Button>
          )}
        </div>
      </StepShell>
    </div>
  );
}
