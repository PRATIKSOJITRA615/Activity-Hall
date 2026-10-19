import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Calendar as CalendarIcon,
  X
} from "lucide-react";

const pad = (n) => String(n).padStart(2, "0");

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function normalizeDate(d) {
  if (!d) return "";
  if (typeof d === "string") {
    const s = d.trim().replace(/\//g, "-");
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      return `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))}`;
    }
  }
  const dateObj = new Date(d);
  if (!isNaN(dateObj.getTime())) {
    return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
  }
  return "";
}

export default function ActivityMiniCalendar({ events = [], lastEvent = null, onSelectEvent }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef(null);
  const containerRef = useRef(null);

  // Parse initial year & month based on lastEvent or today
  const initialDate = useMemo(() => {
    if (lastEvent?.eventDate) {
      const norm = normalizeDate(lastEvent.eventDate);
      if (norm) {
        const [y, m] = norm.split("-");
        return { year: parseInt(y, 10), month: parseInt(m, 10) - 1 };
      }
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, [lastEvent]);

  const [viewYear, setViewYear] = useState(initialDate.year);
  const [viewMonth, setViewMonth] = useState(initialDate.month);
  const [selectedDate, setSelectedDate] = useState(null);

  // Update view when lastEvent changes initially
  useEffect(() => {
    setViewYear(initialDate.year);
    setViewMonth(initialDate.month);
  }, [initialDate.year, initialDate.month]);

  // Today key
  const todayKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }, []);

  // Map events by normalized date
  const eventsByDate = useMemo(() => {
    const map = {};
    (events || []).forEach((ev) => {
      if (!ev || !ev.eventDate) return;
      const key = normalizeDate(ev.eventDate);
      if (!key) return;
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(ev);
    });
    return map;
  }, [events]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsHovered(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setIsHovered(false);
      }
    };

    if (isOpen || isHovered) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isHovered]);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 250);
  };

  const toggleOpen = (e) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const jumpToLatestOrToday = (e) => {
    e.stopPropagation();
    if (lastEvent?.eventDate) {
      const norm = normalizeDate(lastEvent.eventDate);
      if (norm) {
        const [y, m] = norm.split("-");
        setViewYear(parseInt(y, 10));
        setViewMonth(parseInt(m, 10) - 1);
        setSelectedDate(norm);
        return;
      }
    }
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelectedDate(todayKey);
  };

  // Build calendar matrix
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells = [];

    // Previous month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateKey = `${prevYear}-${pad(prevMonth + 1)}-${pad(dayNum)}`;
      cells.push({
        dayNum,
        dateKey,
        isCurrentMonth: false,
        events: eventsByDate[dateKey] || [],
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateKey = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
      cells.push({
        dayNum: d,
        dateKey,
        isCurrentMonth: true,
        events: eventsByDate[dateKey] || [],
      });
    }

    // Next month leading days to complete week rows
    const totalRemaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= totalRemaining; d++) {
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateKey = `${nextYear}-${pad(nextMonth + 1)}-${pad(d)}`;
      cells.push({
        dayNum: d,
        dateKey,
        isCurrentMonth: false,
        events: eventsByDate[dateKey] || [],
      });
    }

    return cells;
  }, [viewYear, viewMonth, eventsByDate]);

  // Activities in this current viewed month
  const currentMonthActivities = useMemo(() => {
    const prefix = `${viewYear}-${pad(viewMonth + 1)}-`;
    const list = [];
    Object.keys(eventsByDate).forEach((key) => {
      if (key.startsWith(prefix)) {
        list.push(...eventsByDate[key]);
      }
    });
    return list.sort((a, b) => (a.eventDate || "").localeCompare(b.eventDate || ""));
  }, [viewYear, viewMonth, eventsByDate]);

  const selectedDayActivities = selectedDate ? eventsByDate[selectedDate] || [] : null;

  const isVisible = isOpen || isHovered;

  const popoverRef = useRef(null);
  const [shiftX, setShiftX] = useState(0);

  useEffect(() => {
    if (isVisible && popoverRef.current) {
      const rect = popoverRef.current.getBoundingClientRect();
      let shift = 0;
      if (rect.right > window.innerWidth - 12) {
        shift = -(rect.right - (window.innerWidth - 12));
      } else if (rect.left < 12) {
        shift = 12 - rect.left;
      }
      setShiftX(shift);
    } else {
      setShiftX(0);
    }
  }, [isVisible, viewYear, viewMonth]);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Icon button trigger */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Activity calendar"
        title="Open mini activity calendar"
        className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
          isVisible
            ? "bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-300"
            : "text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 hover:ring-1 hover:ring-emerald-200"
        }`}
      >
        <CalendarDays size={14} className="shrink-0" />
      </button>

      {/* Mini Calendar Popover */}
      {isVisible && (
        <div
          ref={popoverRef}
          className="absolute -right-20 sm:right-0 top-full mt-2.5 z-50 w-72 sm:w-80 max-w-[calc(100vw-24px)] bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-4 text-slate-800 animate-in fade-in zoom-in-95 duration-150 select-none"
          style={{
            transform: shiftX ? `translateX(${shiftX}px)` : undefined,
            filter: "drop-shadow(0 10px 25px rgba(0,0,0,0.12))",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Month / Navigation */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className="font-display font-bold text-sm text-slate-900 tracking-tight">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              {currentMonthActivities.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {currentMonthActivities.length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={jumpToLatestOrToday}
                title="Go to latest / today"
                className="text-[10px] font-medium px-2 py-0.5 rounded-md text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 transition-colors"
              >
                Jump
              </button>
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next month"
                className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400 mt-2.5 mb-1 tracking-wider uppercase">
            {WEEK_DAYS.map((wd) => (
              <div key={wd} className="py-0.5">
                {wd}
              </div>
            ))}
          </div>

          {/* Calendar Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-xs">
            {calendarCells.map((cell, idx) => {
              const hasActivity = cell.events.length > 0;
              const isToday = cell.dateKey === todayKey;
              const isSelected = selectedDate === cell.dateKey;

              if (!cell.isCurrentMonth) {
                return (
                  <div
                    key={idx}
                    className="h-8 flex items-center justify-center text-slate-300 text-[11px] select-none rounded-lg"
                  >
                    {cell.dayNum}
                  </div>
                );
              }

              // Activity days: distinctive vibrant GREEN UI styling
              if (hasActivity) {
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      setSelectedDate(selectedDate === cell.dateKey ? null : cell.dateKey)
                    }
                    title={`${cell.dateKey}: ${cell.events.map((e) => e.eventName).join(", ")}`}
                    className={`h-8 rounded-lg font-bold text-[11px] cursor-pointer flex flex-col items-center justify-center relative transition-all duration-150 ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-md ring-2 ring-emerald-300 scale-105"
                        : "bg-emerald-500 text-white shadow-xs hover:bg-emerald-600 hover:scale-105 hover:shadow-sm"
                    }`}
                  >
                    <span>{cell.dayNum}</span>
                    {cell.events.length > 1 ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-white/90 -mt-0.5" />
                    ) : (
                      <span className="w-1 h-1 rounded-full bg-white/80 -mt-0.5" />
                    )}
                  </button>
                );
              }

              // Today without activity
              if (isToday) {
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() =>
                      setSelectedDate(selectedDate === cell.dateKey ? null : cell.dateKey)
                    }
                    className={`h-8 rounded-lg font-semibold text-[11px] cursor-pointer flex items-center justify-center transition-colors ${
                      isSelected
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 text-slate-900 border border-slate-300 hover:bg-slate-200"
                    }`}
                  >
                    {cell.dayNum}
                  </button>
                );
              }

              // Normal day
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    setSelectedDate(selectedDate === cell.dateKey ? null : cell.dateKey)
                  }
                  className={`h-8 rounded-lg text-[11px] cursor-pointer flex items-center justify-center transition-colors ${
                    isSelected
                      ? "bg-slate-900 text-white font-semibold shadow-xs"
                      : "text-slate-700 hover:bg-slate-100 font-medium"
                  }`}
                >
                  {cell.dayNum}
                </button>
              );
            })}
          </div>

          {/* Activity Details / Month Summary */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            {selectedDate ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-700">
                    {selectedDate}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(null)}
                    className="text-[10px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                  >
                    Show all in month
                  </button>
                </div>
                {selectedDayActivities && selectedDayActivities.length > 0 ? (
                  <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                    {selectedDayActivities.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => onSelectEvent && onSelectEvent(ev)}
                        className={`flex items-center justify-between p-1.5 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-950 text-xs ${
                          onSelectEvent ? "hover:bg-emerald-100 cursor-pointer" : ""
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="font-semibold truncate">{ev.eventName}</span>
                        </div>
                        <span className="text-[10px] font-medium text-emerald-700 shrink-0 ml-1">
                          #{ev.eventNumber}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic py-1">
                    No activity on this date.
                  </p>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-700">
                    Activities in {MONTH_NAMES[viewMonth]}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {currentMonthActivities.length} total
                  </span>
                </div>
                {currentMonthActivities.length > 0 ? (
                  <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                    {currentMonthActivities.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => {
                          setSelectedDate(normalizeDate(ev.eventDate));
                          if (onSelectEvent) onSelectEvent(ev);
                        }}
                        className={`flex items-center justify-between p-1.5 rounded-lg bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-100 text-emerald-950 text-xs cursor-pointer transition-colors`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span className="font-semibold truncate text-[11px]">
                            {ev.eventName}
                          </span>
                        </div>
                        <span className="text-[10px] font-medium text-emerald-700 shrink-0 ml-1">
                          {ev.eventDate}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic py-1">
                    No activities recorded this month.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer Legend */}
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-md bg-emerald-500 shrink-0 inline-block" />
              <span>Activity scheduled</span>
            </div>
            <span>Click date for details</span>
          </div>
        </div>
      )}
    </div>
  );
}
