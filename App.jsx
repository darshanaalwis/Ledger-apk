import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import {
  Home, BookOpen, FileText, PieChart as PieIcon, Wallet, Plus, Settings, Search, X, Trash2,
  ArrowLeftRight, Check, Send, Copy, Landmark, Banknote, Smartphone, ChevronRight,
} from "lucide-react";

const store = {
  get: async (k) => { const v = window.localStorage.getItem(k); return v ? { value: v } : null; },
  set: async (k, v) => { window.localStorage.setItem(k, v); },
};

/* ---------- constants & helpers ---------- */
const CURRENCIES = {
  USD: { s: "$", l: "en-US", d: 2 }, EUR: { s: "€", l: "de-DE", d: 2 }, GBP: { s: "£", l: "en-GB", d: 2 },
  KES: { s: "KSh ", l: "en-KE", d: 2 }, UGX: { s: "USh ", l: "en-UG", d: 0 }, TZS: { s: "TSh ", l: "en-TZ", d: 0 },
  NGN: { s: "₦", l: "en-NG", d: 2 }, ZAR: { s: "R ", l: "en-ZA", d: 2 }, INR: { s: "₹", l: "en-IN", d: 2 },
};
const money = (n, cur) => {
  const c = CURRENCIES[cur] || CURRENCIES.USD;
  const v = Math.abs(n || 0).toLocaleString(c.l, { minimumFractionDigits: c.d, maximumFractionDigits: c.d });
  return (n < 0 ? "−" : "") + c.s + v;
};
const INCOME_CATS = ["Sales", "Services", "Interest", "Other income"];
const EXPENSE_CATS = ["Rent", "Salaries", "Stock & supplies", "Transport", "Utilities", "Marketing", "Taxes", "Other expense"];
const CAT_COLORS = {
  Sales: "#1E6B45", Services: "#3F8F6B", Interest: "#7BB394", "Other income": "#A9CDB8",
  Rent: "#172033", Salaries: "#3D4A6B", "Stock & supplies": "#A86F12", Transport: "#C99A3E",
  Utilities: "#4F7C8A", Marketing: "#8A4F7D", Taxes: "#B3372C", "Other expense": "#8B93A5",
};
const ACC_TYPES = { cash: "Cash", bank: "Bank", mobile: "Mobile money", other: "Other" };
const ACC_ICONS = { cash: Banknote, bank: Landmark, mobile: Smartphone, other: Wallet };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => iso(new Date());
const addDays = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const fmtDate = (s) => { const d = new Date(s + "T12:00:00"); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const fmtDateLong = (s) => { const d = new Date(s + "T12:00:00"); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const monthLabel = (k) => { const [y, m] = k.split("-"); return `${FULL_MONTHS[+m - 1]} ${y}`; };
const uid = () => Math.random().toString(36).slice(2, 9);
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);

const invTotals = (inv) => {
  const subtotal = inv.items.reduce((s, i) => s + i.qty * i.price, 0);
  const tax = (subtotal * (inv.taxRate || 0)) / 100;
  return { subtotal, tax, total: subtotal + tax };
};
const invStatus = (i) => (i.status === "sent" && i.dueDate < todayISO() ? "overdue" : i.status);
const STATUS_LABEL = { draft: "Draft", sent: "Sent", overdue: "Overdue", paid: "Paid" };

function rangeStats(txs, from, to) {
  const inc = {}, exp = {};
  let income = 0, expense = 0;
  txs.forEach((t) => {
    if (t.date < from || t.date > to) return;
    if (t.type === "income") { income += t.amount; inc[t.category] = (inc[t.category] || 0) + t.amount; }
    else if (t.type === "expense") { expense += t.amount; exp[t.category] = (exp[t.category] || 0) + t.amount; }
  });
  return { income, expense, profit: income - expense, inc, exp };
}

function copyText(text, notify) {
  try {
    const p = navigator.clipboard && navigator.clipboard.writeText(text);
    if (p) p.then(() => notify("Copied")).catch(() => notify("Copy isn't available here"));
    else notify("Copy isn't available here");
  } catch (e) { notify("Copy isn't available here"); }
}

/* ---------- sample data ---------- */
function seed() {
  const now = new Date(), today = todayISO();
  const accounts = [
    { id: "acc-cash", name: "Cash box", type: "cash", opening: 400 },
    { id: "acc-bank", name: "Business bank", type: "bank", opening: 6500 },
    { id: "acc-mobile", name: "Mobile money", type: "mobile", opening: 250 },
  ];
  const transactions = [];
  const add = (date, type, amount, category, accountId, note, extra = {}) => {
    if (date <= today) transactions.push({ id: uid(), type, amount: Math.round(amount), category, accountId, date, note, ...extra });
  };
  for (let m = 5; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const day = (n) => iso(new Date(d.getFullYear(), d.getMonth(), n));
    const f = 1 + (((5 - m) * 7) % 6) / 20;
    add(day(3), "income", 2600 * f, "Sales", "acc-bank", "Wholesale orders");
    add(day(11), "income", 1850 * f, "Sales", "acc-cash", "Counter sales");
    add(day(19), "income", 2200 * f, "Sales", "acc-mobile", "Mobile payments");
    add(day(15), "income", 950 * f, "Services", "acc-bank", "Delivery fees");
    add(day(1), "expense", 1300, "Rent", "acc-bank", "Shop rent");
    add(day(5), "expense", 1100 * f, "Stock & supplies", "acc-bank", "Supplier restock");
    add(day(17), "expense", 640 * f, "Stock & supplies", "acc-cash", "Packaging and supplies");
    add(day(8), "expense", 230 * f, "Transport", "acc-cash", "Fuel and deliveries");
    add(day(10), "expense", 210, "Utilities", "acc-bank", "Power and internet");
    add(day(14), "expense", 320 * f, "Marketing", "acc-mobile", "Social media ads");
    add(day(25), "expense", 1900, "Salaries", "acc-bank", "Staff wages");
  }
  const inv = (n, client, issue, due, items, taxRate, status, extra = {}) => ({
    id: uid(), number: `INV-${String(n).padStart(4, "0")}`, client, issueDate: issue, dueDate: due,
    items: items.map(([desc, qty, price]) => ({ id: uid(), desc, qty, price })), taxRate, status, ...extra,
  });
  const paidInv = inv(1, "Brightway Traders", addDays(today, -40), addDays(today, -26), [["Monthly supply contract", 1, 2400]], 0, "paid", { paidDate: addDays(today, -24), accountId: "acc-bank" });
  add(addDays(today, -24), "income", 2400, "Sales", "acc-bank", "Payment for INV-0001", { invoiceId: paidInv.id });
  const invoices = [
    paidInv,
    inv(2, "Harbor Café", addDays(today, -12), addDays(today, -2), [["Bulk coffee beans", 20, 38], ["Delivery", 1, 45]], 8, "sent"),
    inv(3, "Northside Clinic", addDays(today, -4), addDays(today, 10), [["Cleaning supplies", 12, 55]], 8, "sent"),
    inv(4, "Kito & Sons", today, addDays(today, 14), [["Consulting hours", 6, 120]], 0, "draft"),
  ];
  return { accounts, transactions, invoices, settings: { business: "My Business", currency: "USD" } };
}
const EMPTY = () => ({
  accounts: [{ id: "acc-cash", name: "Cash", type: "cash", opening: 0 }],
  transactions: [], invoices: [], settings: { business: "My Business", currency: "USD" },
});

/* ---------- styles ---------- */
const CSS = `
.lg{--paper:#E9EFE5;--sheet:#F8FAF5;--ink:#172033;--soft:#58647B;--rule:#CBD6C6;--green:#1E6B45;--red:#B3372C;--ochre:#A86F12;
--serif:"Iowan Old Style","Palatino Linotype","Book Antiqua",Georgia,serif;
--sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
font-family:var(--sans);color:var(--ink);background:var(--paper);min-height:100vh;display:flex;justify-content:center;font-size:15px;line-height:1.4;-webkit-tap-highlight-color:transparent}
.lg *{box-sizing:border-box}
.lg button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;padding:0;text-align:left}
.lg input,.lg select,.lg textarea{font:inherit;color:inherit;width:100%;background:#fff;border:1px solid var(--rule);border-radius:10px;padding:11px 12px;min-height:44px}
.lg textarea{resize:none}
.lg :focus-visible{outline:2px solid var(--ochre);outline-offset:2px}
.lg h1,.lg h2,.lg h3,.lg p{margin:0}
.lg-shell{width:100%;max-width:460px;min-height:100vh;background:var(--sheet);position:relative;padding-bottom:110px;box-shadow:0 0 0 1px var(--rule)}
.lg-head{display:flex;justify-content:space-between;align-items:flex-start;padding:22px 20px 6px}
.lg-head h1{font-family:var(--serif);font-size:26px;font-weight:600;letter-spacing:-.01em}
.lg-head p{color:var(--soft);font-size:13px;margin-top:2px}
.lg-iconbtn{width:42px;height:42px;display:grid;place-items:center;border:1px solid var(--rule)!important;border-radius:11px;background:#fff!important}
.lg-sec{padding:0 20px}
.lg-sec h2{font-family:var(--serif);font-size:20px;font-weight:600;margin:26px 0 8px}
.lg-secrow{display:flex;justify-content:space-between;align-items:baseline;padding:0 20px;margin:26px 0 8px}
.lg-secrow h2{font-family:var(--serif);font-size:20px;font-weight:600}
.lg-link{color:var(--ochre);font-weight:600;font-size:14px}
.lg-fig{font-family:var(--serif);font-variant-numeric:tabular-nums lining-nums}
.lg-total{display:inline-block;font-size:42px;font-weight:600;letter-spacing:-.02em;border-bottom:5px double var(--ink);padding-bottom:3px;margin-top:6px}
.lg-hero{padding:14px 20px 8px}
.lg-hero .l{color:var(--soft);font-size:13px}
.lg-trio{display:grid;grid-template-columns:repeat(3,1fr);margin:18px 20px 0;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.lg-trio>div{padding:12px 0 12px 12px;border-left:1px solid var(--rule)}
.lg-trio>div:first-child{border-left:0;padding-left:0}
.lg-trio .l{color:var(--soft);font-size:12px}
.lg-trio .v{font-size:17px;font-weight:600;margin-top:2px}
.lg-alert{margin:18px 20px 0;padding:12px 14px;border:1px solid var(--red);border-left-width:5px;border-radius:10px;background:#fff;display:flex;justify-content:space-between;align-items:center;gap:12px;width:calc(100% - 40px)}
.lg-alert b{display:block}
.lg-alert span{color:var(--soft);font-size:13px}
.lg-tx{display:grid;grid-template-columns:66px 1fr auto;border-bottom:1px solid var(--rule);width:100%;align-items:stretch}
.lg-tx .d{padding:13px 0 13px 20px;color:var(--soft);font-size:13px}
.lg-tx .m{padding:11px 10px 11px 0;display:flex;flex-direction:column;min-width:0}
.lg-tx .t{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lg-tx .s{color:var(--soft);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lg-tx .a{border-left:1px solid var(--rule);padding:11px 20px 11px 12px;text-align:right;min-width:116px;display:flex;flex-direction:column;justify-content:center;font-family:var(--serif);font-weight:600;font-variant-numeric:tabular-nums lining-nums;font-size:16px}
.lg-tx .a small{font-family:var(--sans);font-weight:400;color:var(--soft);font-size:12px}
.lg-mhead{display:flex;justify-content:space-between;align-items:baseline;padding:18px 20px 8px;border-bottom:1px solid var(--ink);gap:10px}
.lg-mhead h3{font-family:var(--serif);font-size:18px;font-weight:600}
.lg-mhead span{font-size:12px;color:var(--soft)}
.lg-chips{display:flex;gap:8px;padding:12px 20px 4px;overflow-x:auto}
.lg-chip{border:1px solid var(--rule)!important;border-radius:999px;padding:7px 14px;font-size:14px;background:#fff!important;white-space:nowrap;min-height:36px}
.lg-chip.on{background:var(--ink)!important;color:var(--sheet)!important;border-color:var(--ink)!important}
.lg-search{position:relative;margin:12px 20px 0}
.lg-search svg{position:absolute;left:12px;top:13px;color:var(--soft)}
.lg-search input{padding-left:38px}
.lg-empty{padding:34px 20px;color:var(--soft);text-align:center}
.lg-empty b{display:block;color:var(--ink);margin-bottom:4px;font-family:var(--serif);font-size:18px}
.lg-tag{border:1.5px solid currentColor;border-radius:4px;padding:1px 7px;font-size:12px;font-weight:700;white-space:nowrap}
.lg-tag.paid{color:var(--green)}.lg-tag.overdue{color:var(--red)}.lg-tag.sent{color:var(--ochre)}.lg-tag.draft{color:var(--soft)}
.lg-inv{display:grid;grid-template-columns:1fr auto;gap:2px 12px;padding:13px 20px;border-bottom:1px solid var(--rule);width:100%}
.lg-inv .r{text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.lg-inv .n{font-weight:600}.lg-inv .s{color:var(--soft);font-size:13px}
.lg-stmt{margin:0 20px}
.lg-line{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px dotted var(--rule);gap:12px}
.lg-line .v{font-family:var(--serif);font-variant-numeric:tabular-nums lining-nums;white-space:nowrap}
.lg-line.sub{border-top:1px solid var(--ink);border-bottom:0;font-weight:700;margin-top:2px}
.lg-line.grand{border-top:1px solid var(--ink);border-bottom:5px double var(--ink);font-weight:700;font-size:17px;margin-top:6px;padding-bottom:7px}
.lg-grp{font-family:var(--serif);font-size:16px;font-weight:600;margin:18px 0 2px}
.lg-acc{display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid var(--rule);width:100%}
.lg-acc .ic{width:42px;height:42px;border-radius:11px;background:#fff;border:1px solid var(--rule);display:grid;place-items:center;color:var(--ink)}
.lg-acc .nm{flex:1;min-width:0}.lg-acc .nm b{display:block}.lg-acc .nm span{color:var(--soft);font-size:13px}
.lg-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 18px;border-radius:12px;background:var(--ink)!important;color:var(--sheet)!important;font-weight:600;text-align:center!important}
.lg-btn.ghost{background:#fff!important;color:var(--ink)!important;border:1px solid var(--ink)!important}
.lg-btn.danger{background:#fff!important;color:var(--red)!important;border:1px solid var(--red)!important}
.lg-btn.full{width:100%}
.lg-pad{padding:14px 20px}
.lg-tabs{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:460px;background:var(--sheet);border-top:1px solid var(--ink);display:grid;grid-template-columns:repeat(5,1fr);padding:6px 4px calc(8px + env(safe-area-inset-bottom));z-index:20}
.lg-tab{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11.5px;color:var(--soft);padding:6px 0;min-height:48px;text-align:center!important}
.lg-tab.on{color:var(--ink);font-weight:700}
.lg-tab.on svg{stroke-width:2.6}
.lg-fabwrap{position:fixed;bottom:84px;left:50%;transform:translateX(-50%);width:100%;max-width:460px;pointer-events:none;z-index:30;display:flex;justify-content:flex-end;padding:0 18px}
.lg-fab{pointer-events:auto;width:58px;height:58px;border-radius:50%;background:var(--ink)!important;color:var(--sheet)!important;display:grid!important;place-items:center;box-shadow:0 4px 14px rgba(23,32,51,.28)}
.lg-overlay{position:fixed;inset:0;background:rgba(23,32,51,.45);z-index:50;display:flex;align-items:flex-end;justify-content:center}
.lg-sheet{background:var(--sheet);width:100%;max-width:460px;max-height:92vh;display:flex;flex-direction:column;border-radius:20px 20px 0 0;animation:lgup .22s ease-out}
@keyframes lgup{from{transform:translateY(28px);opacity:0}to{transform:none;opacity:1}}
.lg-grab{width:42px;height:4px;border-radius:2px;background:var(--rule);margin:8px auto 0}
.lg-sheethead{display:flex;justify-content:space-between;align-items:center;padding:10px 20px 6px}
.lg-sheethead h2{font-family:var(--serif);font-size:22px;font-weight:600}
.lg-sheetbody{overflow:auto;padding:6px 20px 16px;flex:1}
.lg-sheetfoot{padding:12px 20px calc(14px + env(safe-area-inset-bottom));border-top:1px solid var(--rule);display:flex;gap:10px}
.lg-sheetfoot .lg-btn{flex:1}
.lg-field{margin-top:14px}
.lg-field>label,.lg-field>.lb{display:block;font-size:13px;color:var(--soft);margin-bottom:5px}
.lg-seg{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--ink);border-radius:12px;overflow:hidden}
.lg-seg button{padding:11px 4px;text-align:center;font-weight:600;font-size:14px}
.lg-seg button.on{background:var(--ink);color:var(--sheet)}
.lg-amount{display:flex;align-items:baseline;gap:6px;border-bottom:5px double var(--ink);padding:4px 0 2px;margin-top:16px}
.lg-amount span{font-family:var(--serif);font-size:26px;color:var(--soft)}
.lg-amount input{border:0!important;background:transparent!important;font-family:var(--serif);font-size:36px;font-weight:600;padding:0!important;min-height:52px;border-radius:0}
.lg-cats{display:flex;flex-wrap:wrap;gap:8px}
.lg-cat{border:1px solid var(--rule)!important;border-radius:999px;padding:7px 13px;font-size:14px;background:#fff!important;display:flex;align-items:center;gap:7px;min-height:36px}
.lg-cat i{width:9px;height:9px;border-radius:50%;display:block}
.lg-cat.on{border-color:var(--ink)!important;box-shadow:inset 0 0 0 1px var(--ink)}
.lg-err{color:var(--red);font-size:13.5px;margin-top:12px}
.lg-hint{color:var(--soft);font-size:13px;margin-top:6px}
.lg-item{border:1px solid var(--rule);border-radius:12px;padding:10px;margin-top:10px;background:#fff;display:grid;grid-template-columns:1fr 72px 1fr 40px;gap:8px;align-items:center}
.lg-item .full{grid-column:1/-1}
.lg-item input{min-height:40px;padding:8px 10px}
.lg-menu{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--rule);width:100%}
.lg-menu .ic{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;color:#fff}
.lg-menu b{display:block}.lg-menu span{color:var(--soft);font-size:13px}
.lg-toast{position:fixed;bottom:150px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--sheet);padding:10px 16px;border-radius:10px;z-index:60;font-size:14px;display:flex;gap:8px;align-items:center}
.lg-legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:6px}
.lg-legend span{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--soft)}
.lg-legend i{width:9px;height:9px;border-radius:50%}
.lg-load{padding:80px 20px;text-align:center;color:var(--soft);font-family:var(--serif);font-size:18px}
@media (prefers-reduced-motion:reduce){.lg *{animation:none!important;transition:none!important}}
`;

/* ---------- small shared components ---------- */
function Chip({ on, onClick, children }) {
  return <button className={"lg-chip" + (on ? " on" : "")} onClick={onClick}>{children}</button>;
}
function Field({ label, children }) {
  return <div className="lg-field"><div className="lb">{label}</div>{children}</div>;
}
function Sheet({ title, onClose, children, footer }) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="lg-overlay" onClick={onClose}>
      <div className="lg-sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="lg-grab" />
        <div className="lg-sheethead">
          <h2>{title}</h2>
          <button className="lg-iconbtn" aria-label="Close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="lg-sheetbody">{children}</div>
        {footer && <div className="lg-sheetfoot">{footer}</div>}
      </div>
    </div>
  );
}
function TxRow({ t, accName, cur, onClick }) {
  const isT = t.type === "transfer";
  const title = isT ? "Transfer" : (t.note || t.category);
  const sub = isT ? `${accName(t.accountId)} to ${accName(t.toAccountId)}` : t.category;
  const sign = t.type === "income" ? "+" : t.type === "expense" ? "−" : "";
  const color = t.type === "income" ? "var(--green)" : t.type === "expense" ? "var(--red)" : "var(--ink)";
  return (
    <button className="lg-tx" onClick={onClick}>
      <span className="d">{fmtDate(t.date)}</span>
      <span className="m"><span className="t">{title}</span><span className="s">{sub}</span></span>
      <span className="a" style={{ color }}>{sign}{money(t.amount, cur)}<small>{isT ? "" : accName(t.accountId)}</small></span>
    </button>
  );
}

/* ---------- screens ---------- */
function HomeScreen({ data, cur, total, series, month, overdue, recent, accName, go, openTx, openSettings }) {
  const overdueSum = overdue.reduce((s, i) => s + invTotals(i).total, 0);
  const d = new Date();
  return (
    <>
      <div className="lg-head">
        <div>
          <h1>{data.settings.business}</h1>
          <p>{d.getDate()} {FULL_MONTHS[d.getMonth()]} {d.getFullYear()}</p>
        </div>
        <button className="lg-iconbtn" aria-label="Settings" onClick={openSettings}><Settings size={20} /></button>
      </div>
      <div className="lg-hero">
        <div className="l">Cash across all accounts</div>
        <div className="lg-fig lg-total">{money(total, cur)}</div>
      </div>
      <div className="lg-trio">
        <div><div className="l">Money in</div><div className="v lg-fig" style={{ color: "var(--green)" }}>{money(month.income, cur)}</div></div>
        <div><div className="l">Money out</div><div className="v lg-fig" style={{ color: "var(--red)" }}>{money(month.expense, cur)}</div></div>
        <div><div className="l">Profit</div><div className="v lg-fig">{money(month.profit, cur)}</div></div>
      </div>
      <p className="lg-hint" style={{ padding: "6px 20px 0" }}>Totals for this month</p>
      {overdue.length > 0 && (
        <button className="lg-alert" onClick={() => go("invoices")}>
          <span><b style={{ color: "var(--ink)" }}>{overdue.length} {overdue.length === 1 ? "invoice is" : "invoices are"} overdue</b>{money(overdueSum, cur)} waiting to be paid</span>
          <ChevronRight size={20} />
        </button>
      )}
      <div className="lg-sec"><h2>Last 6 months</h2></div>
      <div style={{ height: 170, padding: "0 12px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} barGap={3} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
            <XAxis dataKey="m" axisLine={{ stroke: "#172033" }} tickLine={false} tick={{ fontSize: 12, fill: "#58647B" }} />
            <Tooltip cursor={{ fill: "rgba(23,32,51,.05)" }} formatter={(v) => money(v, cur)}
              contentStyle={{ borderRadius: 8, border: "1px solid #CBD6C6", background: "#F8FAF5", fontSize: 12 }} />
            <Bar dataKey="income" name="Money in" fill="#1E6B45" radius={[3, 3, 0, 0]} />
            <Bar dataKey="expense" name="Money out" fill="#B3372C" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="lg-secrow"><h2>Recent entries</h2><button className="lg-link" onClick={() => go("ledger")}>See all</button></div>
      <div style={{ borderTop: "1px solid var(--ink)" }}>
        {recent.length === 0 && <div className="lg-empty"><b>No entries yet</b>Tap + to record your first sale or expense.</div>}
        {recent.map((t) => <TxRow key={t.id} t={t} cur={cur} accName={accName} onClick={() => openTx(t.id)} />)}
      </div>
    </>
  );
}

function LedgerScreen({ txs, cur, accName, openTx }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState("all");
  const list = txs.filter((t) => (f === "all" || t.type === f) &&
    (!q || `${t.note || ""} ${t.category} ${accName(t.accountId)}`.toLowerCase().includes(q.toLowerCase())));
  const groups = [];
  list.forEach((t) => {
    const k = t.date.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.k !== k) { g = { k, items: [] }; groups.push(g); }
    g.items.push(t);
  });
  return (
    <>
      <div className="lg-head"><div><h1>Ledger</h1><p>Every sale, expense and transfer</p></div></div>
      <div className="lg-search"><Search size={18} /><input placeholder="Search entries" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search entries" /></div>
      <div className="lg-chips">
        {[["all", "All"], ["income", "Money in"], ["expense", "Money out"], ["transfer", "Transfers"]].map(([k, l]) =>
          <Chip key={k} on={f === k} onClick={() => setF(k)}>{l}</Chip>)}
      </div>
      {groups.length === 0 && <div className="lg-empty"><b>Nothing found</b>Try a different search or filter, or tap + to add an entry.</div>}
      {groups.map((g) => {
        const s = rangeStats(g.items, "0000", "9999");
        return (
          <div key={g.k}>
            <div className="lg-mhead"><h3>{monthLabel(g.k)}</h3><span>In {money(s.income, cur)}, out {money(s.expense, cur)}</span></div>
            {g.items.map((t) => <TxRow key={t.id} t={t} cur={cur} accName={accName} onClick={() => openTx(t.id)} />)}
          </div>
        );
      })}
    </>
  );
}

function InvoicesScreen({ invoices, cur, openInv, newInv }) {
  const [f, setF] = useState("all");
  const withS = invoices.map((i) => ({ ...i, st: invStatus(i), total: invTotals(i).total }));
  const outstanding = withS.filter((i) => i.st === "sent" || i.st === "overdue").reduce((s, i) => s + i.total, 0);
  const overdue = withS.filter((i) => i.st === "overdue").reduce((s, i) => s + i.total, 0);
  const ym = todayISO().slice(0, 7);
  const paidMonth = withS.filter((i) => i.st === "paid" && (i.paidDate || "").startsWith(ym)).reduce((s, i) => s + i.total, 0);
  const shown = withS.filter((i) => f === "all" || (f === "unpaid" ? (i.st === "sent" || i.st === "overdue") : i.st === f))
    .sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1));
  const today = todayISO();
  return (
    <>
      <div className="lg-head">
        <div><h1>Invoices</h1><p>Bill clients and track payments</p></div>
        <button className="lg-btn" style={{ minHeight: 42, padding: "0 14px" }} onClick={newInv}><Plus size={18} />New</button>
      </div>
      <div className="lg-trio">
        <div><div className="l">Outstanding</div><div className="v lg-fig">{money(outstanding, cur)}</div></div>
        <div><div className="l">Overdue</div><div className="v lg-fig" style={{ color: overdue ? "var(--red)" : undefined }}>{money(overdue, cur)}</div></div>
        <div><div className="l">Paid this month</div><div className="v lg-fig" style={{ color: "var(--green)" }}>{money(paidMonth, cur)}</div></div>
      </div>
      <div className="lg-chips">
        {[["all", "All"], ["draft", "Drafts"], ["unpaid", "Unpaid"], ["overdue", "Overdue"], ["paid", "Paid"]].map(([k, l]) =>
          <Chip key={k} on={f === k} onClick={() => setF(k)}>{l}</Chip>)}
      </div>
      <div style={{ borderTop: "1px solid var(--ink)", marginTop: 10 }}>
        {shown.length === 0 && <div className="lg-empty"><b>No invoices here</b>Create an invoice to bill a client.</div>}
        {shown.map((i) => (
          <button key={i.id} className="lg-inv" onClick={() => openInv(i.id)}>
            <span className="n">{i.client}</span>
            <span className="r"><span className="lg-fig" style={{ fontWeight: 600 }}>{money(i.total, cur)}</span></span>
            <span className="s">
              {i.number}, {i.st === "paid" ? `paid ${fmtDate(i.paidDate || i.issueDate)}` :
                i.st === "overdue" ? `${daysBetween(i.dueDate, today)} days overdue` :
                i.st === "draft" ? "not sent yet" : `due ${fmtDate(i.dueDate)}`}
            </span>
            <span className="r"><span className={"lg-tag " + i.st}>{STATUS_LABEL[i.st]}</span></span>
          </button>
        ))}
      </div>
    </>
  );
}

function ReportsScreen({ data, cur, notify }) {
  const [p, setP] = useState("month");
  const now = new Date();
  const from = p === "month" ? iso(new Date(now.getFullYear(), now.getMonth(), 1))
    : p === "quarter" ? iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)) : `${now.getFullYear()}-01-01`;
  const label = p === "month" ? `${FULL_MONTHS[now.getMonth()]} ${now.getFullYear()}` : p === "quarter" ? "Last 3 months" : `Year ${now.getFullYear()}`;
  const s = rangeStats(data.transactions, from, "9999-12-31");
  const inc = Object.entries(s.inc).sort((a, b) => b[1] - a[1]);
  const exp = Object.entries(s.exp).sort((a, b) => b[1] - a[1]);
  const pie = exp.map(([name, value]) => ({ name, value }));
  const margin = s.income > 0 ? Math.round((s.profit / s.income) * 100) : 0;
  const summary = `Profit and loss, ${label}\nMoney in: ${money(s.income, cur)}\nMoney out: ${money(s.expense, cur)}\nNet profit: ${money(s.profit, cur)}`;
  return (
    <>
      <div className="lg-head"><div><h1>Reports</h1><p>{label}</p></div></div>
      <div className="lg-chips">
        {[["month", "This month"], ["quarter", "3 months"], ["year", "This year"]].map(([k, l]) =>
          <Chip key={k} on={p === k} onClick={() => setP(k)}>{l}</Chip>)}
      </div>
      <div className="lg-stmt">
        <h3 className="lg-grp">Money in</h3>
        {inc.length === 0 && <div className="lg-line"><span className="lg-hint">No income recorded</span></div>}
        {inc.map(([k, v]) => <div key={k} className="lg-line"><span>{k}</span><span className="v">{money(v, cur)}</span></div>)}
        <div className="lg-line sub"><span>Total money in</span><span className="v">{money(s.income, cur)}</span></div>
        <h3 className="lg-grp">Money out</h3>
        {exp.length === 0 && <div className="lg-line"><span className="lg-hint">No expenses recorded</span></div>}
        {exp.map(([k, v]) => <div key={k} className="lg-line"><span>{k}</span><span className="v">{money(v, cur)}</span></div>)}
        <div className="lg-line sub"><span>Total money out</span><span className="v">{money(s.expense, cur)}</span></div>
        <div className="lg-line grand" style={{ marginTop: 22, color: s.profit < 0 ? "var(--red)" : "var(--ink)" }}>
          <span>{s.profit < 0 ? "Net loss" : "Net profit"}</span><span className="v">{money(s.profit, cur)}</span>
        </div>
        <p className="lg-hint">Profit margin: {margin}% of money in</p>
      </div>
      {pie.length > 0 && (
        <>
          <div className="lg-sec"><h2>Where the money went</h2></div>
          <div style={{ height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pie} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2} stroke="none">
                  {pie.map((e) => <Cell key={e.name} fill={CAT_COLORS[e.name] || "#8B93A5"} />)}
                </Pie>
                <Tooltip formatter={(v) => money(v, cur)} contentStyle={{ borderRadius: 8, border: "1px solid #CBD6C6", background: "#F8FAF5", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="lg-sec"><div className="lg-legend">
            {pie.map((e) => <span key={e.name}><i style={{ background: CAT_COLORS[e.name] || "#8B93A5" }} />{e.name} {Math.round((e.value / s.expense) * 100)}%</span>)}
          </div></div>
        </>
      )}
      <div className="lg-pad" style={{ marginTop: 18 }}>
        <button className="lg-btn ghost full" onClick={() => copyText(summary, notify)}><Copy size={18} />Copy summary</button>
      </div>
    </>
  );
}

function AccountsScreen({ data, cur, balances, total, openAcc, addAcc, transfer }) {
  return (
    <>
      <div className="lg-head">
        <div><h1>Accounts</h1><p>Where your money sits</p></div>
        <button className="lg-btn" style={{ minHeight: 42, padding: "0 14px" }} onClick={addAcc}><Plus size={18} />Add</button>
      </div>
      <div className="lg-hero">
        <div className="l">Total balance</div>
        <div className="lg-fig lg-total">{money(total, cur)}</div>
      </div>
      <div style={{ borderTop: "1px solid var(--ink)", marginTop: 18 }}>
        {data.accounts.map((a) => {
          const Icon = ACC_ICONS[a.type] || Wallet;
          const b = balances[a.id] || 0;
          return (
            <button key={a.id} className="lg-acc" onClick={() => openAcc(a.id)}>
              <span className="ic"><Icon size={20} /></span>
              <span className="nm"><b>{a.name}</b><span>{ACC_TYPES[a.type]}</span></span>
              <span className="lg-fig" style={{ fontWeight: 600, fontSize: 17, color: b < 0 ? "var(--red)" : "var(--ink)" }}>{money(b, cur)}</span>
            </button>
          );
        })}
      </div>
      <div className="lg-pad">
        <button className="lg-btn ghost full" onClick={transfer} disabled={data.accounts.length < 2}><ArrowLeftRight size={18} />Move money between accounts</button>
        {data.accounts.length < 2 && <p className="lg-hint">Add a second account to move money.</p>}
      </div>
    </>
  );
}

/* ---------- sheets ---------- */
function AddMenu({ onPick, onClose }) {
  const items = [
    ["income", "Record money in", "A sale, payment or deposit", "#1E6B45", Plus],
    ["expense", "Record money out", "A bill, purchase or wage", "#B3372C", X],
    ["transfer", "Move money", "Between your own accounts", "#172033", ArrowLeftRight],
    ["invoice", "Create invoice", "Bill a client", "#A86F12", FileText],
  ];
  return (
    <Sheet title="Add" onClose={onClose}>
      {items.map(([k, t, s, c, Icon]) => (
        <button key={k} className="lg-menu" onClick={() => onPick(k)}>
          <span className="ic" style={{ background: c }}><Icon size={22} /></span>
          <span><b>{t}</b><span>{s}</span></span>
        </button>
      ))}
    </Sheet>
  );
}

function EntrySheet({ data, cur, editing, initType, onSave, onDelete, onClose }) {
  const accs = data.accounts;
  const [type, setType] = useState(editing ? editing.type : initType || "expense");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [category, setCategory] = useState(editing && editing.type !== "transfer" ? editing.category : (initType === "income" ? INCOME_CATS[0] : EXPENSE_CATS[0]));
  const [accountId, setAccountId] = useState(editing ? editing.accountId : accs[0] && accs[0].id);
  const [toId, setToId] = useState(editing && editing.toAccountId ? editing.toAccountId : (accs[1] ? accs[1].id : ""));
  const [date, setDate] = useState(editing ? editing.date : todayISO());
  const [note, setNote] = useState(editing ? editing.note || "" : "");
  const [err, setErr] = useState("");
  const symbol = (CURRENCIES[cur] || CURRENCIES.USD).s.trim();
  const changeType = (t) => {
    setType(t); setErr("");
    if (t === "income" && !INCOME_CATS.includes(category)) setCategory(INCOME_CATS[0]);
    if (t === "expense" && !EXPENSE_CATS.includes(category)) setCategory(EXPENSE_CATS[0]);
  };
  const save = () => {
    const amt = parseFloat(String(amount).replace(/,/g, ""));
    if (!(amt > 0)) return setErr("Enter an amount above 0");
    if (type === "transfer" && accountId === toId) return setErr("Choose two different accounts");
    if (!accountId) return setErr("Choose an account");
    onSave({
      id: editing ? editing.id : uid(), type, amount: amt, date, note: note.trim(), accountId,
      category: type === "transfer" ? "Transfer" : category,
      ...(type === "transfer" ? { toAccountId: toId } : {}),
      ...(editing && editing.invoiceId ? { invoiceId: editing.invoiceId } : {}),
    });
  };
  const cats = type === "income" ? INCOME_CATS : EXPENSE_CATS;
  return (
    <Sheet title={editing ? "Edit entry" : "New entry"} onClose={onClose}
      footer={<>
        {editing && <button className="lg-btn danger" onClick={() => onDelete(editing.id)}><Trash2 size={18} />Delete</button>}
        <button className="lg-btn" onClick={save}><Check size={18} />Save entry</button>
      </>}>
      <div className="lg-seg" role="tablist">
        {[["income", "Money in"], ["expense", "Money out"], ["transfer", "Transfer"]].map(([k, l]) =>
          <button key={k} className={type === k ? "on" : ""} onClick={() => changeType(k)}>{l}</button>)}
      </div>
      <div className="lg-amount">
        <span>{symbol}</span>
        <input inputMode="decimal" placeholder="0.00" aria-label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      {type !== "transfer" && (
        <Field label="Category">
          <div className="lg-cats">
            {cats.map((c) => (
              <button key={c} className={"lg-cat" + (category === c ? " on" : "")} onClick={() => setCategory(c)}>
                <i style={{ background: CAT_COLORS[c] }} />{c}
              </button>
            ))}
          </div>
        </Field>
      )}
      <Field label={type === "transfer" ? "From account" : "Account"}>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      {type === "transfer" && (
        <Field label="To account">
          <select value={toId} onChange={(e) => setToId(e.target.value)}>
            {accs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Note (optional)"><input value={note} placeholder="What was this for?" onChange={(e) => setNote(e.target.value)} /></Field>
      {err && <p className="lg-err" role="alert">{err}</p>}
    </Sheet>
  );
}

function InvoiceSheet({ cur, nextNumber, onSave, onClose }) {
  const today = todayISO();
  const [client, setClient] = useState("");
  const [issue, setIssue] = useState(today);
  const [due, setDue] = useState(addDays(today, 14));
  const [items, setItems] = useState([{ id: uid(), desc: "", qty: "1", price: "" }]);
  const [tax, setTax] = useState("0");
  const [err, setErr] = useState("");
  const clean = items.map((i) => ({ id: i.id, desc: i.desc.trim(), qty: parseFloat(i.qty) || 0, price: parseFloat(i.price) || 0 }))
    .filter((i) => i.desc && i.qty > 0 && i.price > 0);
  const totals = invTotals({ items: clean, taxRate: parseFloat(tax) || 0 });
  const setItem = (id, k, v) => setItems((a) => a.map((i) => (i.id === id ? { ...i, [k]: v } : i)));
  const save = (status) => {
    if (!client.trim()) return setErr("Enter the client name");
    if (!clean.length) return setErr("Add at least one item with a description and price");
    if (due < issue) return setErr("The due date must be on or after the issue date");
    onSave({ id: uid(), number: nextNumber, client: client.trim(), issueDate: issue, dueDate: due, items: clean, taxRate: parseFloat(tax) || 0, status });
  };
  return (
    <Sheet title={`New invoice ${nextNumber}`} onClose={onClose}
      footer={<>
        <button className="lg-btn ghost" onClick={() => save("draft")}>Save draft</button>
        <button className="lg-btn" onClick={() => save("sent")}><Send size={18} />Mark as sent</button>
      </>}>
      <Field label="Client"><input value={client} placeholder="Client or company name" onChange={(e) => setClient(e.target.value)} /></Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Issue date"><input type="date" value={issue} onChange={(e) => setIssue(e.target.value)} /></Field>
        <Field label="Due date"><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
      </div>
      <Field label="Items">
        {items.map((i) => (
          <div className="lg-item" key={i.id}>
            <input className="full" placeholder="Description" aria-label="Item description" value={i.desc} onChange={(e) => setItem(i.id, "desc", e.target.value)} />
            <input inputMode="decimal" placeholder="Qty" aria-label="Quantity" value={i.qty} onChange={(e) => setItem(i.id, "qty", e.target.value)} style={{ gridColumn: "1 / 2" }} />
            <input inputMode="decimal" placeholder="Price" aria-label="Unit price" value={i.price} onChange={(e) => setItem(i.id, "price", e.target.value)} style={{ gridColumn: "2 / 4" }} />
            <button aria-label="Remove item" className="lg-iconbtn" style={{ width: 40, height: 40 }}
              onClick={() => setItems((a) => (a.length > 1 ? a.filter((x) => x.id !== i.id) : a))}><Trash2 size={18} /></button>
          </div>
        ))}
        <button className="lg-link" style={{ marginTop: 10 }} onClick={() => setItems((a) => [...a, { id: uid(), desc: "", qty: "1", price: "" }])}>Add another item</button>
      </Field>
      <Field label="Tax rate (%)"><input inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} /></Field>
      <div className="lg-stmt" style={{ margin: "16px 0 0" }}>
        <div className="lg-line"><span>Subtotal</span><span className="v">{money(totals.subtotal, cur)}</span></div>
        <div className="lg-line"><span>Tax</span><span className="v">{money(totals.tax, cur)}</span></div>
        <div className="lg-line grand"><span>Total</span><span className="v">{money(totals.total, cur)}</span></div>
      </div>
      {err && <p className="lg-err" role="alert">{err}</p>}
    </Sheet>
  );
}

function InvoiceDetail({ inv, data, cur, onClose, onSent, onPay, onDelete, notify }) {
  const [payAcc, setPayAcc] = useState(data.accounts[0] ? data.accounts[0].id : "");
  const [payDate, setPayDate] = useState(todayISO());
  const [confirmDel, setConfirmDel] = useState(false);
  const st = invStatus(inv);
  const t = invTotals(inv);
  const reminder = `Hello ${inv.client}, this is a friendly reminder that invoice ${inv.number} for ${money(t.total, cur)} ${st === "overdue" ? "was due on" : "is due on"} ${fmtDateLong(inv.dueDate)}. Thank you for your business.`;
  return (
    <Sheet title={inv.number} onClose={onClose}
      footer={st === "draft" ? <button className="lg-btn" onClick={onSent}><Send size={18} />Mark as sent</button> : null}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <b style={{ fontSize: 17 }}>{inv.client}</b><span className={"lg-tag " + st}>{STATUS_LABEL[st]}</span>
      </div>
      <p className="lg-hint">Issued {fmtDateLong(inv.issueDate)}, due {fmtDateLong(inv.dueDate)}</p>
      <div className="lg-stmt" style={{ margin: "14px 0 0" }}>
        {inv.items.map((i) => (
          <div key={i.id} className="lg-line">
            <span>{i.desc}<br /><span className="lg-hint">{i.qty} × {money(i.price, cur)}</span></span>
            <span className="v">{money(i.qty * i.price, cur)}</span>
          </div>
        ))}
        <div className="lg-line sub"><span>Subtotal</span><span className="v">{money(t.subtotal, cur)}</span></div>
        <div className="lg-line" style={{ borderBottom: 0 }}><span>Tax ({inv.taxRate || 0}%)</span><span className="v">{money(t.tax, cur)}</span></div>
        <div className="lg-line grand"><span>Total</span><span className="v">{money(t.total, cur)}</span></div>
      </div>
      {(st === "sent" || st === "overdue") && (
        <>
          <Field label="Received into">
            <select value={payAcc} onChange={(e) => setPayAcc(e.target.value)}>
              {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Payment date"><input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></Field>
          <button className="lg-btn full" style={{ marginTop: 14 }} onClick={() => onPay(payAcc, payDate)}><Check size={18} />Record payment</button>
          <Field label="Reminder message">
            <textarea readOnly rows={4} value={reminder} />
          </Field>
          <button className="lg-btn ghost full" style={{ marginTop: 10 }} onClick={() => copyText(reminder, notify)}><Copy size={18} />Copy reminder</button>
        </>
      )}
      {st === "paid" && <p className="lg-hint" style={{ marginTop: 14 }}>Paid on {fmtDateLong(inv.paidDate || inv.issueDate)}. The payment is in your ledger.</p>}
      <div style={{ marginTop: 22 }}>
        {!confirmDel
          ? <button className="lg-btn danger full" onClick={() => setConfirmDel(true)}><Trash2 size={18} />Delete invoice</button>
          : <button className="lg-btn danger full" onClick={onDelete}>Tap again to delete {inv.number}</button>}
      </div>
    </Sheet>
  );
}

function AccountSheet({ acc, hasTx, onSave, onDelete, onClose }) {
  const [name, setName] = useState(acc ? acc.name : "");
  const [type, setType] = useState(acc ? acc.type : "bank");
  const [opening, setOpening] = useState(acc ? String(acc.opening || 0) : "0");
  const [err, setErr] = useState("");
  const save = () => {
    if (!name.trim()) return setErr("Enter an account name");
    onSave({ id: acc ? acc.id : uid(), name: name.trim(), type, opening: parseFloat(opening) || 0 });
  };
  return (
    <Sheet title={acc ? "Edit account" : "New account"} onClose={onClose}
      footer={<>
        {acc && !hasTx && <button className="lg-btn danger" onClick={onDelete}><Trash2 size={18} />Delete</button>}
        <button className="lg-btn" onClick={save}><Check size={18} />Save account</button>
      </>}>
      <Field label="Name"><input value={name} placeholder="For example, Savings" onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Type">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {Object.entries(ACC_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <Field label="Opening balance"><input inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} /></Field>
      {acc && hasTx && <p className="lg-hint">This account has entries, so it can't be deleted.</p>}
      {err && <p className="lg-err" role="alert">{err}</p>}
    </Sheet>
  );
}

function SettingsSheet({ settings, onSave, onSample, onClear, onClose }) {
  const [business, setBusiness] = useState(settings.business);
  const [currency, setCurrency] = useState(settings.currency);
  const [confirm, setConfirm] = useState(false);
  return (
    <Sheet title="Settings" onClose={onClose}
      footer={<button className="lg-btn" onClick={() => onSave({ business: business.trim() || "My Business", currency })}><Check size={18} />Save settings</button>}>
      <Field label="Business name"><input value={business} onChange={(e) => setBusiness(e.target.value)} /></Field>
      <Field label="Currency">
        <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {Object.keys(CURRENCIES).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Data">
        <button className="lg-btn ghost full" onClick={onSample}>Load sample data</button>
        <div style={{ height: 10 }} />
        {!confirm
          ? <button className="lg-btn danger full" onClick={() => setConfirm(true)}><Trash2 size={18} />Clear all data</button>
          : <button className="lg-btn danger full" onClick={onClear}>Tap again to erase everything</button>}
        <p className="lg-hint">Your books are saved on this device's app storage as you work.</p>
      </Field>
    </Sheet>
  );
}

/* ---------- app ---------- */
export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("home");
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await store.get("ledger:data");
        setData(r && r.value ? JSON.parse(r.value) : seed());
      } catch (e) { setData(seed()); }
    })();
  }, []);
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(async () => { try { await store.set("ledger:data", JSON.stringify(data)); } catch (e) { /* storage unavailable */ } }, 400);
    return () => clearTimeout(t);
  }, [data]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const cur = data ? data.settings.currency : "USD";
  const txs = useMemo(() => (data ? [...data.transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)) : []), [data]);
  const balances = useMemo(() => {
    const b = {};
    if (!data) return b;
    data.accounts.forEach((a) => { b[a.id] = a.opening || 0; });
    data.transactions.forEach((t) => {
      if (t.type === "income") b[t.accountId] = (b[t.accountId] || 0) + t.amount;
      else if (t.type === "expense") b[t.accountId] = (b[t.accountId] || 0) - t.amount;
      else { b[t.accountId] = (b[t.accountId] || 0) - t.amount; b[t.toAccountId] = (b[t.toAccountId] || 0) + t.amount; }
    });
    return b;
  }, [data]);

  if (!data) return <div className="lg"><style>{CSS}</style><div className="lg-shell"><div className="lg-load">Opening your books</div></div></div>;

  const total = data.accounts.reduce((s, a) => s + (balances[a.id] || 0), 0);
  const accName = (id) => { const a = data.accounts.find((x) => x.id === id); return a ? a.name : "Deleted account"; };
  const notify = (m) => setToast(m);
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const month = rangeStats(data.transactions, `${monthKey}-01`, `${monthKey}-31`);
  const series = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const s = rangeStats(data.transactions, `${k}-01`, `${k}-31`);
    series.push({ m: MONTHS[d.getMonth()], income: s.income, expense: s.expense });
  }
  const overdue = data.invoices.filter((i) => invStatus(i) === "overdue");

  const upsert = (key, item) => setData((d) => ({
    ...d, [key]: d[key].some((x) => x.id === item.id) ? d[key].map((x) => (x.id === item.id ? item : x)) : [...d[key], item],
  }));
  const remove = (key, id) => setData((d) => ({ ...d, [key]: d[key].filter((x) => x.id !== id) }));
  const close = () => setSheet(null);

  const nextNumber = `INV-${String(data.invoices.reduce((m, i) => Math.max(m, parseInt(i.number.replace(/\D/g, ""), 10) || 0), 0) + 1).padStart(4, "0")}`;
  const payInvoice = (inv, accountId, date) => {
    const t = invTotals(inv).total;
    setData((d) => ({
      ...d,
      invoices: d.invoices.map((i) => (i.id === inv.id ? { ...i, status: "paid", paidDate: date, accountId } : i)),
      transactions: [...d.transactions, { id: uid(), type: "income", amount: t, category: "Sales", accountId, date, note: `Payment for ${inv.number}`, invoiceId: inv.id }],
    }));
    notify("Payment recorded"); close();
  };

  const TABS = [["home", "Home", Home], ["ledger", "Ledger", BookOpen], ["invoices", "Invoices", FileText], ["reports", "Reports", PieIcon], ["accounts", "Accounts", Wallet]];
  const editingTx = sheet && sheet.k === "entry" && sheet.id ? data.transactions.find((t) => t.id === sheet.id) : null;
  const invOpen = sheet && sheet.k === "invoice" ? data.invoices.find((i) => i.id === sheet.id) : null;
  const accOpen = sheet && sheet.k === "account" && sheet.id ? data.accounts.find((a) => a.id === sheet.id) : null;

  return (
    <div className="lg">
      <style>{CSS}</style>
      <div className="lg-shell">
        {tab === "home" && <HomeScreen data={data} cur={cur} total={total} series={series} month={month} overdue={overdue}
          recent={txs.slice(0, 6)} accName={accName} go={setTab} openTx={(id) => setSheet({ k: "entry", id })} openSettings={() => setSheet({ k: "settings" })} />}
        {tab === "ledger" && <LedgerScreen txs={txs} cur={cur} accName={accName} openTx={(id) => setSheet({ k: "entry", id })} />}
        {tab === "invoices" && <InvoicesScreen invoices={data.invoices} cur={cur} openInv={(id) => setSheet({ k: "invoice", id })} newInv={() => setSheet({ k: "newinvoice" })} />}
        {tab === "reports" && <ReportsScreen data={data} cur={cur} notify={notify} />}
        {tab === "accounts" && <AccountsScreen data={data} cur={cur} balances={balances} total={total}
          openAcc={(id) => setSheet({ k: "account", id })} addAcc={() => setSheet({ k: "account" })} transfer={() => setSheet({ k: "entry", type: "transfer" })} />}

        <div className="lg-fabwrap"><button className="lg-fab" aria-label="Add entry or invoice" onClick={() => setSheet({ k: "menu" })}><Plus size={28} /></button></div>
        <nav className="lg-tabs" aria-label="Main">
          {TABS.map(([k, l, Icon]) => (
            <button key={k} className={"lg-tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)} aria-current={tab === k ? "page" : undefined}>
              <Icon size={22} />{l}
            </button>
          ))}
        </nav>

        {sheet && sheet.k === "menu" && <AddMenu onClose={close} onPick={(k) => setSheet(k === "invoice" ? { k: "newinvoice" } : { k: "entry", type: k })} />}
        {sheet && sheet.k === "entry" && (
          <EntrySheet key={sheet.id || sheet.type} data={data} cur={cur} editing={editingTx} initType={sheet.type} onClose={close}
            onSave={(t) => { upsert("transactions", t); notify("Entry saved"); close(); }}
            onDelete={(id) => { remove("transactions", id); notify("Entry deleted"); close(); }} />
        )}
        {sheet && sheet.k === "newinvoice" && (
          <InvoiceSheet cur={cur} nextNumber={nextNumber} onClose={close}
            onSave={(i) => { upsert("invoices", i); notify("Invoice saved"); setTab("invoices"); close(); }} />
        )}
        {invOpen && (
          <InvoiceDetail inv={invOpen} data={data} cur={cur} notify={notify} onClose={close}
            onSent={() => { upsert("invoices", { ...invOpen, status: "sent" }); notify("Invoice marked as sent"); close(); }}
            onPay={(accId, date) => payInvoice(invOpen, accId, date)}
            onDelete={() => { remove("invoices", invOpen.id); notify("Invoice deleted"); close(); }} />
        )}
        {sheet && sheet.k === "account" && (
          <AccountSheet key={sheet.id || "new"} acc={accOpen} hasTx={accOpen ? data.transactions.some((t) => t.accountId === accOpen.id || t.toAccountId === accOpen.id) : false}
            onClose={close} onSave={(a) => { upsert("accounts", a); notify("Account saved"); close(); }}
            onDelete={() => { remove("accounts", accOpen.id); notify("Account deleted"); close(); }} />
        )}
        {sheet && sheet.k === "settings" && (
          <SettingsSheet settings={data.settings} onClose={close}
            onSave={(s) => { setData((d) => ({ ...d, settings: s })); notify("Settings saved"); close(); }}
            onSample={() => { setData(seed()); notify("Sample data loaded"); close(); }}
            onClear={() => { setData(EMPTY()); notify("All data cleared"); close(); }} />
        )}
        {toast && <div className="lg-toast" role="status"><Check size={16} />{toast}</div>}
      </div>
    </div>
  );
}
