import { useState, useEffect } from 'react'
import { useSimpleCreditSystem, type Transaction } from '@/hooks/useSimpleCreditSystem'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  X
} from 'lucide-react'

export default function CreditSystemDemo() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [balanceLoaded, setBalanceLoaded] = useState(false)

  // Clear any invalid session data on mount
  useEffect(() => {
    const clearInvalidSession = () => {
      const savedUser = sessionStorage.getItem('supreme_user')
      if (savedUser === 'undefined' || savedUser === 'null') {
        sessionStorage.removeItem('supreme_user')
        sessionStorage.removeItem('supreme_access_token')
        sessionStorage.removeItem('supreme_refresh_token')
        console.log('Cleared invalid session data')
      }
    }
    clearInvalidSession()
  }, [])

  const {
    isAuthenticated,
    isEmbedded,
    user,
    balance,
    loading,
    error,
    login,
    logout,
    checkBalance,
    spendCredits,
    addCredits,
    getHistory
  } = useSimpleCreditSystem({
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/secure-credits/jwt',
    authUrl: import.meta.env.VITE_AUTH_URL || 'http://127.0.0.1:8000/api/jwt',
    mode: 'standalone'
  })

  // Fetch balance when authenticated
  useEffect(() => {
    if (isAuthenticated && checkBalance) {
      console.log('User is authenticated, fetching balance...')
      checkBalance().then(result => {
        console.log('Initial balance fetch result:', result)
        setBalanceLoaded(true)
      }).catch(err => {
        console.error('Failed to fetch initial balance:', err)
        setBalanceLoaded(true)
      })
    }
  }, [isAuthenticated, checkBalance])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      return
    }

    const result = await login(email, password)
    if (result.success) {
      console.log('Login successful!', result)
      // Fetch balance after a short delay to ensure tokens are set
      setTimeout(async () => {
        const balanceResult = await checkBalance()
        console.log('Balance result:', balanceResult)
        setBalanceLoaded(true)
      }, 100)
      // Clear form
      setEmail('')
      setPassword('')
    }
  }

  const handleSpendCredits = async () => {
    const amount = 10
    const result = await spendCredits(amount, 'Test spend from Lovable app')
    if (result.success) {
      console.log(`Spent ${amount} credits. New balance: ${result.balance}`)
      // Automatically refresh transaction history if it's visible
      if (showHistory) {
        await handleGetHistory()
      }
    }
  }

  const handleAddCredits = async () => {
    const amount = 50
    const result = await addCredits(amount, 'bonus', 'Test bonus credits')
    if (result.success) {
      console.log(`Added ${amount} credits. New balance: ${result.balance}`)
      // Automatically refresh transaction history if it's visible
      if (showHistory) {
        await handleGetHistory()
      }
    }
  }

  const handleGetHistory = async () => {
    const result = await getHistory(1, 10)
    if (result.success && result.history) {
      console.log('Transaction history:', result.history)
      setTransactionHistory(result.history.transactions || [])
      setShowHistory(true)
    }
  }

  // Auto-refresh history when it becomes visible
  useEffect(() => {
    if (showHistory && isAuthenticated) {
      handleGetHistory()
    }
  }, [showHistory, isAuthenticated])

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Supreme AI Credit System</h1>
        <div className="flex gap-2">
          <Badge variant={isEmbedded ? 'secondary' : 'default'}>
            Mode: {isEmbedded ? 'Embedded (iframe)' : 'Standalone'}
          </Badge>
          <Badge variant={isAuthenticated ? 'default' : 'outline'}>
            Authenticated: {isAuthenticated ? 'Yes' : 'No'}
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
              {isEmbedded ? 'Authenticating...' : 'Login to Supreme AI'}
            </CardTitle>
            <CardDescription>
              {isEmbedded ? (
                <>
                  <span className="text-xs text-muted-foreground hidden">
                    Authentication is handled by the parent application.
                  </span>
                  <br />
                  <span className="text-xs text-muted-foreground">
                    Getting credentials from Laravel session...
                  </span>
                  <br />
                  <span className="text-xs text-yellow-600 hidden">
                    Will retry every 15 seconds if not received
                  </span>
                </>
              ) : (
                'Enter your credentials to access the credit system'
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
                        type={showPassword ? 'text' : 'password'}
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
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
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
                      'Login'
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
                        sessionStorage.clear()
                        window.location.reload()
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
                    onClick={() => checkBalance()}
                    disabled={loading}
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {!balanceLoaded ? (
                    <span className="text-2xl text-muted-foreground">Loading...</span>
                  ) : (
                    `${balance} Credits`
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Operations */}
          <Card>
            <CardHeader>
              <CardTitle>Credit Operations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Button
                    onClick={handleSpendCredits}
                    disabled={loading || balance < 10}
                    variant="destructive"
                    className="w-full"
                  >
                    <Minus className="mr-2 h-4 w-4" />
                    Spend 10 Credits
                  </Button>
                  {balance < 10 && (
                    <p className="text-xs text-destructive mt-1">Insufficient balance</p>
                  )}
                </div>

                <Button
                  onClick={handleAddCredits}
                  disabled={loading}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add 50 Bonus Credits
                </Button>

                <Button
                  onClick={handleGetHistory}
                  disabled={loading}
                  variant="outline"
                  className="w-full"
                >
                  <History className="mr-2 h-4 w-4" />
                  View Transaction History
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Transaction History */}
          {showHistory && transactionHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Transaction History
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleGetHistory}
                      disabled={loading}
                    >
                      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowHistory(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
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
                        <TableCell className="text-sm">
                          {new Date(transaction.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={transaction.type === 'spend' || transaction.type === 'deduct' ? 'destructive' : 'default'}
                                 className={transaction.type === 'spend' || transaction.type === 'deduct' ? '' : 'bg-green-500 hover:bg-green-600'}>
                            {transaction.type}
                          </Badge>
                        </TableCell>
                        <TableCell className={transaction.amount < 0 ? 'text-destructive' : 'text-green-600'}>
                          {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                        </TableCell>
                        <TableCell>{transaction.balance_after || '-'}</TableCell>
                        <TableCell className="text-sm">{transaction.description || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
  )
}