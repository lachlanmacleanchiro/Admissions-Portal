"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

type ChiroStatus = "OBSERVING" | "UNDER_CARE";

interface ChiroExperienceRow {
  chiropractorName: string;
  status: ChiroStatus;
  date: string;
}

interface EditApplicantFormProps {
  applicationId: string;
  initial: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    citizenshipCountry: string;
    city: string;
    address: string;
    suburb: string;
    postcode: string;
    country: string;
    guardianName: string;
    guardianRelation: string;
    guardianEmail: string;
    guardianPhone: string;
    gpaScore: string;
    prerequisitesMet: boolean;
    chiropracticExperience: ChiroExperienceRow[];
  };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#999" }}>{children}</p>;
}

export function EditApplicantForm({ applicationId, initial }: EditApplicantFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  function updateExperience(index: number, field: keyof ChiroExperienceRow, value: string) {
    set("chiropracticExperience", form.chiropracticExperience.map((e, i) => (i === index ? { ...e, [field]: value } : e)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.chiropracticExperience.some((x) => !x.chiropractorName.trim())) {
      setError("Please complete or remove all chiropractic experience entries.");
      return;
    }
    setIsLoading(true);
    setError("");
    const res = await fetch(`/api/admin/applicants/${applicationId}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, gpaScore: form.gpaScore === "" ? null : form.gpaScore }),
    });
    setIsLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save. Please try again.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold transition-colors"
        style={{ color: "#114E3B" }}
      >
        Edit →
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          <h2 className="font-serif text-lg text-text">Edit Applicant Details</h2>
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
            style={{ color: "#aaa" }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-5">
          <div>
            <SectionLabel>Personal</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <Input label="First name" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
              <Input label="Last name" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
            </div>
            <div className="mt-3">
              <label className="block text-sm font-semibold text-text mb-1.5">Email</label>
              <div className="px-4 py-2.5 rounded-lg text-sm" style={{ backgroundColor: "#F2F2F0", color: "#aaa", border: "1.5px solid rgba(0,0,0,0.06)" }}>
                {initial.email}
                <span className="ml-2 text-xs" style={{ color: "#ccc" }}>(not editable)</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Input label="Mobile" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              <Input label="Date of birth" type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
            </div>
            <div className="mt-3">
              <Input label="Country of citizenship" value={form.citizenshipCountry} onChange={(e) => set("citizenshipCountry", e.target.value)} />
            </div>
          </div>

          <div>
            <SectionLabel>Academic</SectionLabel>
            <Input label="Overall Grade Average" type="number" step="0.01" value={form.gpaScore} onChange={(e) => set("gpaScore", e.target.value)} />
            <label className="flex items-center gap-2 text-sm mt-3" style={{ color: "#333" }}>
              <input type="checkbox" checked={form.prerequisitesMet} onChange={(e) => set("prerequisitesMet", e.target.checked)} />
              Prerequisites met
            </label>
          </div>

          <div>
            <SectionLabel>Address</SectionLabel>
            <div className="flex flex-col gap-3">
              <Input label="Street address" value={form.address} onChange={(e) => set("address", e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Suburb" value={form.suburb} onChange={(e) => set("suburb", e.target.value)} />
                <Input label="City" value={form.city} onChange={(e) => set("city", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Postcode" value={form.postcode} onChange={(e) => set("postcode", e.target.value)} />
                <Input label="Country" value={form.country} onChange={(e) => set("country", e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#999" }}>Chiropractic Experience</p>
              <button
                type="button"
                onClick={() => set("chiropracticExperience", [...form.chiropracticExperience, { chiropractorName: "", status: "OBSERVING", date: "" }])}
                className="text-xs font-semibold"
                style={{ color: "#114E3B" }}
              >
                + Add entry
              </button>
            </div>
            {form.chiropracticExperience.length === 0 ? (
              <p className="text-xs" style={{ color: "#888" }}>No chiropractic experience entered.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {form.chiropracticExperience.map((entry, i) => (
                  <div key={i} className="flex flex-col gap-2 p-3 rounded-lg" style={{ backgroundColor: "#F8F8F6" }}>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Input label="Chiropractor name" value={entry.chiropractorName} onChange={(e) => updateExperience(i, "chiropractorName", e.target.value)} />
                      </div>
                      <button
                        type="button"
                        onClick={() => set("chiropracticExperience", form.chiropracticExperience.filter((_, idx) => idx !== i))}
                        className="text-xs pb-3"
                        style={{ color: "#c0392b" }}
                        aria-label="Remove entry"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Select label="Status" value={entry.status} onChange={(e) => updateExperience(i, "status", e.target.value)}>
                        <option value="OBSERVING">Observing</option>
                        <option value="UNDER_CARE">Under care</option>
                      </Select>
                      <Input label="Date" type="date" value={entry.date} onChange={(e) => updateExperience(i, "date", e.target.value)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <SectionLabel>Next of Kin</SectionLabel>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Name" value={form.guardianName} onChange={(e) => set("guardianName", e.target.value)} />
                <Input label="Relationship" value={form.guardianRelation} onChange={(e) => set("guardianRelation", e.target.value)} />
              </div>
              <Input label="Email" type="email" value={form.guardianEmail} onChange={(e) => set("guardianEmail", e.target.value)} />
              <Input label="Phone" value={form.guardianPhone} onChange={(e) => set("guardianPhone", e.target.value)} />
            </div>
          </div>

          {error && (
            <p className="text-sm px-3 py-2 rounded-lg" style={{ color: "#c0392b", backgroundColor: "rgba(192,57,43,0.06)" }}>
              {error}
            </p>
          )}

          <div className="flex gap-3 justify-end pt-1" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={isLoading}>Save Changes</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
