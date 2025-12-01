import { useState, useEffect, useCallback } from "react";
import { useCreditSystem, type Transaction } from "@supreme-ai/si-sdk";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CreditCard,
  LogIn,
  LogOut,
  RefreshCw,
  Plus,
  Minus,
  History,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Tag,
  AlertTriangle,
  X,
} from "lucide-react";

// Event log entry type
type LogEntry = {
  id: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
  timestamp: Date;
};

export default function CreditSystemDemo() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Transaction history with pagination
  const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const transactionsPerPage = 10;

  // Loading states
  const [balanceLoaded, setBalanceLoaded] = useState(false);
  const [historyRefreshing, setHistoryRefreshing] = useState(false);
  const [balanceRefreshing, setBalanceRefreshing] = useState(false);

  // Form states for transactions
  const [spendAmount, setSpendAmount] = useState("");
  const [spendDescription, setSpendDescription] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addDescription, setAddDescription] = useState("");

  // Credit limit error state
  const [creditLimitError, setCreditLimitError] = useState<{
    show: boolean;
    currentBalance: number;
    requested: number;
  } | null>(null);
  const MAX_CREDIT_LIMIT = 25000;

  // Insufficient balance error state
  const [insufficientBalanceError, setInsufficientBalanceError] = useState<{
    show: boolean;
    currentBalance: number;
    requested: number;
  } | null>(null);

  // Success message states
  const [spendSuccess, setSpendSuccess] = useState<{
    show: boolean;
    amount: number;
    newBalance: number;
  } | null>(null);

  const [addSuccess, setAddSuccess] = useState<{
    show: boolean;
    amount: number;
    newBalance: number;
  } | null>(null);

  // Auto-dismiss credit limit error after 3 seconds
  useEffect(() => {
    if (creditLimitError?.show) {
      const timer = setTimeout(() => {
        setCreditLimitError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [creditLimitError]);

  // Auto-dismiss insufficient balance error after 3 seconds
  useEffect(() => {
    if (insufficientBalanceError?.show) {
      const timer = setTimeout(() => {
        setInsufficientBalanceError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [insufficientBalanceError]);

  // Auto-dismiss spend success after 3 seconds
  useEffect(() => {
    if (spendSuccess?.show) {
      const timer = setTimeout(() => {
        setSpendSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [spendSuccess]);

  // Auto-dismiss add success after 3 seconds
  useEffect(() => {
    if (addSuccess?.show) {
      const timer = setTimeout(() => {
        setAddSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [addSuccess]);

  // Event logs
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Debug mode from env
  const DEBUG = import.meta.env.VITE_DEBUG === "true";

  const {
    isAuthenticated,
    mode,
    user,
    balance,
    loading,
    error,
    login,
    logout,
    checkBalance,
    spendCredits,
    addCredits,
    getHistory,
  } = useCreditSystem({
    apiBaseUrl: import.meta.env.VITE_SUPREME_AI_API_BASE_URL || "https://app.supremegroup.ai/api/secure-credits/jwt",
    authUrl: import.meta.env.VITE_SUPREME_AI_AUTH_URL || "https://app.supremegroup.ai/api/jwt",
    autoInit: true,
    debug: DEBUG,
    parentTimeout: 15000,
    tokenRefreshInterval: 600000,
    balanceRefreshInterval: 0, // Manual refresh only
    allowedOrigins: (import.meta.env.VITE_ALLOWED_PARENTS || "")
      .split(",")
      .map((domain) => domain.trim())
      .filter(Boolean),
  });

  const isEmbedded = mode === "embedded";

  // Logging utility
  const log = useCallback((message: string, type: LogEntry["type"] = "info") => {
    const logEntry: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      message,
      type,
      timestamp: new Date(),
    };
    setLogs((prev) => [...prev, logEntry]);

    if (DEBUG) {
      const timestamp = logEntry.timestamp.toLocaleTimeString();
      console.log(`[${timestamp}] ${message}`);
    }
  }, [DEBUG]);

  // Initialize logging
  useEffect(() => {
    log("🚀 Credit System initialized", "info");
    log(`📍 Running on: ${window.location.origin}`, "info");
    log(`🔧 Debug mode: ${DEBUG ? "ON" : "OFF"}`, "info");
  }, []);

  // Log mode detection
  useEffect(() => {
    if (mode) {
      log(`🔍 Mode detected: ${mode.toUpperCase()}`, "info");
    }
  }, [mode]);

  // Log authentication status changes
  useEffect(() => {
    if (isAuthenticated && user) {
      log(`✅ SDK ready in ${mode} mode! User: ${user.email}`, "success");
      // Auto-load transaction history
      loadTransactionHistory(1);
    } else if (isAuthenticated === false) {
      log("🔑 Authentication required - please login", "warning");
    }
  }, [isAuthenticated, user, mode]);

  // Log balance updates
  useEffect(() => {
    if (isAuthenticated && balance !== null) {
      setBalanceLoaded(true);
      log(`💰 Balance updated: ${balance.toLocaleString()} credits`, "info");
    } else {
      setBalanceLoaded(false);
    }
  }, [balance, isAuthenticated]);

  // Log errors
  useEffect(() => {
    if (error) {
      log(`❌ Error: ${error}`, "error");
    }
  }, [error]);

  // Load transaction history
  const loadTransactionHistory = async (page: number = 1) => {
    setHistoryRefreshing(true);
    log(`📜 Loading transaction history (page ${page})...`, "info");

    const result = await getHistory(page, transactionsPerPage);

    if (result.success && result.transactions) {
      // Sort transactions by created_at (newest first)
      const sortedTransactions = [...result.transactions].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setTransactionHistory(sortedTransactions);
      setCurrentPage(result.page || page);
      setTotalPages(result.pages || 1);
      setTotalTransactions(result.total || 0);
      log(`✅ Loaded ${result.transactions.length} transactions (page ${result.page}/${result.pages})`, "success");
    } else {
      log(`❌ Failed to load transactions: ${result.error || "Unknown error"}`, "error");
    }

    setTimeout(() => setHistoryRefreshing(false), 600);
  };

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      return;
    }

    const result = await login(email, password);
    if (result.success) {
      log(`✅ Login successful! Welcome ${result.user?.email}`, "success");
      setBalanceLoaded(false);

      // Fetch balance after a short delay
      setTimeout(async () => {
        const balanceResult = await checkBalance();
        if (balanceResult && balanceResult.success) {
          setBalanceLoaded(true);
        }
      }, 100);

      setEmail("");
      setPassword("");
    } else {
      log(`❌ Login failed: ${result.error}`, "error");
    }
  };

  // Handle logout
  const handleLogout = async () => {
    await logout();
    log("👋 Logged out successfully", "info");
    setTransactionHistory([]);
    setLogs([]);
  };

  // Handle spend credits
  const handleSpendCredits = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!spendAmount || spendAmount.trim() === "") {
      toast.error("Please enter an amount to spend");
      return;
    }

    const amount = parseInt(spendAmount);

    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid positive amount");
      return;
    }

    if (balance === null || amount > balance) {
      setInsufficientBalanceError({
        show: true,
        currentBalance: balance || 0,
        requested: amount,
      });
      return;
    }

    if (!spendDescription || spendDescription.trim() === "") {
      toast.error("Please enter a description");
      return;
    }

    const description = spendDescription.trim();

    log(`💸 Spending ${amount} credits...`, "info");
    const result = await spendCredits(amount, description);

    if (result.success) {
      log(`💸 Spent ${amount} credits. New balance: ${result.newBalance?.toLocaleString()}`, "success");
      setSpendSuccess({
        show: true,
        amount: amount,
        newBalance: result.newBalance || 0,
      });
      setSpendAmount("");
      setSpendDescription("");

      // Refresh data
      await checkBalance();
      await loadTransactionHistory(1);
    } else {
      log(`❌ Failed to spend credits: ${result.error}`, "error");
      toast.error(result.error || "Failed to spend credits");
    }
  };

  // Handle add credits
  const handleAddCredits = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!addAmount || addAmount.trim() === "") {
      toast.error("Please enter an amount to add");
      return;
    }

    const amount = parseInt(addAmount);

    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid positive amount");
      return;
    }

    if (!addDescription || addDescription.trim() === "") {
      toast.error("Please enter a description");
      return;
    }

    // Check if adding credits would exceed the maximum limit
    const currentBalance = balance || 0;
    if (currentBalance + amount > MAX_CREDIT_LIMIT) {
      setCreditLimitError({
        show: true,
        currentBalance: currentBalance,
        requested: amount,
      });
      return;
    }

    const description = addDescription.trim();

    log(`➕ Adding ${amount} credits...`, "info");
    const result = await addCredits(amount, "manual", description);

    if (result.success) {
      log(`➕ Added ${amount} credits. New balance: ${result.newBalance?.toLocaleString()}`, "success");
      setAddSuccess({
        show: true,
        amount: amount,
        newBalance: result.newBalance || 0,
      });
      setAddAmount("");
      setAddDescription("");

      // Refresh data
      await checkBalance();
      await loadTransactionHistory(1);
    } else {
      const errorMessage = result.message || result.error || "Failed to add credits";
      log(`❌ Failed to add credits: ${errorMessage}`, "error");
      toast.error(errorMessage);
    }
  };

  // Handle balance refresh
  const handleRefreshBalance = async () => {
    setBalanceRefreshing(true);
    log("📊 Checking balance...", "info");

    const result = await checkBalance();
    if (result && result.success) {
      setBalanceLoaded(true);
    }

    setTimeout(() => setBalanceRefreshing(false), 600);
  };

  // Clear logs
  const handleClearLogs = () => {
    setLogs([]);
    log("🧹 Logs cleared", "info");
  };

  // Get organization name
  const getOrganizationName = () => {
    if (!user?.organizations) return "-";
    const organizations = user.organizations as any[];
    const selectedOrg = organizations?.find((org: any) => org.selectedStatus === true);
    return selectedOrg?.name || "-";
  };

  // Get transaction type label
  const getTransactionTypeLabel = (type: string) => {
    const debitTypes = ["debit", "deduct", "spend", "spent"];
    const txType = type?.toLowerCase();

    if (debitTypes.includes(txType)) {
      return "Credit Spent";
    } else if (txType === "cancelled") {
      return "Cancelled";
    } else if (txType === "manual") {
      return "Credit Added (Manual)";
    } else if (txType === "bonus") {
      return "Bonus Credit";
    } else if (txType === "refund") {
      return "Refund Credit";
    } else {
      return "Credit Added";
    }
  };

  // Check if transaction is credit
  const isTransactionCredit = (type: string) => {
    const debitTypes = ["debit", "deduct", "spend", "spent", "cancelled"];
    return !debitTypes.includes(type?.toLowerCase());
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-indigo-600 to-emerald-500 bg-clip-text text-transparent">
          Credit System
        </h1>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={isEmbedded ? "secondary" : "default"}
            className={`text-sm ${isEmbedded ? "bg-gradient-to-r from-pink-400 to-red-400" : "bg-gradient-to-r from-indigo-500 to-purple-600"}`}
          >
            Mode: {isEmbedded ? "EMBEDDED" : "STANDALONE"}
          </Badge>
          <Badge variant={isAuthenticated ? "default" : "outline"} className="text-sm">
            {isAuthenticated ? "✅" : "❌"} {isAuthenticated ? "Authenticated" : "Not Authenticated"}
          </Badge>
        </div>
      </div>

      {/* Authentication Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-xl">🔐 Authentication Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="outline" className="text-xs">
              Initialized: {isAuthenticated !== undefined ? "✅" : "❌"}
            </Badge>
            <Badge variant="outline" className="text-xs hover:bg-transparent cursor-default">
              Authenticated: {isAuthenticated ? "✅" : "❌"}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-3 border">
              <div className="text-xs text-muted-foreground mb-1">User:</div>
              <div className="text-sm font-bold break-all">{user?.email || "-"}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border">
              <div className="text-xs text-muted-foreground mb-1">Organization:</div>
              <div className="text-sm font-bold truncate">{getOrganizationName()}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border">
              <div className="text-xs text-muted-foreground mb-1">Balance:</div>
              <div className="text-sm font-bold text-emerald-600">{balance?.toLocaleString() || 0}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isAuthenticated ? (
        <>
          {/* Embedded Mode Info */}
          {isEmbedded && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-xl">📡 Embedded Mode</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                  <p className="text-sm text-blue-900 mb-2">⏳ Waiting for authentication from parent window...</p>
                  <div className="text-xs text-blue-700">
                    <span className="font-medium">Parent Origin:</span> {import.meta.env.VITE_ALLOWED_PARENTS?.split(",")[0] || "N/A"}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Login Form (Standalone Mode) */}
          {!isEmbedded && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LogIn className="h-5 w-5" />
                  Login
                </CardTitle>
              </CardHeader>
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Logging in..." : "Login"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          )}
        </>
      ) : (
        <div className="space-y-6">
          {/* User Info and Balance */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  User Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">Welcome,</span>
                  <p className="text-lg font-semibold">{user?.name || user?.email}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">User ID:</span>
                  <p className="text-sm font-mono">{user?.id}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Credit Balance
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRefreshBalance}
                    disabled={loading || balanceRefreshing}
                  >
                    <RefreshCw className={`h-4 w-4 ${balanceRefreshing ? "animate-spin" : ""}`} />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-600">
                  {!balanceLoaded || balance === null ? (
                    <span className="text-2xl text-muted-foreground">Loading...</span>
                  ) : (
                    `${balance.toLocaleString()} Credits`
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Credit Operations */}
          <Card className="relative">
            <CardHeader>
              <CardTitle className="text-xl">💰 Credit Operations</CardTitle>
              {/* Credit Limit Error Popup */}
              {creditLimitError?.show && (
                <div className="absolute top-4 right-4 z-50 max-w-md animate-in slide-in-from-top-2 fade-in duration-300">
                  <div className="bg-red-50 border border-red-200 rounded-lg shadow-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-red-800">
                          Cannot add credits. The total balance would exceed the maximum allowed limit of {MAX_CREDIT_LIMIT.toLocaleString()} credits. Current balance: {creditLimitError.currentBalance.toLocaleString()}, Requested: {creditLimitError.requested.toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => setCreditLimitError(null)}
                        className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* Insufficient Balance Error Popup */}
              {insufficientBalanceError?.show && (
                <div className="absolute top-4 right-4 z-50 max-w-md animate-in slide-in-from-top-2 fade-in duration-300">
                  <div className="bg-red-50 border border-red-200 rounded-lg shadow-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-red-800">
                          Insufficient balance. You don't have enough credits to complete this transaction. Current balance: {insufficientBalanceError.currentBalance.toLocaleString()}, Requested: {insufficientBalanceError.requested.toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => setInsufficientBalanceError(null)}
                        className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* Spend Success Popup */}
              {spendSuccess?.show && (
                <div className="absolute top-4 right-4 z-50 max-w-md animate-in slide-in-from-top-2 fade-in duration-300">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg shadow-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-emerald-800">
                          Successfully spent {spendSuccess.amount.toLocaleString()} credits. New balance: {spendSuccess.newBalance.toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => setSpendSuccess(null)}
                        className="flex-shrink-0 text-emerald-400 hover:text-emerald-600 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* Add Success Popup */}
              {addSuccess?.show && (
                <div className="absolute top-4 right-4 z-50 max-w-md animate-in slide-in-from-top-2 fade-in duration-300">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg shadow-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-emerald-800">
                          Successfully added {addSuccess.amount.toLocaleString()} credits. New balance: {addSuccess.newBalance.toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => setAddSuccess(null)}
                        className="flex-shrink-0 text-emerald-400 hover:text-emerald-600 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Spend Credits */}
              <div className="pb-6 border-b">
                <h3 className="text-lg font-semibold mb-3">Spend Credits</h3>
                <form onSubmit={handleSpendCredits} className="space-y-3">
                  <div className="flex flex-wrap gap-3">
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={spendAmount}
                      onChange={(e) => setSpendAmount(e.target.value)}
                      min="1"
                      className="flex-1 min-w-[150px]"
                      required
                    />
                    <Input
                      type="text"
                      placeholder="Description"
                      value={spendDescription}
                      onChange={(e) => setSpendDescription(e.target.value)}
                      className="flex-1 min-w-[200px]"
                      required
                    />
                    <Button type="submit" variant="destructive" className="flex-shrink-0">
                      <Minus className="mr-2 h-4 w-4" />
                      Spend Credits
                    </Button>
                  </div>
                </form>
              </div>

              {/* Add Credits */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Add Credits</h3>
                <form onSubmit={handleAddCredits} className="space-y-3">
                  <div className="flex flex-wrap gap-3">
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                      min="1"
                      className="flex-1 min-w-[150px]"
                      required
                    />
                    <Input
                      type="text"
                      placeholder="Description"
                      value={addDescription}
                      onChange={(e) => setAddDescription(e.target.value)}
                      className="flex-1 min-w-[200px]"
                      required
                    />
                    <Button type="submit" className="flex-shrink-0 bg-emerald-600 hover:bg-emerald-700">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Credits
                    </Button>
                  </div>
                </form>
              </div>

              {/* Logout */}
              {!isEmbedded && (
                <div>
                  <Button onClick={handleLogout} disabled={loading} variant="outline" className="w-full">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transaction History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  📜 Transaction History
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => loadTransactionHistory(currentPage)}
                  disabled={loading || historyRefreshing}
                >
                  <RefreshCw className={`h-4 w-4 ${historyRefreshing ? "animate-spin" : ""}`} />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] rounded-lg border bg-gray-50 p-4">
                {transactionHistory.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg">📭 No transactions yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactionHistory.map((tx) => {
                      const isCredit = isTransactionCredit(tx.type);
                      const typeLabel = getTransactionTypeLabel(tx.type);
                      const date = new Date(tx.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      return (
                        <Card
                          key={tx.id}
                          className={`transition-shadow hover:shadow-lg border-l-4 ${
                            isCredit ? "border-l-emerald-500 bg-gradient-to-r from-emerald-50 to-white" : "border-l-red-500 bg-gradient-to-r from-red-50 to-white"
                          }`}
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start gap-4">
                              <div className="flex items-start gap-3 flex-1">
                                <div
                                  className={`w-11 h-11 rounded-lg flex items-center justify-center shadow-md ${
                                    isCredit ? "bg-gradient-to-br from-emerald-500 to-emerald-600" : "bg-gradient-to-br from-red-500 to-red-600"
                                  }`}
                                >
                                  {isCredit ? (
                                    <CheckCircle2 className="h-6 w-6 text-white" />
                                  ) : (
                                    <XCircle className="h-6 w-6 text-white" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-sm font-semibold ${isCredit ? "text-emerald-700" : "text-red-700"}`}>
                                      {typeLabel}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-700 mb-2">
                                    {tx.description || <span className="italic text-gray-400">No description provided</span>}
                                  </p>
                                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {date}
                                    </span>
                                    {tx.reference_id && (
                                      <span className="flex items-center gap-1">
                                        <Tag className="h-3 w-3" />
                                        {tx.reference_id}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className={`text-xl font-bold ${isCredit ? "text-emerald-600" : "text-red-600"}`}>
                                  {tx.type?.toLowerCase() === "cancelled" ? "" : isCredit ? "+" : "-"}
                                  {Math.abs(tx.amount).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadTransactionHistory(currentPage - 1)}
                    disabled={currentPage <= 1 || historyRefreshing}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground min-w-[150px] text-center">
                    Page {currentPage} of {totalPages} ({totalTransactions} total)
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadTransactionHistory(currentPage + 1)}
                    disabled={currentPage >= totalPages || historyRefreshing}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Event Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-xl">📋 Event Logs</span>
                <Button size="sm" variant="outline" onClick={handleClearLogs}>
                  Clear Logs
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] rounded-lg border bg-gray-50 p-4 font-mono text-sm">
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No logs yet</div>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className={`p-3 rounded border-l-4 animate-in slide-in-from-left ${
                          log.type === "success"
                            ? "bg-emerald-50 border-l-emerald-500 text-emerald-900"
                            : log.type === "error"
                            ? "bg-red-50 border-l-red-500 text-red-900"
                            : log.type === "warning"
                            ? "bg-yellow-50 border-l-yellow-500 text-yellow-900"
                            : "bg-blue-50 border-l-blue-500 text-blue-900"
                        }`}
                      >
                        <span className="text-xs text-muted-foreground mr-2">
                          [{log.timestamp.toLocaleTimeString()}]
                        </span>
                        <span dangerouslySetInnerHTML={{ __html: log.message }} />
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
