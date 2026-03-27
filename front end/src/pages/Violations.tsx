import { AppLayout } from "@/components/AppLayout";
import { API_BASE, deleteViolation, fetchViolations } from "@/lib/api";
import { Search, Download, Trash2, Calendar } from "lucide-react";
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type ViolationRow = {
  id: string;
  date: string;
  time: string;
  image: string | null;
  violations: string;
  confidence: string;
};

function normalizeDateInput(value: string) {
  const cleaned = value.replace(/[^\d-]/g, "").slice(0, 10);
  return cleaned;
}

function formatViolations(data: Awaited<ReturnType<typeof fetchViolations>>): ViolationRow[] {
  return data
    .slice()
    .reverse()
    .map((v, index) => ({
      id: v.id ?? `legacy:${v.time}::${v.image ?? ""}::${index}`,
      date: v.time.split(" ")[0] ?? "",
      time: v.time.split(" ")[1] ?? "",
      image: v.image,
      violations: v.missing.map((item) => `No ${item}`).join(", "),
      confidence: typeof v.confidence === "number" ? `${v.confidence.toFixed(2)}%` : "-",
    }));
}

export default function Violations() {
  const [violations, setViolations] = useState<ViolationRow[]>([]);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fromPickerRef = useRef<HTMLInputElement>(null);
  const toPickerRef = useRef<HTMLInputElement>(null);

  const openPicker = (ref: RefObject<HTMLInputElement | null>) => {
    const input = ref.current;
    if (!input) return;

    if ("showPicker" in input) {
      input.showPicker();
      return;
    }

    input.click();
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchViolations();
        if (cancelled) return;
        setViolations(formatViolations(data));
      } catch (err) {
        console.error(err);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = violations.filter((v) => {
    const textMatch = `${v.violations} ${v.confidence}`.toLowerCase().includes(search.toLowerCase());
    const fromMatch = !fromDate || v.date >= fromDate;
    const toMatch = !toDate || v.date <= toDate;
    return textMatch && fromMatch && toMatch;
  });

  const exportToExcel = () => {
    const header = "S.No,Date,Time,Violations,Confidence\n";
    const rows = filtered.map((v, i) =>
      `${i + 1},${v.date},${v.time},${v.violations},${v.confidence}`
    ).join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "violations.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported successfully!");
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const deleteId = id.includes("::") ? id.substring(0, id.lastIndexOf("::")) : id;
      await deleteViolation(deleteId);
      const refreshed = await fetchViolations();
      setViolations(formatViolations(refreshed));
      toast.success("Violation deleted permanently");
    } catch (error) {
      console.error(error);
      toast.error("Could not delete violation");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AppLayout
      title="Violation History"
      subtitle={`${filtered.length} records`}
      headerAction={
        <button onClick={exportToExcel} className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-xl">
          <Download className="h-4 w-4" />
          Export
        </button>
      }
    >
      <div className="grid gap-4 mb-4 md:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search violation..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 p-2 border rounded w-full"
          />
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1">From Date</label>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              inputMode="numeric"
              placeholder="YYYY-MM-DD"
              value={fromDate}
              onChange={(e) => setFromDate(normalizeDateInput(e.target.value))}
              className="p-2 border rounded w-full"
            />
            <button
              type="button"
              onClick={() => openPicker(fromPickerRef)}
              className="p-2 border rounded text-muted-foreground hover:text-foreground"
              aria-label="Open from date calendar"
            >
              <Calendar className="h-4 w-4" />
            </button>
            <input
              ref={fromPickerRef}
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1">To Date</label>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              inputMode="numeric"
              placeholder="YYYY-MM-DD"
              value={toDate}
              onChange={(e) => setToDate(normalizeDateInput(e.target.value))}
              className="p-2 border rounded w-full"
            />
            <button
              type="button"
              onClick={() => openPicker(toPickerRef)}
              className="p-2 border rounded text-muted-foreground hover:text-foreground"
              aria-label="Open to date calendar"
            >
              <Calendar className="h-4 w-4" />
            </button>
            <input
              ref={toPickerRef}
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr>
              <th className="p-3 text-left">S.No</th>
              <th className="text-left">Date</th>
              <th className="text-left">Time</th>
              <th className="text-left">Violations</th>
              <th className="text-left">Confidence</th>
              <th className="text-left min-w-[220px]">Image</th>
              <th className="text-left">Delete</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v, i) => (
              <tr key={v.id} className="border-t">
                <td className="p-3 align-middle text-left">{i + 1}</td>
                <td className="py-3 align-middle text-left">{v.date}</td>
                <td className="py-3 align-middle text-left">{v.time}</td>
                <td className="py-3 align-middle text-left text-red-500">{v.violations || "-"}</td>
                <td className="py-3 align-middle text-left">{v.confidence}</td>
                <td className="py-3 align-middle text-left">
                  {v.image ? (
                    <img
                      src={`${API_BASE}/${v.image}`}
                      className="h-20 w-36 max-w-none rounded-lg border border-slate-200 object-cover"
                    />
                  ) : (
                    "-"
                  )}
                </td>
                <td className="py-3 align-middle text-left">
                  <button
                    onClick={() => handleDelete(v.id)}
                    disabled={deletingId === v.id}
                    className="inline-flex items-center gap-1 text-destructive disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deletingId === v.id ? "Deleting..." : "Delete"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <p className="p-4 text-gray-500">No violations found</p>
        )}
      </div>
    </AppLayout>
  );
}
