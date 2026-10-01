"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  apiGet,
  apiPatch,
  apiPost,
  apiRequestMultipart,
  authApi,
  ExpenseItem,
  FinancialSummaryData,
  FundItem,
  ProjectSummary,
  SessionUser,
  TransactionItem,
} from "@/lib/api-client";

export default function FinancePage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "funds" | "expenses" | "transactions">("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data states
  const [summary, setSummary] = useState<FinancialSummaryData | null>(null);
  const [funds, setFunds] = useState<FundItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Image upload state
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Modal states
  const [showAddFundModal, setShowAddFundModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [editFundModal, setEditFundModal] = useState<FundItem | null>(null);
  const [editExpenseModal, setEditExpenseModal] = useState<ExpenseItem | null>(null);
  const [receiptViewerUrl, setReceiptViewerUrl] = useState<string | null>(null);

  // Form states - Fund
  const [fundForm, setFundForm] = useState({
    fundCode: "",
    contributorName: "",
    contributorUserId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    purpose: "",
    paymentMethod: "CASH",
    receiptUrl: "",
    notes: "",
  });

  // Form states - Expense
  const [expenseForm, setExpenseForm] = useState({
    expenseCode: "",
    title: "",
    category: "MISCELLANEOUS",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    projectId: "",
    vendor: "",
    receiptUrl: "",
    description: "",
  });

  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.roles.some((r) => ["SUPER_ADMIN", "ADMIN"].includes(r)) || user?.permissions.includes("FINANCE_MANAGE");

  useEffect(() => {
    let active = true;
    authApi
      .me()
      .then(({ user: sessionUser }) => {
        if (active) setUser(sessionUser);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, fundRes, expRes, txRes, projRes] = await Promise.all([
        apiGet<{ data: FinancialSummaryData }>("/finance/summary"),
        apiGet<{ data: FundItem[] }>("/finance/funds"),
        apiGet<{ data: ExpenseItem[] }>("/finance/expenses"),
        apiGet<{ data: TransactionItem[] }>("/finance/transactions"),
        apiGet<{ data: ProjectSummary[] }>("/projects").catch(() => ({ data: [] })),
      ]);
      setSummary(sumRes.data || null);
      setFunds(fundRes.data || []);
      setExpenses(expRes.data || []);
      setTransactions(txRes.data || []);
      setProjects(projRes.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load financial data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showFeedback = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Auto-generate transaction code (FND001, EXP001)
  const handleAutoGenerateCode = async (type: "FUND" | "EXPENSE") => {
    try {
      const res = await apiGet<{ code: string }>(`/finance/code-generator?type=${type}`);
      if (res.code) {
        if (type === "FUND") {
          setFundForm((prev) => ({ ...prev, fundCode: res.code }));
        } else {
          setExpenseForm((prev) => ({ ...prev, expenseCode: res.code }));
        }
      }
    } catch {
      const prefix = type === "FUND" ? "FND" : "EXP";
      if (type === "FUND") {
        setFundForm((prev) => ({ ...prev, fundCode: `${prefix}001` }));
      } else {
        setExpenseForm((prev) => ({ ...prev, expenseCode: `${prefix}001` }));
      }
    }
  };

  // ImageBB Receipt Upload Handler
  const handleReceiptUpload = async (file: File, onSuccess: (url: string) => void) => {
    if (!file) return;
    setUploadingReceipt(true);
    setError(null);
    try {
      const res = await apiRequestMultipart<{ url?: string; displayUrl?: string }>("/media/images", file);
      const imageUrl = res.displayUrl || res.url || "";
      if (imageUrl) {
        onSuccess(imageUrl);
        showFeedback("Receipt uploaded & converted to ImageBB link!");
      } else {
        throw new Error("Failed to parse ImageBB URL.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload receipt to ImageBB.");
    } finally {
      setUploadingReceipt(false);
    }
  };

  // Submit Handlers
  const handleCreateFund = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiPost("/finance/funds", {
        fundCode: fundForm.fundCode.trim() || undefined,
        contributorName: fundForm.contributorName.trim(),
        contributorUserId: fundForm.contributorUserId || undefined,
        amount: Number(fundForm.amount),
        date: fundForm.date ? new Date(fundForm.date).toISOString() : new Date().toISOString(),
        purpose: fundForm.purpose.trim(),
        paymentMethod: fundForm.paymentMethod.trim() || "CASH",
        receiptUrl: fundForm.receiptUrl.trim() || undefined,
        notes: fundForm.notes.trim() || undefined,
      });
      setShowAddFundModal(false);
      setFundForm({
        fundCode: "",
        contributorName: "",
        contributorUserId: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        purpose: "",
        paymentMethod: "CASH",
        receiptUrl: "",
        notes: "",
      });
      showFeedback("Fund contribution recorded successfully!");
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to record fund contribution.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiPost("/finance/expenses", {
        expenseCode: expenseForm.expenseCode.trim() || undefined,
        title: expenseForm.title.trim(),
        category: expenseForm.category,
        amount: Number(expenseForm.amount),
        date: expenseForm.date ? new Date(expenseForm.date).toISOString() : new Date().toISOString(),
        projectId: expenseForm.projectId || undefined,
        vendor: expenseForm.vendor.trim() || undefined,
        receiptUrl: expenseForm.receiptUrl.trim() || undefined,
        description: expenseForm.description.trim() || undefined,
      });
      setShowAddExpenseModal(false);
      setExpenseForm({
        expenseCode: "",
        title: "",
        category: "MISCELLANEOUS",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        projectId: "",
        vendor: "",
        receiptUrl: "",
        description: "",
      });
      showFeedback("Expense record added successfully!");
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to record expense.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoidFund = async (id: string) => {
    if (!confirm("Are you sure you want to void/reverse this fund transaction?")) return;
    setError(null);
    try {
      await apiPatch(`/finance/funds/${id}/void`, {});
      showFeedback("Fund transaction voided.");
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to void fund transaction.");
    }
  };

  const handleVoidExpense = async (id: string) => {
    if (!confirm("Are you sure you want to void/reverse this expense transaction?")) return;
    setError(null);
    try {
      await apiPatch(`/finance/expenses/${id}/void`, {});
      showFeedback("Expense transaction voided.");
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to void expense transaction.");
    }
  };

  const formatMoney = (amount: number) => {
    return `৳${amount.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <AppShell title="Fund & Expense Management">
      {/* Top Banner */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#17211f]">Financial Operations & Fund Tracking</h1>
          <p className="mt-1 text-sm text-[#65716c]">
            Transparent monitoring of research funds, contributions, project expenditures, and current balance.
          </p>
        </div>
        {isAdmin ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setShowAddFundModal(true);
                handleAutoGenerateCode("FUND");
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#137333] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f5c29]"
            >
              + Record Contribution
            </button>
            <button
              onClick={() => {
                setShowAddExpenseModal(true);
                handleAutoGenerateCode("EXPENSE");
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#c5221f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#9e1b18]"
            >
              + Record Expense
            </button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f3f4] px-3 py-1.5 text-xs font-semibold text-[#5f6368]">
            👁️ Read-Only Mode
          </span>
        )}
      </div>

      {/* Feedback Messages */}
      {successMsg && (
        <div className="mb-6 rounded-xl border border-[#b7dfd2] bg-[#eaf4f0] p-4 text-sm font-medium text-[#176b55]">
          ✓ {successMsg}
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-[#f5c6cb] bg-[#f8d7da] p-4 text-sm font-medium text-[#721c24]">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Financial Overview Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#e9eeeb] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#89948f]">Total Fund / Income</p>
          <p className="mt-2 text-3xl font-extrabold text-[#137333]">
            {summary ? formatMoney(summary.totalFund) : "৳0.00"}
          </p>
          <p className="mt-1 text-xs text-[#65716c]">{summary?.fundCount ?? 0} total contributions</p>
        </div>

        <div className="rounded-2xl border border-[#e9eeeb] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#89948f]">Total Expense</p>
          <p className="mt-2 text-3xl font-extrabold text-[#c5221f]">
            {summary ? formatMoney(summary.totalExpense) : "৳0.00"}
          </p>
          <p className="mt-1 text-xs text-[#65716c]">{summary?.expenseCount ?? 0} total expenses</p>
        </div>

        <div className="rounded-2xl border border-[#e9eeeb] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#89948f]">Current Balance</p>
          <p
            className={`mt-2 text-3xl font-extrabold ${
              (summary?.currentBalance ?? 0) >= 0 ? "text-[#176b55]" : "text-[#c5221f]"
            }`}
          >
            {summary ? formatMoney(summary.currentBalance) : "৳0.00"}
          </p>
          <p className="mt-1 text-xs text-[#65716c]">Net available research balance</p>
        </div>

        <div className="rounded-2xl border border-[#e9eeeb] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#89948f]">Transactions Log</p>
          <p className="mt-2 text-3xl font-extrabold text-[#17211f]">
            {(summary?.fundCount ?? 0) + (summary?.expenseCount ?? 0)}
          </p>
          <p className="mt-1 text-xs text-[#65716c]">Audited financial records</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-6 flex border-b border-[#e9eeeb]">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "overview"
              ? "border-[#176b55] text-[#176b55]"
              : "border-transparent text-[#65716c] hover:text-[#17211f]"
          }`}
        >
          📊 Financial Analytics & Summary
        </button>

        <button
          onClick={() => setActiveTab("funds")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "funds"
              ? "border-[#176b55] text-[#176b55]"
              : "border-transparent text-[#65716c] hover:text-[#17211f]"
          }`}
        >
          💵 Funds & Contributions ({funds.length})
        </button>

        <button
          onClick={() => setActiveTab("expenses")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "expenses"
              ? "border-[#176b55] text-[#176b55]"
              : "border-transparent text-[#65716c] hover:text-[#17211f]"
          }`}
        >
          💳 Expenses & Purchases ({expenses.length})
        </button>

        <button
          onClick={() => setActiveTab("transactions")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === "transactions"
              ? "border-[#176b55] text-[#176b55]"
              : "border-transparent text-[#65716c] hover:text-[#17211f]"
          }`}
        >
          🧾 Transaction Timeline ({transactions.length})
        </button>
      </div>

      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Category Breakdown */}
          <div className="rounded-2xl border border-[#e9eeeb] bg-white p-6 shadow-sm">
            <h3 className="text-base font-bold text-[#17211f]">Expense Breakdown by Category</h3>
            <p className="mt-0.5 text-xs text-[#89948f]">Distribution of expenditures across categories</p>

            {summary?.categoryBreakdown && summary.categoryBreakdown.length > 0 ? (
              <div className="mt-5 space-y-4">
                {summary.categoryBreakdown.map((item) => {
                  const percent = summary.totalExpense > 0 ? (item.totalSpent / summary.totalExpense) * 100 : 0;
                  return (
                    <div key={item.category}>
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-[#50615a]">{item.category.replace(/_/g, " ")}</span>
                        <span className="text-[#17211f]">
                          {formatMoney(item.totalSpent)} ({percent.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#e2e9e5]">
                        <div className="h-full rounded-full bg-[#c5221f]" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[#89948f]">No category expense data recorded yet.</div>
            )}
          </div>

          {/* Project-wise Expense Monitoring */}
          <div className="rounded-2xl border border-[#e9eeeb] bg-white p-6 shadow-sm">
            <h3 className="text-base font-bold text-[#17211f]">Project-wise Expenditures</h3>
            <p className="mt-0.5 text-xs text-[#89948f]">Financial allocation tracked per research project</p>

            {summary?.projectExpenses && summary.projectExpenses.length > 0 ? (
              <div className="mt-5 space-y-4">
                {summary.projectExpenses.map((item) => (
                  <div
                    key={item.projectId || "general"}
                    className="flex items-center justify-between rounded-xl border border-[#e9eeeb] p-4 bg-[#f8fbf9]"
                  >
                    <div>
                      <span className="text-xs font-bold text-[#176b55]">
                        {item.project ? `${item.project.projectCode} — ${item.project.title}` : "General Lab Expenditure"}
                      </span>
                      <span className="block text-[11px] text-[#89948f]">{item.count} expense transaction(s)</span>
                    </div>
                    <span className="text-sm font-extrabold text-[#c5221f]">{formatMoney(item.totalSpent)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[#89948f]">No project-linked expenses recorded yet.</div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FUNDS & CONTRIBUTIONS */}
      {activeTab === "funds" && (
        <div className="rounded-2xl border border-[#e9eeeb] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#e9eeeb] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-[#17211f]">Fund & Contribution Records</h2>
              <p className="mt-0.5 text-xs text-[#65716c]">All recorded grants, team member contributions, and income</p>
            </div>
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search funds..."
                className="w-full rounded-xl border border-[#e9eeeb] bg-white py-2 pl-8 pr-3 text-xs transition focus:border-[#176b55] focus:outline-none"
              />
              <span className="absolute inset-y-0 left-2.5 grid place-items-center text-xs text-[#89948f]">🔍</span>
            </div>
          </div>

          {funds.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#89948f]">No fund records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8fbf9] text-[11px] uppercase tracking-wider text-[#89948f]">
                  <tr>
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Contributor</th>
                    <th className="px-5 py-3">Purpose / Note</th>
                    <th className="px-5 py-3">Method</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Status</th>
                    {isAdmin && <th className="px-5 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf3f0]">
                  {funds
                    .filter((f) => !searchQuery || f.contributorName.toLowerCase().includes(searchQuery.toLowerCase()) || f.purpose.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((fund) => (
                      <tr key={fund.id} className={fund.status === "VOIDED" ? "bg-[#fcfcfc] opacity-60" : "hover:bg-[#fcfdfc]"}>
                        <td className="px-5 py-4 font-bold text-[#50615a]">{fund.fundCode}</td>
                        <td className="px-5 py-4">
                          <span className="block font-semibold text-[#17211f]">{fund.contributorName}</span>
                          {fund.contributorUser && (
                            <span className="text-[10px] text-[#89948f]">{fund.contributorUser.memberCode}</span>
                          )}
                        </td>
                        <td className="px-5 py-4 max-w-xs">
                          <p className="font-medium text-[#17211f]">{fund.purpose}</p>
                          {fund.receiptUrl && (
                            <button
                              onClick={() => setReceiptViewerUrl(fund.receiptUrl)}
                              className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#176b55] hover:underline"
                            >
                              📷 View Receipt (ImageBB)
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-4 font-medium text-[#50615a]">{fund.paymentMethod}</td>
                        <td className="px-5 py-4 text-[#89948f]">{new Date(fund.date).toLocaleDateString()}</td>
                        <td className="px-5 py-4 font-extrabold text-[#137333]">{formatMoney(Number(fund.amount))}</td>
                        <td className="px-5 py-4">
                          {fund.status === "VALID" ? (
                            <span className="rounded-full bg-[#e6f4ea] px-2.5 py-1 text-xs font-semibold text-[#137333]">Valid</span>
                          ) : (
                            <span className="rounded-full bg-[#fce8e6] px-2.5 py-1 text-xs font-semibold text-[#c5221f]">Voided</span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-4 text-right">
                            {fund.status === "VALID" && (
                              <button
                                onClick={() => handleVoidFund(fund.id)}
                                className="rounded-lg border border-[#e9eeeb] px-2.5 py-1 font-semibold text-[#c5221f] hover:bg-[#fce8e6]"
                              >
                                Void / Reverse
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: EXPENSES & PURCHASES */}
      {activeTab === "expenses" && (
        <div className="rounded-2xl border border-[#e9eeeb] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#e9eeeb] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-[#17211f]">Expense & Purchase Records</h2>
              <p className="mt-0.5 text-xs text-[#65716c]">Track hardware, sensors, services, and operational spending</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={expenseCategoryFilter}
                onChange={(e) => setExpenseCategoryFilter(e.target.value)}
                className="rounded-xl border border-[#e9eeeb] bg-white px-3 py-2 text-xs transition focus:border-[#176b55] focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                <option value="COMPONENT_PURCHASE">Component Purchase</option>
                <option value="SENSOR">Sensor</option>
                <option value="HARDWARE">Hardware</option>
                <option value="SOFTWARE">Software</option>
                <option value="RESEARCH">Research</option>
                <option value="TRANSPORTATION">Transportation</option>
                <option value="PRINTING">Printing</option>
                <option value="EVENT">Event</option>
                <option value="SUBSCRIPTION">Subscription</option>
                <option value="MISCELLANEOUS">Miscellaneous</option>
              </select>
            </div>
          </div>

          {expenses.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#89948f]">No expense records found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8fbf9] text-[11px] uppercase tracking-wider text-[#89948f]">
                  <tr>
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Title / Vendor</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Project Link</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Status</th>
                    {isAdmin && <th className="px-5 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf3f0]">
                  {expenses
                    .filter((e) => expenseCategoryFilter === "ALL" || e.category === expenseCategoryFilter)
                    .map((exp) => (
                      <tr key={exp.id} className={exp.status === "VOIDED" ? "bg-[#fcfcfc] opacity-60" : "hover:bg-[#fcfdfc]"}>
                        <td className="px-5 py-4 font-bold text-[#50615a]">{exp.expenseCode}</td>
                        <td className="px-5 py-4">
                          <span className="block font-semibold text-[#17211f]">{exp.title}</span>
                          {exp.vendor && <span className="text-[10px] text-[#89948f]">Vendor: {exp.vendor}</span>}
                          {exp.receiptUrl && (
                            <button
                              onClick={() => setReceiptViewerUrl(exp.receiptUrl)}
                              className="mt-1 block text-[10px] font-semibold text-[#176b55] hover:underline"
                            >
                              📷 View Receipt (ImageBB)
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-4 font-medium text-[#50615a]">{exp.category.replace(/_/g, " ")}</td>
                        <td className="px-5 py-4">
                          {exp.project ? (
                            <span className="font-semibold text-[#176b55]">{exp.project.projectCode}</span>
                          ) : (
                            <span className="text-[#89948f]">General</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-[#89948f]">{new Date(exp.date).toLocaleDateString()}</td>
                        <td className="px-5 py-4 font-extrabold text-[#c5221f]">{formatMoney(Number(exp.amount))}</td>
                        <td className="px-5 py-4">
                          {exp.status === "VALID" ? (
                            <span className="rounded-full bg-[#e6f4ea] px-2.5 py-1 text-xs font-semibold text-[#137333]">Valid</span>
                          ) : (
                            <span className="rounded-full bg-[#fce8e6] px-2.5 py-1 text-xs font-semibold text-[#c5221f]">Voided</span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-4 text-right">
                            {exp.status === "VALID" && (
                              <button
                                onClick={() => handleVoidExpense(exp.id)}
                                className="rounded-lg border border-[#e9eeeb] px-2.5 py-1 font-semibold text-[#c5221f] hover:bg-[#fce8e6]"
                              >
                                Void / Reverse
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: UNIFIED TRANSACTIONS STREAM */}
      {activeTab === "transactions" && (
        <div className="rounded-2xl border border-[#e9eeeb] bg-white shadow-sm">
          <div className="border-b border-[#e9eeeb] p-5">
            <h2 className="text-base font-bold text-[#17211f]">Unified Financial Audit Trail</h2>
            <p className="mt-0.5 text-xs text-[#65716c]">Chronological list of all income contributions and expenditures</p>
          </div>

          {transactions.length === 0 ? (
            <div className="p-12 text-center text-sm text-[#89948f]">No transactions recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8fbf9] text-[11px] uppercase tracking-wider text-[#89948f]">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Title / Description</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Auditor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf3f0]">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className={tx.status === "VOIDED" ? "opacity-50 bg-[#fafafa]" : "hover:bg-[#fcfdfc]"}>
                      <td className="px-5 py-4 text-[#89948f]">{new Date(tx.date).toLocaleDateString()}</td>
                      <td className="px-5 py-4 font-bold text-[#50615a]">{tx.code}</td>
                      <td className="px-5 py-4">
                        {tx.type === "FUND" ? (
                          <span className="rounded bg-[#e6f4ea] px-2 py-0.5 text-[10px] font-bold text-[#137333]">FUND (+)</span>
                        ) : (
                          <span className="rounded bg-[#fce8e6] px-2 py-0.5 text-[10px] font-bold text-[#c5221f]">EXPENSE (-)</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="block font-semibold text-[#17211f]">{tx.title}</span>
                        {tx.projectTitle && <span className="text-[10px] text-[#176b55]">Project: {tx.projectTitle}</span>}
                      </td>
                      <td className="px-5 py-4 font-medium text-[#50615a]">{tx.category.replace(/_/g, " ")}</td>
                      <td
                        className={`px-5 py-4 font-extrabold ${
                          tx.type === "FUND" ? "text-[#137333]" : "text-[#c5221f]"
                        }`}
                      >
                        {tx.type === "FUND" ? "+" : "-"}{formatMoney(tx.amount)}
                      </td>
                      <td className="px-5 py-4 text-[#89948f]">{tx.creatorName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD FUND CONTRIBUTION (ADMIN) */}
      {showAddFundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#e9eeeb] pb-4">
              <h2 className="text-lg font-bold text-[#17211f]">Record Fund Contribution</h2>
              <button onClick={() => setShowAddFundModal(false)} className="text-xl text-[#89948f] hover:text-black">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFund} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-[#17211f]">Fund Code</label>
                    <button
                      type="button"
                      onClick={() => handleAutoGenerateCode("FUND")}
                      className="text-[11px] font-semibold text-[#176b55] hover:underline"
                    >
                      ✨ Auto
                    </button>
                  </div>
                  <input
                    type="text"
                    value={fundForm.fundCode}
                    onChange={(e) => setFundForm({ ...fundForm, fundCode: e.target.value })}
                    placeholder="e.g. FND001"
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Amount (৳ BDT) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={fundForm.amount}
                    onChange={(e) => setFundForm({ ...fundForm, amount: e.target.value })}
                    placeholder="e.g. 10000"
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Contributor Name *</label>
                  <input
                    type="text"
                    required
                    value={fundForm.contributorName}
                    onChange={(e) => setFundForm({ ...fundForm, contributorName: e.target.value })}
                    placeholder="e.g. Team Member A / Grant Name"
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Contribution Date *</label>
                  <input
                    type="date"
                    required
                    value={fundForm.date}
                    onChange={(e) => setFundForm({ ...fundForm, date: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Purpose / Reason *</label>
                  <input
                    type="text"
                    required
                    value={fundForm.purpose}
                    onChange={(e) => setFundForm({ ...fundForm, purpose: e.target.value })}
                    placeholder="e.g. Q3 Research Fund Contribution"
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Payment Method</label>
                  <input
                    type="text"
                    value={fundForm.paymentMethod}
                    onChange={(e) => setFundForm({ ...fundForm, paymentMethod: e.target.value })}
                    placeholder="e.g. Cash / Bank Transfer / bKash"
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
              </div>

              {/* IMAGEBB RECEIPT UPLOAD FIELD */}
              <div className="rounded-xl border border-dashed border-[#b7dfd2] bg-[#f8fbf9] p-4">
                <label className="block text-xs font-semibold text-[#176b55]">
                  📷 Upload Receipt / Proof of Payment (ImageBB Converter)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleReceiptUpload(file, (url) => setFundForm((prev) => ({ ...prev, receiptUrl: url })));
                    }
                  }}
                  className="mt-2 block w-full text-xs text-[#50615a] file:mr-4 file:rounded-xl file:border-0 file:bg-[#137333] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-[#0f5c29]"
                />
                {uploadingReceipt && (
                  <p className="mt-2 text-xs font-medium text-[#137333] animate-pulse">
                    ⚡ Uploading receipt to ImageBB...
                  </p>
                )}
                {fundForm.receiptUrl && (
                  <div className="mt-3 flex items-center gap-3">
                    <img src={fundForm.receiptUrl} alt="Receipt" className="size-12 rounded border object-cover bg-white" />
                    <span className="truncate text-xs font-mono text-[#137333]">{fundForm.receiptUrl}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-[#e9eeeb] pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddFundModal(false)}
                  className="rounded-xl border border-[#e9eeeb] px-4 py-2 text-sm font-semibold text-[#65716c] transition hover:bg-[#f5f7f6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingReceipt}
                  className="rounded-xl bg-[#137333] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f5c29] disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Contribution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD EXPENSE (ADMIN) */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#e9eeeb] pb-4">
              <h2 className="text-lg font-bold text-[#17211f]">Record New Expense</h2>
              <button onClick={() => setShowAddExpenseModal(false)} className="text-xl text-[#89948f] hover:text-black">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-[#17211f]">Expense Code</label>
                    <button
                      type="button"
                      onClick={() => handleAutoGenerateCode("EXPENSE")}
                      className="text-[11px] font-semibold text-[#176b55] hover:underline"
                    >
                      ✨ Auto
                    </button>
                  </div>
                  <input
                    type="text"
                    value={expenseForm.expenseCode}
                    onChange={(e) => setExpenseForm({ ...expenseForm, expenseCode: e.target.value })}
                    placeholder="e.g. EXP001"
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Amount (৳ BDT) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    placeholder="e.g. 3500"
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Expense Title *</label>
                  <input
                    type="text"
                    required
                    value={expenseForm.title}
                    onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                    placeholder="e.g. ESP32 & Sensors Purchase"
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Category *</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] bg-white p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  >
                    <option value="COMPONENT_PURCHASE">Component Purchase</option>
                    <option value="SENSOR">Sensor</option>
                    <option value="HARDWARE">Hardware</option>
                    <option value="SOFTWARE">Software</option>
                    <option value="RESEARCH">Research</option>
                    <option value="TRANSPORTATION">Transportation</option>
                    <option value="PRINTING">Printing</option>
                    <option value="EVENT">Event</option>
                    <option value="SUBSCRIPTION">Subscription</option>
                    <option value="MISCELLANEOUS">Miscellaneous</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Associated Project (Optional)</label>
                  <select
                    value={expenseForm.projectId}
                    onChange={(e) => setExpenseForm({ ...expenseForm, projectId: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] bg-white p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  >
                    <option value="">General Expenditure</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.projectCode} — {p.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#17211f]">Expense Date *</label>
                  <input
                    type="date"
                    required
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-[#e9eeeb] p-2.5 text-sm transition focus:border-[#176b55] focus:outline-none"
                  />
                </div>
              </div>

              {/* IMAGEBB RECEIPT UPLOAD FIELD */}
              <div className="rounded-xl border border-dashed border-[#f5c6cb] bg-[#fff5f5] p-4">
                <label className="block text-xs font-semibold text-[#c5221f]">
                  📷 Upload Expense Receipt / Invoice (ImageBB Converter)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleReceiptUpload(file, (url) => setExpenseForm((prev) => ({ ...prev, receiptUrl: url })));
                    }
                  }}
                  className="mt-2 block w-full text-xs text-[#50615a] file:mr-4 file:rounded-xl file:border-0 file:bg-[#c5221f] file:px-4 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-[#9e1b18]"
                />
                {uploadingReceipt && (
                  <p className="mt-2 text-xs font-medium text-[#c5221f] animate-pulse">
                    ⚡ Uploading receipt to ImageBB...
                  </p>
                )}
                {expenseForm.receiptUrl && (
                  <div className="mt-3 flex items-center gap-3">
                    <img src={expenseForm.receiptUrl} alt="Receipt" className="size-12 rounded border object-cover bg-white" />
                    <span className="truncate text-xs font-mono text-[#c5221f]">{expenseForm.receiptUrl}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-[#e9eeeb] pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="rounded-xl border border-[#e9eeeb] px-4 py-2 text-sm font-semibold text-[#65716c] transition hover:bg-[#f5f7f6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploadingReceipt}
                  className="rounded-xl bg-[#c5221f] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#9e1b18] disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECEIPT VIEWER MODAL */}
      {receiptViewerUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] max-w-3xl overflow-hidden rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex justify-end pb-2">
              <button onClick={() => setReceiptViewerUrl(null)} className="text-xl font-bold text-[#89948f] hover:text-black">
                ✕
              </button>
            </div>
            <img src={receiptViewerUrl} alt="Receipt Full View" className="max-h-[75vh] w-full object-contain rounded-xl" />
          </div>
        </div>
      )}
    </AppShell>
  );
}
