import { useEffect, useState } from "react";
import {
  Users,
  Gem,
  Wallet,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CalendarDays,
} from "lucide-react";
import "./Dashboard.scss";
import { apiFetch } from "../../../utils/api";

export default function Dashboard() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const fetchCustomers = async () => {
      try {
        const response = await apiFetch("/api/customers", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to load customers");
        }

        const data = await response.json();

        if (!data.success || !Array.isArray(data.customers)) {
          throw new Error("Invalid customer response");
        }

        setCustomers(data.customers);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError("Unable to load customer data");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchCustomers();

    return () => controller.abort();
  }, []);

  const cards = [
    {
      title: "Total Customers",
      value: loading ? "Loading..." : error ? "—" : customers.length,
      icon: Users,
      color: "gold",
      note: "Registered customers",
    },
    {
      title: "Active Pawn Loans",
      value: "—",
      icon: Gem,
      color: "red",
      note: "Awaiting loan module",
    },
    {
      title: "Today's Collection",
      value: "—",
      icon: Wallet,
      color: "gold",
      note: "Awaiting payment module",
    },
    {
      title: "Outstanding Amount",
      value: "—",
      icon: TrendingUp,
      color: "red",
      note: "Awaiting loan module",
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome to Zriolab Gold Pawning System</p>
        </div>

        <div className="date-display">
          <CalendarDays size={17} />
          {new Date().toLocaleDateString("en-LK", {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: "Asia/Colombo",
          })}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="stats-grid">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div className={`stat-card ${card.color}`} key={card.title}>
              <div className="stat-top">
                <span className="stat-icon">
                  <Icon size={21} />
                </span>
                {card.color === "gold" ? (
                  <ArrowUpRight size={18} />
                ) : (
                  <ArrowDownRight size={18} />
                )}
              </div>

              <p className="stat-title">{card.title}</p>
              <h2>{card.value}</h2>
              <span className="stat-note">{card.note}</span>
            </div>
          );
        })}
      </div>

      <div className="dashboard-charts">
        <div className="dashboard-panel">
          <div className="panel-heading">
            <h3>Monthly Collections</h3>
            <span>Current Year</span>
          </div>

          <div className="chart-placeholder">
            <TrendingUp size={38} />
            <h4>Collection Chart</h4>
            <p>
              Monthly payment data will appear here after
              the Payments Module is implemented.
            </p>
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="panel-heading">
            <h3>Loan Performance</h3>
            <span>Overview</span>
          </div>

          <div className="chart-placeholder">
            <Gem size={38} />
            <h4>Pawn Loan Analytics</h4>
            <p>
              Loan performance charts will be available
              after the Pawn Loans Module is implemented.
            </p>
          </div>
        </div>
      </div>

      <div className="dashboard-panel recent-panel">
        <div className="panel-heading">
          <h3>Recent Customers</h3>
          <span>{customers.length} Registered</span>
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
              {customers.slice(0, 5).map((customer) => (
                <tr key={customer._id}>
                  <td className="gold-text">{customer.customerCode}</td>
                  <td>{customer.fullName}</td>
                  <td>
                    {new Date(customer.createdAt).toLocaleDateString("en-LK", {
                      timeZone: "Asia/Colombo",
                    })}
                  </td>
                  <td>
                    <span className="status-active">
                      {customer.status}
                    </span>
                  </td>
                </tr>
              ))}

              {!loading && customers.length === 0 && (
                <tr>
                  <td colSpan="4" className="empty-table">
                    No customers registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
