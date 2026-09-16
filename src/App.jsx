import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  RefreshCw,
  LayoutGrid,
  Plus,
  Search,
  UserX,
  UserCheck,
  Download,
  Printer,
  X,
  ArrowRight,
  Armchair,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Menu
} from "lucide-react";
import {
  subscribeToMembers,
  subscribeToEvents,
  subscribeToAssignments,
  addMemberToDb,
  updateMemberInDb,
  saveEventAndAssignments,
  deleteEventFromDb,
  deleteMemberFromDb
} from "./lib/data-service";

import { buildSeatStructure, computePreview } from "./lib/rotation-engine";
import seatIcon from "./assets/icon.png";


/*  Small presentational helpers                                       */


const CAT_STYLES = {
  Deluxe: {
    chip: "bg-indigo-100 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-500",
    seatFilled: "bg-indigo-50 border-indigo-300 text-indigo-800",
    solid: "bg-indigo-600 hover:bg-indigo-700",
    text: "text-indigo-700",
  },
  Premium: {
    chip: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    seatFilled: "bg-emerald-50 border-emerald-300 text-emerald-800",
    solid: "bg-emerald-600 hover:bg-emerald-700",
    text: "text-emerald-700",
  },
};

function CategoryChip({ category }) {
  const s = CAT_STYLES[category];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {category}
    </span>
  );
}

function StatCard({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start justify-between shadow-sm">
      <div>
        <p className="text-sm text-slate-500 font-medium">{label}</p>
        <p className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
        <Icon size={18} />
      </div>
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  const isError = toast.type === "error";
  return (
    <div className="fixed bottom-6 right-6 z-50 no-print">
      <div
        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${isError ? "bg-red-50 border-red-200 text-red-700" : "bg-slate-900 border-slate-800 text-white"
          }`}
      >
        {isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} className="text-emerald-400" />}
        {toast.message}
      </div>
    </div>
  );
}

/*  Main App                                                            */

export default function App() {
  const structures = useMemo(
    () => ({ Deluxe: buildSeatStructure("Deluxe"), Premium: buildSeatStructure("Premium") }),
    []
  );

  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    let unsubs = [];
    unsubs.push(subscribeToMembers((m) => { setMembers(m); setLoading(false); }));
    unsubs.push(subscribeToEvents(setEvents));
    unsubs.push(subscribeToAssignments(setAssignments));

    return () => unsubs.forEach(u => u());
  }, []);

  const [page, setPage] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [previewModal, setPreviewModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteMemberTarget, setDeleteMemberTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [selectedEventId, setSelectedEventId] = useState("evt-1");

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* ---------------- member actions ---------------- */

  const addMember = async ({ name, phone, category }) => {
    const activeCount = members.filter((m) => m.category === category && m.status === "active").length;
    if (activeCount >= structures[category].total) {
      showToast(`No seats left in ${category} (capacity ${structures[category].total})`, "error");
      return;
    }
    const newMember = {
      id: `${category === "Deluxe" ? "D" : "P"}-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      category,
      initialSeatIndex: activeCount,
      currentSeatIndex: activeCount,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    await addMemberToDb(newMember);
    setShowAddModal(false);
    showToast(`${newMember.name} added to ${category}`);
  };

  const deactivateMember = async (id) => {
    const target = members.find((m) => m.id === id);
    const updated = members.map((m) => (m.id === id ? { ...m, status: "inactive" } : m));
    const activeSameCat = updated
      .filter((m) => m.category === target.category && m.status === "active")
      .sort((a, b) => a.currentSeatIndex - b.currentSeatIndex);

    const updates = [];
    updates.push(updateMemberInDb(id, { status: "inactive" }));

    activeSameCat.forEach((m, idx) => {
      if (m.currentSeatIndex !== idx) {
        updates.push(updateMemberInDb(m.id, { currentSeatIndex: idx }));
      }
    });

    await Promise.all(updates);
    setDeactivateTarget(null);
    showToast("Member deactivated");
  };

  const reactivateMember = async (id) => {
    const target = members.find((m) => m.id === id);
    const activeCount = members.filter((m) => m.category === target.category && m.status === "active").length;
    if (activeCount >= structures[target.category].total) {
      showToast(`No seats left in ${target.category}`, "error");
      return;
    }
    await updateMemberInDb(id, { status: "active", currentSeatIndex: activeCount });
    showToast("Member reactivated");
  };

  const deleteMember = async (id) => {
    await deleteMemberFromDb(id);
    setDeleteMemberTarget(null);
    showToast("Member deleted");
  };

  /* ---------------- rotation actions ---------------- */

  const openGeneratePreview = () => {
    const isFirst = events.length === 0;
    const preview = computePreview(members, isFirst, structures);
    const eventNumber = events.length === 0 ? 1 : Math.max(...events.map((e) => e.eventNumber)) + 1;
    setPreviewModal({
      preview,
      isFirst,
      eventNumber,
      eventName: `Calculator Activity #${eventNumber}`,
      eventDate: new Date().toISOString().slice(0, 10),
    });
  };

  const confirmGenerate = async ({ eventName, eventDate, selectedIds }) => {
    if (!previewModal) return;
    const { preview, eventNumber } = previewModal;
    const newEventId = `evt-${Date.now()}`;
    const newEvent = {
      id: newEventId,
      eventNumber,
      eventName: eventName.trim() || `Calculator Activity #${eventNumber}`,
      eventDate,
      createdAt: new Date().toISOString(),
    };
    const flat = [...preview.Deluxe, ...preview.Premium]
      .filter((p) => selectedIds.has(p.userId))
      .map((p) => ({
        eventId: newEventId,
        userId: p.userId,
        userName: p.userName,
        category: p.category,
        assignedSeat: p.assignedSeat,
      }));

    const updatedMembers = members.map(m => {
      if (!selectedIds.has(m.id)) return null;
      const p = preview[m.category].find(x => x.userId === m.id);
      if (p && p.newIndex !== m.currentSeatIndex) {
        return { ...m, currentSeatIndex: p.newIndex };
      }
      return null;
    }).filter(Boolean);

    setPreviewModal(null);
    await saveEventAndAssignments(newEvent, flat, updatedMembers);
    setSelectedEventId(newEventId);
    showToast(`${newEvent.eventName} seats saved`);
  };

  const deleteActivity = async (eventId) => {
    const target = events.find((e) => e.id === eventId);
    if (!target) return;

    const isLatest = target.eventNumber === Math.max(...events.map((e) => e.eventNumber));
    const memberUpdates = [];

    if (isLatest && events.length > 1) {
      const previous = events
        .filter((e) => e.id !== eventId)
        .sort((a, b) => b.eventNumber - a.eventNumber)[0];
      const prevAssignments = assignments[previous.id] || [];
      const updatedIds = new Set();

      members
        .filter((m) => m.status === "active")
        .forEach((m) => {
          const assignment = prevAssignments.find((a) => a.userId === m.id);
          if (assignment) {
            const idx = structures[m.category].flat.indexOf(assignment.assignedSeat);
            if (idx >= 0 && idx !== m.currentSeatIndex) {
              memberUpdates.push({ id: m.id, currentSeatIndex: idx });
              updatedIds.add(m.id);
            }
          }
        });

      ["Deluxe", "Premium"].forEach((cat) => {
        const active = members.filter((m) => m.category === cat && m.status === "active" && !updatedIds.has(m.id));
        const n = active.length;
        active.forEach((m) => {
          const reverted = n > 0 ? (m.currentSeatIndex - 1 + n) % n : 0;
          if (reverted !== m.currentSeatIndex) {
            memberUpdates.push({ id: m.id, currentSeatIndex: reverted });
          }
        });
      });
    }

    await deleteEventFromDb(eventId, memberUpdates);

    if (selectedEventId === eventId) {
      const remaining = events.filter((e) => e.id !== eventId);
      const next = [...remaining].sort((a, b) => b.eventNumber - a.eventNumber)[0];
      setSelectedEventId(next?.id || "");
    }

    setDeleteTarget(null);
    showToast(`${target.eventName} deleted`);
  };

  /* ---------------- export ---------------- */

  const exportCSV = (eventId) => {
    const ev = events.find((e) => e.id === eventId);
    const rows = (assignments[eventId] || []).slice().sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.assignedSeat.localeCompare(b.assignedSeat);
    });
    const header = ["Name", "Phone", "Category", "Seat"];
    const body = rows.map((r) => {
      const member = members.find((m) => m.id === r.userId);
      return [r.userName, member ? member.phone : "", r.category, r.assignedSeat];
    });
    const csv = [header, ...body]
      .map((r) => r.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(ev?.eventName || "event").replace(/\s+/g, "_")}_seats.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported");
  };

  /* --------------- derived data --------------- */

  const filteredMembers = useMemo(() => {
    return members
      .filter((m) => (categoryFilter === "All" ? true : m.category === categoryFilter))
      .filter((m) => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return m.name.toLowerCase().includes(q) || m.phone.includes(q);
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "active" ? -1 : 1;
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.currentSeatIndex - b.currentSeatIndex;
      });
  }, [members, categoryFilter, searchQuery]);

  const activeDeluxe = members.filter((m) => m.category === "Deluxe" && m.status === "active").length;
  const activePremium = members.filter((m) => m.category === "Premium" && m.status === "active").length;
  const lastEvent = events[events.length - 1];

  const seatLabelForMember = (member, eventId) => {
    const list = assignments[eventId] || [];
    const found = list.find((a) => a.userId === member.id);
    return found ? found.assignedSeat : "—";
  };

  const NAV = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "members", label: "Members", icon: Users },
    { key: "activities", label: "Calculator Activities", icon: RefreshCw },
    { key: "seatmap", label: "Seat Map", icon: LayoutGrid },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-400">
        <Loader2 size={32} className="animate-spin mb-4 text-slate-900" />
        <p className="text-sm font-medium">Connecting to Database...</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900 flex"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');
        .font-display { font-family: 'Plus Jakarta Sans', 'Inter', ui-sans-serif, sans-serif; }
        .seat-scroll { scrollbar-width: thin; scrollbar-color: #CBD5E1 #F1F5F9; }
        .seat-scroll::-webkit-scrollbar { height: 8px; }
        .seat-scroll::-webkit-scrollbar-track { background: #F1F5F9; border-radius: 9999px; }
        .seat-scroll::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 9999px; }
        .seat-scroll::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
        @media print {
          .no-print { display: none !important; }
          .print-area { padding: 0 !important; }
          body { background: white !important; }
        }
      `}</style>

      {/* ---------------- Mobile Menu Overlay ---------------- */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/*  Sidebar  */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col no-print transition-transform duration-300 lg:static lg:translate-x-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-16 flex items-center gap-2.5 px-6 border-b border-slate-200 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
            <Armchair size={16} className="text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-display font-extrabold text-[12px] text-slate-900 leading-tight uppercase tracking-tight truncate">
              Sanjeevkumar
            </span>
            <span className="font-display font-bold text-[8px] text-indigo-600 tracking-[0.25em] uppercase mt-0.5">
              Auditorium
            </span>
          </div>
          <button
            className="lg:hidden ml-auto text-slate-400 hover:text-slate-600"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = page === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setPage(item.key);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-200 shrink-0">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-500 mb-2">Category capacity</p>
            <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />Deluxe</span>
              <span className="font-medium">{activeDeluxe}/{structures.Deluxe.total}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Premium</span>
              <span className="font-medium">{activePremium}/{structures.Premium.total}</span>
            </div>
          </div>
        </div>
      </aside>

      {/*  Main  */}
      <main className="flex-1 min-w-0 print-area flex flex-col">
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 lg:px-8 no-print sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <h1 className="font-display font-semibold text-lg tracking-tight">
              {NAV.find((n) => n.key === page)?.label}
            </h1>
          </div>
          {lastEvent && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <CalendarDays size={14} className="shrink-0" />
              <span className="hidden sm:inline">Last activity: {lastEvent.eventName} · {lastEvent.eventDate}</span>
              <span className="sm:hidden truncate max-w-[100px]">{lastEvent.eventName}</span>
            </div>
          )}
        </header>

        <div className="px-4 lg:px-8 py-6 max-w-6xl w-full mx-auto">
          {page === "dashboard" && (
            <Dashboard
              activeDeluxe={activeDeluxe}
              activePremium={activePremium}
              structures={structures}
              eventsCount={events.length}
              lastEvent={lastEvent}
              onGoto={setPage}
            />
          )}

          {page === "members" && (
            <MembersPage
              members={filteredMembers}
              structures={structures}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              onAdd={() => setShowAddModal(true)}
              onDeactivate={(m) => setDeactivateTarget(m)}
              onReactivate={reactivateMember}
              onDelete={(m) => setDeleteMemberTarget(m)}
              currentEventId={selectedEventId}
              seatLabelForMember={seatLabelForMember}
            />
          )}

          {page === "activities" && (
            <ActivitiesPage
              events={events}
              assignments={assignments}
              onGenerate={openGeneratePreview}
              onView={(id) => {
                setSelectedEventId(id);
                setPage("seatmap");
              }}
              onExport={exportCSV}
              onDelete={(ev) => setDeleteTarget(ev)}
            />
          )}

          {page === "seatmap" && (
            <SeatMapPage
              events={events}
              assignments={assignments}
              structures={structures}
              selectedEventId={selectedEventId}
              setSelectedEventId={setSelectedEventId}
              onExport={exportCSV}
            />
          )}
        </div>
      </main>

      {/*  Modals  */}
      {showAddModal && (
        <AddMemberModal onClose={() => setShowAddModal(false)} onSubmit={addMember} structures={structures} members={members} />
      )}

      {deactivateTarget && (
        <ConfirmModal
          title="Deactivate member"
          message={`${deactivateTarget.name} will be marked inactive and removed from future seat rotations. Past activity records are kept.`}
          confirmLabel="Deactivate"
          tone="danger"
          onCancel={() => setDeactivateTarget(null)}
          onConfirm={() => deactivateMember(deactivateTarget.id)}
        />
      )}

      {previewModal && (
        <GeneratePreviewModal
          data={previewModal}
          onCancel={() => setPreviewModal(null)}
          onConfirm={confirmGenerate}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete activity"
          message={`Remove "${deleteTarget.eventName}" (${deleteTarget.eventDate})? This permanently deletes its seat assignments.${deleteTarget.eventNumber === Math.max(...events.map((e) => e.eventNumber)) && events.length > 1
            ? " Member seats will be restored to the previous activity."
            : ""
            }`}
          confirmLabel="Delete"
          tone="danger"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteActivity(deleteTarget.id)}
        />
      )}

      {deleteMemberTarget && (
        <ConfirmModal
          title="Delete member"
          message={`Remove ${deleteMemberTarget.name}? This permanently deletes their record.`}
          confirmLabel="Delete"
          tone="danger"
          onCancel={() => setDeleteMemberTarget(null)}
          onConfirm={() => deleteMember(deleteMemberTarget.id)}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}


/*  Dashboard page */


function Dashboard({ activeDeluxe, activePremium, structures, eventsCount, lastEvent, onGoto }) {
  return (
    <div className="space-y-7">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Deluxe" value={activeDeluxe} sub={`of ${structures.Deluxe.total} seats · rows B–F`} icon={Users} accent="bg-indigo-100 text-indigo-700" />
        <StatCard label="Active Premium" value={activePremium} sub={`of ${structures.Premium.total} seats · rows G–L`} icon={Users} accent="bg-emerald-100 text-emerald-700" />
        <StatCard label="Activities held" value={eventsCount} sub="Calculator Activity" icon={RefreshCw} accent="bg-amber-100 text-amber-700" />
        <StatCard label="Latest activity" value={lastEvent ? `#${lastEvent.eventNumber}` : "—"} sub={lastEvent?.eventDate || "Not started"} icon={CalendarDays} accent="bg-slate-200 text-slate-700" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickAction
          icon={Users}
          title="Manage members"
          desc="Add, search, or deactivate Deluxe and Premium members."
          cta="Open Members"
          onClick={() => onGoto("members")}
        />
        <QuickAction
          icon={RefreshCw}
          title="Run the next activity"
          desc="Rotate seats forward for every active member, per category."
          cta="Open Activities"
          onClick={() => onGoto("activities")}
        />
        <QuickAction
          icon={LayoutGrid}
          title="View the hall"
          desc="See the current or past seating charts, section by section."
          cta="Open Seat Map"
          onClick={() => onGoto("seatmap")}
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <h3 className="font-display font-semibold text-sm mb-3">How the rotation works</h3>
        <p className="text-sm text-slate-500 leading-relaxed max-w-2xl">
          For the first Calculator Activity, every member sits in their default seat. From the second
          activity onward, each active member moves forward exactly one position within their own
          category — Deluxe members rotate only among Deluxe seats, Premium members only among Premium
          seats. Deactivating a member closes their gap so the rotation always cycles cleanly through
          every remaining active seat.
        </p>
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, title, desc, cta, onClick }) {
  return (
    <button onClick={onClick} className="text-left bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 hover:shadow-sm transition-all group">
      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center mb-3 group-hover:bg-slate-900 group-hover:text-white transition-colors">
        <Icon size={16} />
      </div>
      <p className="font-semibold text-sm text-slate-900">{title}</p>
      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{desc}</p>
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-900 mt-3">
        {cta} <ArrowRight size={13} />
      </span>
    </button>
  );
}


/*  Members page */


function MembersPage({
  members, structures, searchQuery, setSearchQuery, categoryFilter, setCategoryFilter,
  onAdd, onDeactivate, onReactivate, onDelete, currentEventId, seatLabelForMember,
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
          {["All", "Deluxe", "Premium"].map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-colors ${categoryFilter === c ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name or mobile"
              className="pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </div>
          <button
            onClick={onAdd}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 w-full sm:w-auto shrink-0"
          >
            <Plus size={15} /> Add Member
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="text-left font-medium px-5 py-3 whitespace-nowrap">Name</th>
                <th className="text-left font-medium px-5 py-3 whitespace-nowrap">Mobile</th>
                <th className="text-left font-medium px-5 py-3 whitespace-nowrap">Category</th>
                <th className="text-left font-medium px-5 py-3 whitespace-nowrap">Current Seat</th>
                <th className="text-left font-medium px-5 py-3 whitespace-nowrap">Status</th>
                <th className="text-right font-medium px-5 py-3 whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-3 font-medium text-slate-800 whitespace-nowrap min-w-[150px]">{m.name}</td>
                  <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{m.phone}</td>
                  <td className="px-5 py-3 whitespace-nowrap"><CategoryChip category={m.category} /></td>
                  <td className="px-5 py-3 text-slate-600 font-mono text-xs whitespace-nowrap">
                    {m.status === "active" ? seatLabelForMember(m, currentEventId) : "—"}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${m.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {m.status === "active" ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {m.status === "active" ? (
                      <button onClick={() => onDeactivate(m)} className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700">
                        <UserX size={14} /> Deactivate
                      </button>
                    ) : (
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => onReactivate(m.id)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900">
                          <UserCheck size={14} /> Reactivate
                        </button>
                        <button onClick={() => onDelete(m)} className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700">
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-sm">No members match your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Activities page                                                     */
/* ------------------------------------------------------------------ */

function ActivitiesPage({ events, assignments, onGenerate, onView, onExport, onDelete }) {
  const sorted = [...events].sort((a, b) => b.eventNumber - a.eventNumber);
  const nextEventNumber = events.length === 0 ? 1 : Math.max(...events.map((e) => e.eventNumber)) + 1;
  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between text-white gap-5">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Next step</p>
          <h3 className="font-display font-semibold text-lg">
            {events.length === 0 ? "Generate seats for Activity #1" : `Generate seats for Activity #${nextEventNumber}`}
          </h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md">
            {events.length === 0
              ? "Assign every active member their default seat to kick off the rotation."
              : "Shift every active member forward one seat within their category. You'll preview the changes before saving."}
          </p>
        </div>
        <button
          onClick={onGenerate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:bg-slate-100 shrink-0 w-full sm:w-auto"
        >
          Generate Next Activity Seats
        </button>
      </div>

      <div className="space-y-3">
        {sorted.map((ev) => {
          const list = assignments[ev.id] || [];
          const deluxeCount = list.filter((a) => a.category === "Deluxe").length;
          const premiumCount = list.filter((a) => a.category === "Premium").length;
          return (
            <div key={ev.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm text-slate-900">{ev.eventName}</p>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5 text-xs text-slate-500">
                  <span className="flex items-center gap-1 whitespace-nowrap"><CalendarDays size={13} /> {ev.eventDate}</span>
                  <span className="whitespace-nowrap">{deluxeCount} Deluxe</span>
                  <span className="hidden sm:inline">·</span>
                  <span className="whitespace-nowrap">{premiumCount} Premium</span>
                </div>
              </div>
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <button onClick={() => onExport(ev.id)} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:border-slate-300 whitespace-nowrap">
                  <Download size={13} /> Export CSV
                </button>
                <button onClick={() => onView(ev.id)} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 whitespace-nowrap">
                  <LayoutGrid size={13} /> View Seat Map
                </button>
                <button onClick={() => onDelete(ev)} className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 whitespace-nowrap">
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Seat map page                                                       */
/* ------------------------------------------------------------------ */

function SeatMapPage({ events, assignments, structures, selectedEventId, setSelectedEventId, onExport }) {
  const sorted = [...events].sort((a, b) => b.eventNumber - a.eventNumber);
  const currentEvent = events.find((e) => e.id === selectedEventId) || sorted[0];
  const list = currentEvent ? assignments[currentEvent.id] || [] : [];

  const seatOccupant = (category, label) => {
    const found = list.find((a) => a.category === category && a.assignedSeat === label);
    return found ? found.userName : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        {currentEvent ? (
          <div className="relative w-full sm:w-auto">
            <select
              value={currentEvent.id}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="appearance-none w-full sm:w-auto pl-4 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            >
              {sorted.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.eventName} · {ev.eventDate}</option>
              ))}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        ) : (
          <div className="text-sm font-medium text-slate-500 px-2">Empty Hall (No activities generated)</div>
        )}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {currentEvent && (
            <button onClick={() => onExport(currentEvent.id)} className="flex-1 sm:flex-none flex justify-center items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-slate-300 whitespace-nowrap">
              <Download size={14} /> Export CSV
            </button>
          )}
          <button onClick={() => window.print()} className="flex-1 sm:flex-none flex justify-center items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-slate-300 whitespace-nowrap">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {currentEvent && (
        <p className="hidden print:block font-display font-semibold text-base mb-2">{currentEvent.eventName} — {currentEvent.eventDate}</p>
      )}

      <HallDiagram structures={structures} seatOccupant={seatOccupant} />
    </div>
  );
}


const SEAT_SLOT = 40; // px reserved per seat (badge + gap)
const ROW_LABEL_W = 26;
const COUNT_LABEL_W = 30;
const WALKWAY_AFTER_ROW = "H"; // hall aisle sits behind Premium row H

function HallDiagram({ structures, seatOccupant }) {
  const [hoveredSeat, setHoveredSeat] = useState(null);

  const orderedRows = [
    ...structures.Deluxe.rows.map((r) => ({ ...r, category: "Deluxe" })),
    ...structures.Premium.rows.map((r) => ({ ...r, category: "Premium" })),
  ];
  const maxSeats = Math.max(...orderedRows.map((r) => r.labels.length));
  const seatsWidth = maxSeats * SEAT_SLOT;
  const innerWidth = ROW_LABEL_W + 12 + seatsWidth + 12 + COUNT_LABEL_W;

  const filledDeluxe = structures.Deluxe.flat.filter((l) => seatOccupant("Deluxe", l)).length;
  const filledPremium = structures.Premium.flat.filter((l) => seatOccupant("Premium", l)).length;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 relative">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 mb-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <CategoryChip category="Deluxe" /><span>{filledDeluxe}/{structures.Deluxe.total} filled · rows B–F</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <CategoryChip category="Premium" /><span>{filledPremium}/{structures.Premium.total} filled · rows G–L</span>
        </div>
      </div>

      <div className="h-1.5 rounded-full mt-4 mb-1 bg-gradient-to-r from-slate-200 via-slate-500 to-slate-200" />
      <p className="text-center text-[10px] tracking-[0.3em] text-slate-500 font-semibold mb-6">STAGE</p>

      <div className="seat-scroll overflow-x-auto pb-3">
        <div style={{ width: innerWidth }} className="space-y-2">
          {orderedRows.map(({ row, labels, category }) => {
            const s = CAT_STYLES[category];
            return (
              <React.Fragment key={row}>
                <div className="flex items-center" style={{ gap: 12 }}>
                  <span
                    className="text-xs font-semibold text-slate-400 text-right bg-white sticky left-0 z-10"
                    style={{ width: ROW_LABEL_W }}
                  >
                    {row}
                  </span>
                  <div style={{ width: seatsWidth, display: "flex", justifyContent: "center", gap: 4 }}>
                    {labels.map((label) => {
                      const occupant = seatOccupant(category, label);
                      return (
                        <div
                          key={label}
                          style={{
                            width: 36,
                            height: 24,
                            cursor: `url(${seatIcon}) 16 16, pointer`
                          }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredSeat({
                              label,
                              occupant,
                              category,
                              x: rect.left + window.scrollX + rect.width / 2,
                              y: rect.top + window.scrollY - 8,
                            });
                          }}
                          onMouseLeave={() => setHoveredSeat(null)}
                          className={`rounded-md border flex items-center justify-center font-mono font-semibold text-[9px] shrink-0 transition-all duration-150 hover:scale-110 ${occupant ? s.seatFilled : "border-dashed border-slate-300 text-slate-400 bg-slate-50"
                            }`}
                        >
                          {label.replace(/[A-Z]/g, "")}
                        </div>
                      );
                    })}
                  </div>
                  <span className="text-xs font-semibold text-slate-400 shrink-0" style={{ width: COUNT_LABEL_W }}>
                    {labels.length}
                  </span>
                </div>
                {row === WALKWAY_AFTER_ROW && (
                  <div style={{ width: innerWidth }} className="flex items-center gap-3 py-1.5">
                    <div className="flex-1 border-t border-dashed border-slate-300" />
                    <span className="text-[9px] tracking-[0.25em] text-slate-400 font-semibold shrink-0">WALKWAY</span>
                    <div className="flex-1 border-t border-dashed border-slate-300" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <p className="text-center text-[10px] tracking-[0.3em] text-slate-500 font-semibold mt-6">BACK OF HALL</p>

      {hoveredSeat && (
        <div
          style={{
            position: "fixed",
            left: hoveredSeat.x,
            top: hoveredSeat.y,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none",
            zIndex: 100,
          }}
          className="bg-slate-900/95 backdrop-blur text-white rounded-xl shadow-xl px-3.5 py-2.5 text-xs border border-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-150 min-w-[150px] flex flex-col gap-1.5"
        >
          <div className="flex justify-between items-center gap-4">
            <span className="font-semibold text-slate-100 font-display text-[13px]">
              {hoveredSeat.occupant || "Empty Seat"}
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-1.5 py-0.5 rounded font-bold border border-slate-700">
              {hoveredSeat.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${hoveredSeat.category === "Deluxe" ? "bg-indigo-500" : "bg-emerald-500"
              }`} />
            <span className="text-[10px] text-slate-400 font-medium">
              {hoveredSeat.category} Seat
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modals                                                              */
/* ------------------------------------------------------------------ */

function ModalShell({ children, onClose, wide }) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-40 p-4 no-print">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? "max-w-2xl" : "max-w-sm"} max-h-[85vh] overflow-hidden flex flex-col`}>
        {children}
      </div>
    </div>
  );
}

function AddMemberModal({ onClose, onSubmit, structures, members }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("Deluxe");
  const [error, setError] = useState("");

  const activeCount = members.filter((m) => m.category === category && m.status === "active").length;
  const full = activeCount >= structures[category].total;

  const submit = () => {
    if (!name.trim()) return setError("Enter a name.");
    if (!phone.trim() || phone.trim().length < 7) return setError("Enter a valid mobile number.");
    if (full) return setError(`${category} is at full capacity.`);
    onSubmit({ name, phone, category });
  };

  return (
    <ModalShell onClose={onClose}>
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-display font-semibold text-base">Add member</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Mobile</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">Category</label>
          <div className="flex gap-2">
            {["Deluxe", "Premium"].map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium ${category === c ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"
                  }`}
              >
                {c}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">{activeCount}/{structures[category].total} seats currently used. New member is placed in the next open seat.</p>
        </div>
        {error && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle size={13} />{error}</p>}
      </div>
      <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={submit} className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800">Add member</button>
      </div>
    </ModalShell>
  );
}

function ConfirmModal({ title, message, confirmLabel, tone = "default", onCancel, onConfirm }) {
  return (
    <ModalShell onClose={onCancel}>
      <div className="px-6 py-5">
        <h3 className="font-display font-semibold text-base mb-2">{title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed">{message}</p>
      </div>
      <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-800"}`}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}

function GeneratePreviewModal({ data, onCancel, onConfirm }) {
  const { preview, isFirst, eventNumber, eventName: defaultName, eventDate: defaultDate } = data;
  const [eventName, setEventName] = useState(defaultName);
  const [eventDate, setEventDate] = useState(defaultDate);
  const [error, setError] = useState("");
  const rows = [...preview.Deluxe, ...preview.Premium];

  const [selectedIds, setSelectedIds] = useState(() => new Set(rows.map((r) => r.userId)));

  const handleToggleAll = () => {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.userId)));
    }
  };

  const handleToggleRow = (userId) => {
    const next = new Set(selectedIds);
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    setSelectedIds(next);
  };

  const handleConfirm = () => {
    if (!eventName.trim()) return setError("Enter an activity name.");
    if (!eventDate) return setError("Select an activity date.");
    if (selectedIds.size === 0) return setError("Select at least one member.");
    onConfirm({ eventName, eventDate, selectedIds });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    }
  };

  const allSelected = selectedIds.size === rows.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < rows.length;

  return (
    <ModalShell onClose={onCancel} wide>
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold text-base">New Calculator Activity #{eventNumber}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{selectedIds.size} of {rows.length} members selected · set details and review seats before saving.</p>
        </div>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
      </div>
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60" onKeyDown={handleKeyDown}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Activity name</label>
            <input
              value={eventName}
              onChange={(e) => { setEventName(e.target.value); setError(""); }}
              placeholder="e.g. Monthly Calculator Session"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Activity date</label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => { setEventDate(e.target.value); setError(""); }}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-600 flex items-center gap-1 mt-2"><AlertCircle size={13} />{error}</p>}
      </div>
      <div className="overflow-auto px-6 py-4 max-h-[60vh]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
              <th className="py-2 w-10 px-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={handleToggleAll}
                  className="rounded border-slate-300 accent-slate-900 h-4 w-4 cursor-pointer"
                />
              </th>
              <th className="py-2 font-medium whitespace-nowrap min-w-[120px]">Name</th>
              <th className="py-2 font-medium whitespace-nowrap">Category</th>
              {!isFirst && <th className="py-2 font-medium whitespace-nowrap">Previous seat</th>}
              <th className="py-2 font-medium whitespace-nowrap">New seat</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isSelected = selectedIds.has(r.userId);
              return (
                <tr key={r.userId} className={`border-b border-slate-50 hover:bg-slate-50/50 ${!isSelected ? "opacity-50" : ""}`}>
                  <td className="py-2 px-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleRow(r.userId)}
                      className="rounded border-slate-300 accent-slate-900 h-4 w-4 cursor-pointer"
                    />
                  </td>
                  <td className="py-2 font-medium text-slate-800 whitespace-nowrap">{r.userName}</td>
                  <td className="py-2 whitespace-nowrap"><CategoryChip category={r.category} /></td>
                  {!isFirst && <td className="py-2 font-mono text-xs text-slate-400 whitespace-nowrap">{r.previousSeat}</td>}
                  <td className="py-2 font-mono text-xs font-semibold text-slate-800 whitespace-nowrap">
                    {!isFirst && <ArrowRight size={11} className="inline mr-1 text-slate-300" />}
                    {isSelected ? r.assignedSeat : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={handleConfirm} className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800">Confirm &amp; save</button>
      </div>
    </ModalShell>
  );
}
