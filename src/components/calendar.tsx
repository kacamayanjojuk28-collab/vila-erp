"use client";
import { label } from "@/lib/modules";
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api, Badge, Empty, Stat, Title, type Row } from "./ui";
export default function CalendarPage({
  revision,
  go,
  me,
  notify,
  changed,
  can,
}: any) {
  const [records, setRecords] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [month, setMonth] = useState(
      () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    ),
    [selected, setSelected] = useState(() =>
      new Date().toLocaleDateString("sv-SE"),
    ),
    [person, setPerson] = useState(""),
    [type, setType] = useState(""),
    [week, setWeek] = useState(false);
  useEffect(() => {
    api("dashboard?view=summary")
      .then((d) =>
        setRecords(
          d.records.filter((r: Row) =>
            ["tasks", "activities"].includes(r.kind),
          ),
        ),
      )
      .catch((e) => setError(e.message));
  }, [revision]);
  const filtered = records.filter(
    (r) =>
      (!person || r.data.assigneeId === person) &&
      (!type || (r.kind === "tasks" ? "TASK" : r.data.type) === type),
  );
  const start = new Date(month);
  start.setDate(1 - ((start.getDay() + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const selectedDate = new Date(selected + "T12:00:00");
  const visible = week
    ? cells.filter((d) => {
        const a = new Date(selectedDate);
        a.setDate(a.getDate() - ((a.getDay() + 6) % 7));
        const b = new Date(a);
        b.setDate(a.getDate() + 7);
        return (
          d >= new Date(a.getFullYear(), a.getMonth(), a.getDate()) && d < b
        );
      })
    : cells;
  const today = new Date().toLocaleDateString("sv-SE");
  const events = filtered.filter((r) => r.data.dueDate === selected);
  const overdue = filtered.filter(
    (r) =>
      r.data.dueDate &&
      r.data.dueDate < today &&
      !["DONE", "CANCELLED"].includes(r.status),
  );
  async function complete(r: Row) {
    try {
      await api(r.kind + "/" + r.id, "PATCH", {
        ...r,
        status: r.status === "DONE" ? "OPEN" : "DONE",
      });
      changed();
    } catch (e: any) {
      notify(e.message);
    }
  }
  return (
    <>
      <div className="head">
        <Title>
          Ekip
          <br />
          takvimi
        </Title>
        <div className="stats">
          <Stat
            icon={<CalendarDays />}
            value={String(
              filtered.filter((r) => r.data.dueDate === today).length,
            )}
            caption="Bugünkü görevler"
          />
          <Stat
            icon={<Activity />}
            value={String(overdue.length)}
            caption="Geciken, açık işler"
          />
        </div>
      </div>
      <div className="toolbar">
        <select
          className="filter"
          aria-label="Sorumlu filtresi"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
        >
          <option value="">Herkes</option>
          {me.members.map((m: Row) => (
            <option key={m.id} value={m.userId}>
              {m.user.name}
            </option>
          ))}
        </select>
        <select
          className="filter"
          aria-label="Etkinlik türü"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">Tüm etkinlikler</option>
          {["TASK", "CALL", "MEETING", "EMAIL", "NOTE"].map((t) => (
            <option key={t} value={t}>
              {label(t)}
            </option>
          ))}
        </select>
        <span className="spacer" />
        <button className="btn primary" onClick={() => go("tasks")}>
          <Plus />
          Görevleri yönet
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="calendar-layout">
        <section className="card">
          <div className="cardhead">
            <h2>
              {month.toLocaleDateString("tr-TR", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <div className="actions">
              <button
                className="iconbtn"
                aria-label="Önceki ay"
                onClick={() => {
                  const m = new Date(
                    month.getFullYear(),
                    month.getMonth() - 1,
                    1,
                  );
                  setMonth(m);
                  setSelected(m.toLocaleDateString("sv-SE"));
                }}
              >
                <ChevronLeft />
              </button>
              <button
                className="btn sm"
                onClick={() => {
                  setMonth(
                    new Date(
                      new Date().getFullYear(),
                      new Date().getMonth(),
                      1,
                    ),
                  );
                  setSelected(today);
                }}
              >
                Bugün
              </button>
              <button
                className="iconbtn"
                aria-label="Sonraki ay"
                onClick={() => {
                  const m = new Date(
                    month.getFullYear(),
                    month.getMonth() + 1,
                    1,
                  );
                  setMonth(m);
                  setSelected(m.toLocaleDateString("sv-SE"));
                }}
              >
                <ChevronRight />
              </button>
              <div className="seg">
                <button
                  className={!week ? "active" : ""}
                  onClick={() => setWeek(false)}
                >
                  Ay
                </button>
                <button
                  className={week ? "active" : ""}
                  onClick={() => setWeek(true)}
                >
                  Hafta
                </button>
              </div>
            </div>
          </div>
          <div className="calendar-scroll">
            <div className="calendar-days">
              {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {visible.map((d) => {
                const key = d.toLocaleDateString("sv-SE"),
                  items = filtered.filter((r) => r.data.dueDate === key);
                return (
                  <button
                    key={key}
                    aria-label={key}
                    aria-pressed={key === selected}
                    className={
                      "calendar-cell " +
                      (d.getMonth() !== month.getMonth() ? "outside " : "") +
                      (key === today ? "todaycell" : "")
                    }
                    onClick={() => setSelected(key)}
                  >
                    <b>{d.getDate()}</b>
                    {items.slice(0, 2).map((r) => (
                      <span
                        className={
                          "calendar-event " +
                          (r.status === "DONE" ? "finished" : "")
                        }
                        key={r.id}
                      >
                        <i
                          style={{
                            background:
                              r.kind === "tasks"
                                ? "var(--text)"
                                : r.data.type === "MEETING"
                                  ? "var(--coral)"
                                  : "var(--sky)",
                          }}
                        />
                        {r.name}
                      </span>
                    ))}
                    {items.length > 2 && (
                      <small>+{items.length - 2} daha</small>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
        <aside className="card">
          <div className="cardhead">
            <div>
              <h2>{selected === today ? "Bugün" : "Seçili gün"}</h2>
              <small>
                {selectedDate.toLocaleDateString("tr-TR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </small>
            </div>
            <CalendarDays size={20} />
          </div>
          {events.length ? (
            events.map((r) => (
              <div className="calendar-detail" key={r.id}>
                <input
                  type="checkbox"
                  aria-label={"Tamamla " + r.name}
                  checked={r.status === "DONE"}
                  disabled={!can(r.kind)}
                  onChange={() => complete(r)}
                />
                <div>
                  <b>{r.name}</b>
                  <small>
                    {r.kind === "tasks"
                      ? label(r.data.priority)
                      : label(r.data.type)}
                  </small>
                </div>
              </div>
            ))
          ) : (
            <Empty
              text="Bu gün boş"
              hint="Görev ve müşteri aktivitelerinin tarihleri burada görünür."
            />
          )}
          <div className="cardhead" style={{ marginTop: 20 }}>
            <h3>Geciken işler</h3>
            <Badge value={String(overdue.length)} />
          </div>
          {overdue.slice(0, 6).map((r) => (
            <div className="calendar-detail" key={r.id}>
              <input
                type="checkbox"
                aria-label={"Tamamla " + r.name}
                checked={false}
                disabled={!can(r.kind)}
                onChange={() => complete(r)}
              />
              <div>
                <b>{r.name}</b>
                <small>{r.data.dueDate}</small>
              </div>
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}
