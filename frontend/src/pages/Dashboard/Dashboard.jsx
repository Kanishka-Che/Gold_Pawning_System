import { useEffect, useState } from "react";

import {
  Users,
  Gem,
  Wallet,
  Banknote,
  TrendingUp,
  CalendarDays,
  CalendarClock,
  AlertTriangle,
  RefreshCw,
  Clock,
  Coins,
  ReceiptText,
  AlertCircle,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { apiFetch } from "../../../utils/api";

import "./Dashboard.scss";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr",
  "May", "Jun", "Jul", "Aug",
  "Sep", "Oct", "Nov", "Dec",
];

const STATUS_COLORS = {
  draft: "#eab308",
  active: "#a3112b",
  redeemed: "#16834b",
  closed: "#64748b",
  cancelled: "#f97316",
  unknown: "#94a3b8",
};

const CLASSIFICATION_COLORS = {
  current: "#16834b",
  due_today: "#eab308",
  upcoming_due: "#d97706",
  grace_period: "#f97316",
  overdue: "#dc2626",
  unclassified: "#64748b",
};

const getCurrentYear = () =>
  Number(
    new Intl.DateTimeFormat("en", {
      year: "numeric",
      timeZone: "Asia/Colombo",
    }).format(new Date())
  );

const formatMoney = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return "—";
  }

  return `LKR ${amount.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (value, includeTime = false) => {
  if (!value) return "—";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(includeTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }
      : {}),
  });
};

const formatStatus = (value) =>
  String(value ?? "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );

const fetchDashboardData = async (path, signal) => {
  const response = await apiFetch(path, { signal });

  const data = await response.json();

  if (!response.ok || data.success !== true) {
    throw new Error(
      data.message || "Unable to load dashboard data"
    );
  }

  return data;
};

function StatCard({
  title,
  value,
  icon: Icon,
  note,
  color = "red",
}) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-top">
        <span className="stat-title">{title}</span>

        <span className="stat-icon">
          <Icon size={20} />
        </span>
      </div>

      <h2>{value ?? "—"}</h2>

      <span className="stat-note">{note}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const allowed = [
    "active",
    "inactive",
    "draft",
    "redeemed",
    "closed",
    "cancelled",
    "payment",
    "renewal",
    "redemption",
  ];

  const safeStatus = allowed.includes(status)
    ? status
    : "unknown";

  return (
    <span className={`dashboard-status ${safeStatus}`}>
      {formatStatus(status)}
    </span>
  );
}

function EmptyRow({ columns, message }) {
  return (
    <tr>
      <td colSpan={columns} className="empty-table">
        {message}
      </td>
    </tr>
  );
}

function DonutChart({ data, total, label }) {
  const chartData = data.filter(
    (item) => item.value > 0
  );

  if (chartData.length === 0) {
    return (
      <div className="chart-empty">
        <Gem size={32} />
        <p>No loan records available.</p>
      </div>
    );
  }

  return (
    <div className="donut-layout">
      <div className="donut-chart">
        <ResponsiveContainer width="100%" height={230}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="85%"
              paddingAngle={2}
              isAnimationActive={false}
            >
              {chartData.map((item) => (
                <Cell
                  key={item.name}
                  fill={item.color}
                />
              ))}
            </Pie>

            <Tooltip />
          </PieChart>
        </ResponsiveContainer>

        <div className="donut-center">
          <strong>{total}</strong>
          <span>{label}</span>
        </div>
      </div>

      <div className="donut-legend">
        {data.map((item) => (
          <div
            className="donut-legend-row"
            key={item.name}
          >
            <span
              className="legend-dot"
              style={{ background: item.color }}
            />

            <span>{item.name}</span>

            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const currentYear = getCurrentYear();

  const [year, setYear] = useState(currentYear);

  const [summary, setSummary] = useState(null);
  const [loanStatus, setLoanStatus] = useState(null);
  const [activity, setActivity] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);

  const [calculationDate, setCalculationDate] =
    useState(null);

  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] =
    useState(true);

  const [error, setError] = useState("");
  const [chartError, setChartError] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  // Main dashboard data.
  useEffect(() => {
    const controller = new AbortController();

    const loadDashboard = async () => {
      setLoading(true);
      setError("");

      setSummary(null);
      setLoanStatus(null);
      setActivity(null);
      setCalculationDate(null);

      try {
        const [
          summaryData,
          statusData,
          activityData,
        ] = await Promise.all([
          fetchDashboardData(
            "/api/dashboard/summary",
            controller.signal
          ),

          fetchDashboardData(
            "/api/dashboard/loan-status",
            controller.signal
          ),

          fetchDashboardData(
            "/api/dashboard/recent-activity",
            controller.signal
          ),
        ]);

        if (
          !summaryData.summary ||
          !statusData.statusCounts ||
          !Array.isArray(activityData.recentCustomers) ||
          !Array.isArray(activityData.recentLoans) ||
          !Array.isArray(activityData.recentTransactions)
        ) {
          throw new Error("Invalid dashboard response");
        }

        if (controller.signal.aborted) return;

        setSummary(summaryData.summary);
        setLoanStatus(statusData);
        setActivity(activityData);

        setCalculationDate(
          summaryData.calculationDate
        );
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err.message || "Unable to load dashboard"
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => controller.abort();
  }, [reloadKey]);

  // Year-based financial chart.
  useEffect(() => {
    const controller = new AbortController();

    const loadFinancialOverview = async () => {
      setChartLoading(true);
      setChartError("");
      setMonthlyData([]);

      try {
        const data = await fetchDashboardData(
          `/api/dashboard/financial-overview?year=${year}`,
          controller.signal
        );

        if (
          !Array.isArray(data.monthlyData) ||
          data.monthlyData.length !== 12 ||
          data.year !== year
        ) {
          throw new Error(
            "Invalid financial overview response"
          );
        }

        const amountFields = [
          "issuedPrincipal",
          "principalReceived",
          "interestReceived",
          "renewalFees",
          "penaltiesReceived",
          "totalCollections",
        ];

        const normalized = data.monthlyData.map(
          (item, index) => {
            if (item.month !== index + 1) {
              throw new Error("Invalid chart month");
            }

            const result = {
              month: MONTHS[item.month - 1],
            };

            for (const field of amountFields) {
              const value = item[field];

              if (
                typeof value !== "string" ||
                !/^\d+\.\d{2}$/.test(value) ||
                !Number.isFinite(Number(value))
              ) {
                throw new Error(
                  "Invalid financial chart amount"
                );
              }

              result[field] = Number(value);
            }

            return result;
          }
        );

        if (!controller.signal.aborted) {
          setMonthlyData(normalized);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setChartError(
            err.message ||
              "Unable to load financial overview"
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setChartLoading(false);
        }
      }
    };

    loadFinancialOverview();

    return () => controller.abort();
  }, [year, reloadKey]);

  const refreshDashboard = () => {
    setReloadKey((previous) => previous + 1);
  };

  const displayValue = (value) =>
    loading ? "Loading..." : value ?? "—";

  const cards = [
    {
      title: "Total Customers",
      value: displayValue(summary?.totalCustomers),
      icon: Users,
      color: "gold",
      note: summary
        ? `${summary.activeCustomers} active · ${summary.inactiveCustomers} inactive`
        : "Registered customers",
    },
    {
      title: "Active Pawn Loans",
      value: displayValue(summary?.activeLoans),
      icon: Wallet,
      color: "red",
      note: "Currently active pawn loans",
    },
    {
      title: "Pledged Gold Items",
      value: displayValue(summary?.pledgedGoldItems),
      icon: Gem,
      color: "gold",
      note: "Currently pledged items",
    },
    {
      title: "Outstanding Principal",
      value: displayValue(
        formatMoney(summary?.outstandingPrincipal)
      ),
      icon: Banknote,
      color: "red",
      note: "Excludes interest and penalties",
    },
    {
      title: "Today's Collections",
      value: displayValue(
        formatMoney(summary?.today?.totalCollections)
      ),
      icon: Coins,
      color: "green",
      note: "Recorded financial receipts",
    },
    {
      title: "Today's Loan Issues",
      value: displayValue(
        formatMoney(summary?.todayIssuedPrincipal)
      ),
      icon: TrendingUp,
      color: "gold",
      note: summary
        ? `${summary.todayNewLoans} loans activated today`
        : "Principal issued today",
    },
    {
      title: "This Month's Collections",
      value: displayValue(
        formatMoney(summary?.month?.totalCollections)
      ),
      icon: ReceiptText,
      color: "green",
      note: "Current month to date",
    },
    {
      title: "Overdue Principal",
      value: displayValue(
        formatMoney(summary?.overduePrincipal)
      ),
      icon: AlertTriangle,
      color: "red",
      note: "Overdue outstanding principal",
    },
  ];

  const loanChartData = Object.entries(
    loanStatus?.statusCounts ?? {}
  ).map(([status, value]) => ({
    name: formatStatus(status),
    value,
    color: STATUS_COLORS[status] || "#94a3b8",
  }));

  const classificationData = [
    {
      key: "current",
      name: "Current",
      value: summary?.currentLoans,
    },
    {
      key: "due_today",
      name: "Due Today",
      value: summary?.dueToday,
    },
    {
      key: "upcoming_due",
      name: "Upcoming Due",
      value: summary?.upcomingDue,
    },
    {
      key: "grace_period",
      name: "Grace Period",
      value: summary?.gracePeriod,
    },
    {
      key: "overdue",
      name: "Overdue",
      value: summary?.overdueLoans,
    },
    {
      key: "unclassified",
      name: "Unclassified",
      value: summary?.unclassifiedLoans,
    },
  ].map((item) => ({
    ...item,
    color: CLASSIFICATION_COLORS[item.key],
  }));

  const yearOptions = Array.from(
    { length: currentYear - 2000 + 1 },
    (_, index) => currentYear - index
  );

  const financialBreakdown = [
    {
      title: "Principal Received",
      key: "principalReceived",
    },
    {
      title: "Interest Received",
      key: "interestReceived",
    },
    {
      title: "Renewal Fees",
      key: "renewalFees",
    },
    {
      title: "Penalties Received",
      key: "penaltiesReceived",
    },
    {
      title: "Total Collections",
      key: "totalCollections",
    },
  ];

  return (
    <div className="dashboard-page">
      <header className="page-heading">
        <div>
          <h1>Dashboard</h1>
          <p>
            Welcome to Zriolab Gold Pawning System
          </p>
        </div>

        <div className="dashboard-heading-actions">
          <div className="date-display">
            <CalendarDays size={17} />

            {formatDate(
              calculationDate || new Date()
            )}
          </div>

          <button
            type="button"
            className="dashboard-refresh"
            onClick={refreshDashboard}
            disabled={loading || chartLoading}
          >
            <RefreshCw
              size={16}
              className={
                loading || chartLoading
                  ? "dashboard-spin"
                  : ""
              }
            />

            Refresh
          </button>
        </div>
      </header>

      <div className="dashboard-notice">
        <AlertCircle size={18} />

        <div>
          <strong>Read-only Financial Overview</strong>

          <p>
            Collections include recorded principal,
            interest, renewal fees and penalties.
            Principal received is not profit.
            Outstanding principal excludes accrued
            interest and penalties.
          </p>
        </div>
      </div>

      {error && (
        <div className="error-message" role="alert">
          <AlertCircle size={17} />
          {error}
        </div>
      )}

      {summary &&
        (
          !summary.isPrincipalTotalComplete ||
          !summary.isOverduePrincipalComplete
        ) && (
          <div
            className="error-message"
            role="alert"
          >
            Some loan balances or classifications
            could not be verified. Incomplete
            principal totals are not displayed.
          </div>
        )}

      <div className="stats-grid">
        {cards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      <div className="dashboard-panel">
        <div className="panel-heading">
          <h3>
            <CalendarClock size={19} />
            Loan Maturity Monitoring
          </h3>

          <span>Active loans only</span>
        </div>

        <div className="classification-grid">
          {classificationData.map((item) => (
            <div
              className="classification-card"
              key={item.key}
              style={{
                borderLeftColor: item.color,
              }}
            >
              <span>{item.name}</span>

              <strong style={{ color: item.color }}>
                {displayValue(item.value)}
              </strong>

              {item.key === "upcoming_due" && (
                <small>Next 7 days</small>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-panel financial-panel">
        <div className="panel-heading">
          <div>
            <h3>
              <TrendingUp size={19} />
              Monthly Financial Overview
            </h3>

            <p>
              Issued principal and recorded collections
            </p>
          </div>

          <div className="dashboard-year-filter">
            <label htmlFor="dashboard-year">
              Year
            </label>

            <select
              id="dashboard-year"
              value={year}
              onChange={(event) =>
                setYear(Number(event.target.value))
              }
            >
              {yearOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        {chartLoading ? (
          <div className="chart-empty">
            Loading financial overview...
          </div>
        ) : chartError ? (
          <div className="error-message" role="alert">
            {chartError}
          </div>
        ) : (
          <div className="financial-chart">
            <ResponsiveContainer
              width="100%"
              height={320}
            >
              <BarChart
                data={monthlyData}
                margin={{
                  top: 15,
                  right: 15,
                  left: 15,
                  bottom: 5,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e5e7eb"
                />

                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12 }}
                />

                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) =>
                    Number(value).toLocaleString(
                      "en-LK",
                      {
                        notation: "compact",
                      }
                    )
                  }
                />

                <Tooltip
                  formatter={(value) =>
                    formatMoney(value)
                  }
                />

                <Legend />

                <Bar
                  dataKey="issuedPrincipal"
                  name="Issued Principal"
                  fill="#a3112b"
                  radius={[5, 5, 0, 0]}
                  isAnimationActive={false}
                />

                <Bar
                  dataKey="totalCollections"
                  name="Total Collections"
                  fill="#e5b525"
                  radius={[5, 5, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="dashboard-charts">
        <div className="dashboard-panel">
          <div className="panel-heading">
            <h3>
              <Wallet size={19} />
              Loan Status Analytics
            </h3>

            <span>All pawn loans</span>
          </div>

          {loading ? (
            <div className="chart-empty">
              Loading loan analytics...
            </div>
          ) : loanStatus ? (
            <DonutChart
              data={loanChartData}
              total={loanStatus.totalLoans}
              label="Total Loans"
            />
          ) : (
            <div className="chart-empty">
              Loan analytics unavailable.
            </div>
          )}
        </div>

        <div className="dashboard-panel">
          <div className="panel-heading">
            <h3>
              <Coins size={19} />
              Collection Breakdown
            </h3>
          </div>

          <div className="table-wrapper">
            <table className="data-table breakdown-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Today</th>
                  <th>This Month</th>
                </tr>
              </thead>

              <tbody>
                {financialBreakdown.map((item) => (
                  <tr
                    key={item.key}
                    className={
                      item.key === "totalCollections"
                        ? "total-row"
                        : ""
                    }
                  >
                    <td>{item.title}</td>

                    <td>
                      {formatMoney(
                        summary?.today?.[item.key]
                      )}
                    </td>

                    <td>
                      {formatMoney(
                        summary?.month?.[item.key]
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="dashboard-panel-note">
            Recorded transactions only. This is not
            a profit and loss statement.
          </p>
        </div>
      </div>

      <div className="dashboard-panel">
        <div className="panel-heading">
          <h3>
            <Users size={19} />
            Recent Customers
          </h3>

          <span>Latest 5 customers</span>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer Code</th>
                <th>Full Name</th>
                <th>Registered Date</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {(activity?.recentCustomers ?? []).map(
                (customer) => (
                  <tr key={customer._id}>
                    <td className="dashboard-code">
                      {customer.customerCode}
                    </td>

                    <td>{customer.fullName}</td>

                    <td>
                      {formatDate(customer.createdAt)}
                    </td>

                    <td>
                      <StatusBadge
                        status={customer.status}
                      />
                    </td>
                  </tr>
                )
              )}

              {!activity?.recentCustomers?.length && (
                <EmptyRow
                  columns={4}
                  message={
                    loading
                      ? "Loading customers..."
                      : error
                        ? "Customer data unavailable."
                        : "No customers registered."
                  }
                />
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dashboard-panel">
        <div className="panel-heading">
          <h3>
            <Gem size={19} />
            Recent Pawn Loans
          </h3>

          <span>Latest 5 activated loans</span>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Loan Number</th>
                <th>Customer</th>
                <th>Principal Amount</th>
                <th>Activated Date</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {(activity?.recentLoans ?? []).map(
                (loan) => (
                  <tr key={loan._id}>
                    <td className="dashboard-code">
                      {loan.loanNumber}
                    </td>

                    <td>
                      {loan.customer?.fullName || "—"}

                      <small className="customer-code">
                        {loan.customer?.customerCode}
                      </small>
                    </td>

                    <td>
                      {formatMoney(loan.principalAmount)}
                    </td>

                    <td>
                      {formatDate(
                        loan.activatedAt,
                        true
                      )}
                    </td>

                    <td>
                      <StatusBadge status={loan.status} />
                    </td>
                  </tr>
                )
              )}

              {!activity?.recentLoans?.length && (
                <EmptyRow
                  columns={5}
                  message={
                    loading
                      ? "Loading pawn loans..."
                      : error
                        ? "Loan data unavailable."
                        : "No activated pawn loans."
                  }
                />
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dashboard-panel">
        <div className="panel-heading">
          <h3>
            <ReceiptText size={19} />
            Recent Financial Transactions
          </h3>

          <span>Latest 10 recorded transactions</span>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Type</th>
                <th>Loan Number</th>
                <th>Customer</th>
                <th>Principal</th>
                <th>Interest</th>
                <th>Fees</th>
                <th>Penalty</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {(activity?.recentTransactions ?? []).map(
                (transaction) => (
                  <tr
                    key={`${transaction.type}-${transaction.id}`}
                  >
                    <td>
                      {formatDate(
                        transaction.transactionDate,
                        true
                      )}
                    </td>

                    <td>
                      <StatusBadge
                        status={transaction.type}
                      />
                    </td>

                    <td className="dashboard-code">
                      {transaction.loanNumber || "—"}
                    </td>

                    <td>
                      {transaction.customer?.fullName ||
                        "—"}
                    </td>

                    <td>
                      {formatMoney(transaction.principal)}
                    </td>

                    <td>
                      {formatMoney(transaction.interest)}
                    </td>

                    <td>
                      {formatMoney(transaction.fee)}
                    </td>

                    <td>
                      {formatMoney(transaction.penalty)}
                    </td>

                    <td className="transaction-total">
                      {formatMoney(transaction.amount)}
                    </td>
                  </tr>
                )
              )}

              {!activity?.recentTransactions?.length && (
                <EmptyRow
                  columns={9}
                  message={
                    loading
                      ? "Loading transactions..."
                      : error
                        ? "Transaction data unavailable."
                        : "No financial transactions recorded yet."
                  }
                />
              )}
            </tbody>
          </table>
        </div>
      </div>

      {calculationDate && (
        <div className="dashboard-footer">
          <Clock size={14} />

          Summary calculated at:{" "}
          {formatDate(calculationDate, true)}

          {" · Sri Lanka Time"}
        </div>
      )}
    </div>
  );
}