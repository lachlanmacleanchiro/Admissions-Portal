"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { APPLICANT_WIDGETS, DEFAULT_LAYOUT, type WidgetLayoutItem, type WidgetWidth } from "@/lib/applicantWidgets";
import { useWidgetEdit } from "./WidgetEditContext";

export interface BoardWidget {
  id: string;
  /** Rendered widget, or null when it doesn't apply to this applicant. */
  node: React.ReactNode | null;
}

const TITLES = Object.fromEntries(APPLICANT_WIDGETS.map((w) => [w.id, w.title]));

/**
 * The applicant Overview grid. Shows widgets in the staff member's saved
 * order and widths; in "Move Widgets" mode they become plain blocks that can
 * be dragged and set to half or full width, saved per staff member.
 */
export function WidgetBoard({ widgets, initialLayout }: { widgets: BoardWidget[]; initialLayout: WidgetLayoutItem[] }) {
  const { isEditing, setIsEditing, saveRef } = useWidgetEdit();
  const [layout, setLayout] = useState(initialLayout);
  const [draft, setDraft] = useState(initialLayout);
  const [error, setError] = useState("");
  const nodes = new Map(widgets.map((w) => [w.id, w.node]));

  // Start each arranging session from the current saved layout.
  useEffect(() => {
    if (isEditing) {
      setDraft(layout);
      setError("");
    }
  }, [isEditing, layout]);

  const save = useCallback(async () => {
    setError("");
    const res = await fetch("/api/admin/me/applicant-layout", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout: draft }),
    }).catch(() => null);
    if (!res || !res.ok) {
      setError("Couldn't save your layout. Please try again.");
      return false;
    }
    const data = await res.json();
    setLayout(data.layout);
    return true;
  }, [draft]);

  useEffect(() => {
    saveRef.current = save;
    return () => {
      saveRef.current = null;
    };
  }, [save, saveRef]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDraft((items) => {
      const from = items.findIndex((i) => i.id === active.id);
      const to = items.findIndex((i) => i.id === over.id);
      return arrayMove(items, from, to);
    });
  }

  function setWidth(id: string, width: WidgetWidth) {
    setDraft((items) => items.map((i) => (i.id === id ? { ...i, width } : i)));
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap rounded-xl px-4 py-3" style={{ backgroundColor: "#fff", border: "1px solid rgba(17,78,59,0.2)" }}>
          <p className="text-sm" style={{ color: "#333" }}>
            <strong>Arranging widgets.</strong> Drag blocks to reorder and choose half or full width, then press <strong>Save</strong>.
            <span className="block text-xs mt-0.5" style={{ color: "#888" }}>Your layout applies to every applicant you open. Other staff keep their own.</span>
          </p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setDraft(DEFAULT_LAYOUT)} className="text-xs font-semibold hover:underline" style={{ color: "#114E3B" }}>
              Reset to default
            </button>
            <button type="button" onClick={() => setIsEditing(false)} className="text-xs font-semibold hover:underline" style={{ color: "#666" }}>
              Cancel
            </button>
          </div>
        </div>
        {error && <p role="alert" className="text-sm" style={{ color: "#c0392b" }}>{error}</p>}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={draft.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {draft.map((item) => (
                <SortableBlock
                  key={item.id}
                  item={item}
                  title={TITLES[item.id] ?? item.id}
                  isAvailable={nodes.get(item.id) != null}
                  onWidth={(w) => setWidth(item.id, w)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {layout.map((item) => {
        const node = nodes.get(item.id);
        if (node == null) return null;
        return (
          <div key={item.id} className={item.width === "full" ? "lg:col-span-2 min-w-0" : "min-w-0"}>
            {node}
          </div>
        );
      })}
    </div>
  );
}

function SortableBlock({
  item,
  title,
  isAvailable,
  onWidth,
}: {
  item: WidgetLayoutItem;
  title: string;
  isAvailable: boolean;
  onWidth: (width: WidgetWidth) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      className={item.width === "full" ? "lg:col-span-2" : ""}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined, position: "relative" }}
    >
      <div
        className="flex items-center gap-3 rounded-xl px-4 h-20"
        style={{
          backgroundColor: isDragging ? "#F0F6F4" : "#fff",
          border: `1.5px dashed ${isDragging ? "#114E3B" : "rgba(0,0,0,0.18)"}`,
          boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.12)" : "none",
        }}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Move ${title}`}
          className="flex-shrink-0 p-1.5 rounded-md cursor-grab active:cursor-grabbing hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2"
          style={{ color: "#888", outlineColor: "#114E3B" }}
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <circle cx="7" cy="5" r="1.5" /><circle cx="13" cy="5" r="1.5" />
            <circle cx="7" cy="10" r="1.5" /><circle cx="13" cy="10" r="1.5" />
            <circle cx="7" cy="15" r="1.5" /><circle cx="13" cy="15" r="1.5" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: isAvailable ? "#222" : "#999" }}>{title}</p>
          {!isAvailable && <p className="text-[11px]" style={{ color: "#aaa" }}>Not shown for this applicant</p>}
        </div>
        <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: "1px solid rgba(0,0,0,0.12)" }} role="group" aria-label={`${title} width`}>
          {(["half", "full"] as WidgetWidth[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onWidth(w)}
              aria-pressed={item.width === w}
              className="px-2.5 py-1 text-xs font-semibold transition-colors"
              style={item.width === w ? { backgroundColor: "#114E3B", color: "#fff" } : { backgroundColor: "#fff", color: "#666" }}
            >
              {w === "half" ? "Half" : "Full"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
