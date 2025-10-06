import { useState, useEffect, useRef } from "react";
import { useCreditSystem, type Transaction } from "@supreme-ai/credit-sdk";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CreditCard,
  LogIn,
  LogOut,
  RefreshCw,
  Plus,
  Minus,
  History,
  User,
  AlertCircle,
  Eye,
  EyeOff,
  X,
} from "lucide-react";

export default function CreditSystemDemo() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([]);
  const [showHistory, setShowHistory] = useState(true); // Changed to true to always show
  const [retryCount, setRetryCount] = useState(0);
  const [balanceLoaded, setBalanceLoaded] = useState(false);
  const [historyRefreshing, setHistoryRefreshing] = useState(false);
  const [balanceRefreshing, setBalanceRefreshing] = useState(false);

  // Form states for custom transactions
  const [spendAmount, setSpendAmount] = useState("");
  const [spendDescription, setSpendDescription] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addType, setAddType] = useState<"bonus" | "refund" | "manual">("bonus");

  // Note: SDK manages its own storage with 'creditSystem_' prefix

  // Debug mode flag
  const DEBUG = false;

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
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/secure-credits/jwt",
    authUrl: import.meta.env.VITE_AUTH_URL || "http://127.0.0.1:8000/api/jwt",
    autoInit: true,
    debug: DEBUG,
    parentTimeout: 15000, // 15 seconds to wait for parent response (increased from 5s due to Laravel processing time)
    allowedOrigins: (import.meta.env.VITE_ALLOWED_PARENTS || "").split(',').map(domain => domain.trim()).filter(Boolean),
  });

  // Debug logging
  useEffect(() => {
    if (DEBUG) {
      console.log("[CreditSystemDemo] State:", { isAuthenticated, mode, loading, error });
    }
  }, [isAuthenticated, mode, loading, error]);

  const isEmbedded = mode === "embedded";

  // Track when balance is fetched (null means not fetched yet)
  useEffect(() => {
    if (isAuthenticated && balance !== null) {
      // Balance has been fetched (even if it's 0)
      setBalanceLoaded(true);
    } else {
      // Reset when not authenticated or balance is null
      setBalanceLoaded(false);
    }
  }, [isAuthenticated, balance]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      return;
    }

    const result = await login(email, password);
    if (result.success) {
      if (DEBUG) console.log("Login successful!", result);
      // Reset balance loaded to show loading state
      setBalanceLoaded(false);
      // Fetch balance after a short delay to ensure tokens are set
      setTimeout(async () => {
        const balanceResult = await checkBalance();
        if (DEBUG) console.log("Balance result:", balanceResult);
        // Only set loaded to true if the fetch was successful
        if (balanceResult && balanceResult.success) {
          setBalanceLoaded(true);
        }
      }, 100);
      // Clear form
      setEmail("");
      setPassword("");
    }
  };

  const handleSpendCredits = async (e?: React.FormEvent) => {
    e?.preventDefault();

    // Check if amount field is empty
    if (!spendAmount || spendAmount.trim() === "") {
      toast.error("Please enter an amount to spend");
      return;
    }

    const amount = parseInt(spendAmount);

    // Validate numeric value
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid positive amount");
      return;
    }

    if (balance === null || amount > balance) {
      toast.error("Insufficient balance");
      return;
    }

    const description = spendDescription.trim() || "Credit spend from Lovable app";

    const result = await spendCredits(amount, description);
    if (result.success) {
      if (DEBUG) console.log(`Spent ${amount} credits. New balance: ${result.newBalance}`);
      toast.success(`Successfully spent ${amount} credits`);
      setSpendAmount("");
      setSpendDescription("");
      // Immediately refresh balance
      await checkBalance();
      // Automatically refresh transaction history if it's visible
      if (showHistory) {
        await handleGetHistory();
      }
    } else if (result.error) {
      toast.error(result.error);
    }
  };

  const handleAddCredits = async (e?: React.FormEvent) => {
    e?.preventDefault();

    // Check if amount field is empty
    if (!addAmount || addAmount.trim() === "") {
      toast.error("Please enter an amount to add");
      return;
    }

    const amount = parseInt(addAmount);

    // Validate numeric value
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid positive amount");
      return;
    }

    const description = addDescription.trim() || "Credit addition from Lovable app";

    const result = await addCredits(amount, addType, description);
    if (result.success) {
      if (DEBUG) console.log(`Added ${amount} credits. New balance: ${result.newBalance}`);
      toast.success(`Successfully added ${amount} credits`);
      setAddAmount("");
      setAddDescription("");
      // Immediately refresh balance
      await checkBalance();
      // Automatically refresh transaction history if it's visible
      if (showHistory) {
        await handleGetHistory();
      }
    } else if (result.error) {
      toast.error(result.error);
    }
  };

  const handleRefreshBalance = async () => {
    setBalanceRefreshing(true);
    const result = await checkBalance();
    if (result && result.success) {
      setBalanceLoaded(true);
    }
    // Keep the animation for a moment to make it visible
    setTimeout(() => setBalanceRefreshing(false), 600);
  };

  const handleGetHistory = async () => {
    setHistoryRefreshing(true);
    const result = await getHistory(1, 10);
    if (result.success && result.transactions) {
      if (DEBUG) console.log("Transaction history:", result.transactions);
      setTransactionHistory(result.transactions || []);
      setShowHistory(true);
    }
    // Keep the animation for a moment to make it visible
    setTimeout(() => setHistoryRefreshing(false), 600);
  };

  // Auto-refresh history when it becomes visible
  useEffect(() => {
    if (showHistory && isAuthenticated) {
      handleGetHistory();
    }
  }, [showHistory, isAuthenticated]);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Supreme AI Credit System</h1>
        <div className="flex gap-2">
          <Badge variant={isEmbedded ? "secondary" : "default"}>
            Mode: {isEmbedded ? "Embedded (iframe)" : "Standalone"}
          </Badge>
          <Badge variant={isAuthenticated ? "default" : "outline"}>
            Authenticated: {isAuthenticated ? "Yes" : "No"}
          </Badge>
        </div>
      </div>

      {loading && (
        <Alert className="mb-4">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <AlertDescription>Loading...</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Error: {error}</AlertDescription>
        </Alert>
      )}

      {!isAuthenticated ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5" />
              {isEmbedded ? "Authenticating..." : "Login to Supreme AI"}
            </CardTitle>
            <CardDescription>
              {isEmbedded ? (
                <>
                  <span className="text-xs text-muted-foreground hidden">
                    Authentication is handled by the parent application.
                  </span>
                  <br />
                  <span className="text-xs text-muted-foreground">Getting credentials from Laravel session...</span>
                  <br />
                  <span className="text-xs text-yellow-600 hidden">Will retry every 15 seconds if not received</span>
                </>
              ) : (
                "Enter your credentials to access the credit system"
              )}
            </CardDescription>
          </CardHeader>

          {!isEmbedded && (
            <>
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
                      autoComplete="email"
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
                        autoComplete="current-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={loading}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Logging in...
                      </>
                    ) : (
                      "Login"
                    )}
                  </Button>

                  <div className="w-full space-y-2 text-sm text-muted-foreground hidden">
                    <p className="font-medium">Available users:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>admin@supremeopti.com</li>
                      <li>developer@supremeopti.com</li>
                      <li>supreme.developer@supremeopti.com</li>
                      <li>pranay.kosulkar@supremeopti.com</li>
                    </ul>
                    <p className="text-xs">Password: Ask your administrator</p>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        sessionStorage.clear();
                        window.location.reload();
                      }}
                      className="w-full mt-2"
                    >
                      Clear Session Data (if having issues)
                    </Button>
                  </div>
                </CardFooter>
              </form>
            </>
          )}
        </Card>
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
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Welcome,</span>
                    <p className="text-lg font-semibold">{user?.name || user?.email}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">User ID:</span>
                    <p className="text-sm font-mono">{user?.id}</p>
                  </div>
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
                    title="Refresh balance"
                  >
                    <RefreshCw
                      className="h-4 w-4"
                      style={{
                        animation: balanceRefreshing ? "spin 0.6s ease-in-out" : "none",
                        transition: "transform 0.2s",
                      }}
                    />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {!balanceLoaded || balance === null ? (
                    <span className="text-2xl text-muted-foreground">Loading...</span>
                  ) : (
                    `${balance.toLocaleString()} Credits`
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Operations */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Spend Credits Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Minus className="h-5 w-5 text-destructive" />
                  Spend Credits
                </CardTitle>
                <CardDescription>Deduct credits from your balance</CardDescription>
              </CardHeader>
              <form onSubmit={handleSpendCredits}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="spend-amount">Amount</Label>
                    <Input
                      id="spend-amount"
                      type="number"
                      placeholder="Enter amount to spend"
                      value={spendAmount}
                      onChange={(e) => setSpendAmount(e.target.value)}
                      min="1"
                      max={balance ?? undefined}
                      disabled={loading}
                    />
                    {balance === 0 && <p className="text-xs text-destructive">No credits available</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="spend-description">Description (Optional)</Label>
                    <Textarea
                      id="spend-description"
                      placeholder="What are you spending credits on?"
                      value={spendDescription}
                      onChange={(e) => setSpendDescription(e.target.value)}
                      disabled={loading}
                      rows={3}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" variant="destructive" disabled={loading || balance === 0} className="w-full">
                    {loading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Minus className="mr-2 h-4 w-4" />
                        Spend Credits
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>

            {/* Add Credits Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-green-600" />
                  Add Credits
                </CardTitle>
                <CardDescription>Add credits to your balance</CardDescription>
              </CardHeader>
              <form onSubmit={handleAddCredits}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-amount">Amount</Label>
                    <Input
                      id="add-amount"
                      type="number"
                      placeholder="Enter amount to add"
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                      min="1"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-type">Transaction Type</Label>
                    <Select value={addType} onValueChange={(value: "bonus" | "refund" | "manual") => setAddType(value)}>
                      <SelectTrigger id="add-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bonus">Bonus Credits</SelectItem>
                        <SelectItem value="refund">Refund</SelectItem>
                        <SelectItem value="manual">Manual Adjustment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-description">Description (Optional)</Label>
                    <Textarea
                      id="add-description"
                      placeholder="Reason for adding credits"
                      value={addDescription}
                      onChange={(e) => setAddDescription(e.target.value)}
                      disabled={loading}
                      rows={3}
                    />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700">
                    {loading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Credits
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>

          {/* Transaction History */}
          {showHistory && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Transaction History
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleGetHistory}
                    disabled={loading || historyRefreshing}
                    title="Refresh history"
                  >
                    <RefreshCw
                      className="h-4 w-4"
                      style={{
                        animation: historyRefreshing ? "spin 0.6s ease-in-out" : "none",
                        transition: "transform 0.2s",
                      }}
                    />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transactionHistory.length > 0 ? (
                  <Table>
                    <TableCaption>Recent credit transactions</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Description</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactionHistory.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="text-sm">{new Date(transaction.created_at).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge
                              variant={transaction.type === "debit" ? "destructive" : "default"}
                              className={transaction.type === "debit" ? "" : "bg-green-500 hover:bg-green-600"}
                            >
                              {transaction.type}
                            </Badge>
                          </TableCell>
                          <TableCell className={transaction.amount < 0 ? "text-destructive" : "text-green-600"}>
                            {transaction.amount > 0 ? "+" : ""}
                            {Math.abs(transaction.amount).toLocaleString()}
                            {transaction.amount < 0 ? "-" : ""}
                          </TableCell>
                          <TableCell>
                            {transaction.balance_after ? transaction.balance_after.toLocaleString() : "-"}
                          </TableCell>
                          <TableCell className="text-sm">{transaction.description || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No transactions yet</p>
                    <p className="text-xs mt-1">Your transaction history will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Logout */}
          <Card>
            <CardContent className="pt-6">
              <Button onClick={logout} disabled={loading} variant="outline" className="w-full">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mt-6 text-center text-sm text-muted-foreground hidden">
        Open browser console to see detailed responses
      </div>
    </div>
  );
}
