import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'

// Define types
interface User {
  id: string
  email: string
  name?: string
}

interface CreditSystemConfig {
  apiBaseUrl?: string
  authUrl?: string
  mode?: 'auto' | 'embedded' | 'standalone'
}

interface AuthResult {
  success: boolean
  error?: string
  user?: User
  tokens?: {
    access: string
    refresh: string
  }
}

interface OperationResult {
  success: boolean
  error?: string
  balance?: number
}

export interface Transaction {
  id: string | number
  type: 'spend' | 'add' | 'bonus'
  amount: number
  balance_after?: number
  description?: string
  created_at: string
}

interface HistoryResult {
  success: boolean
  error?: string
  history?: {
    data: Transaction[]
    transactions?: Transaction[]
    total: number
    current_page: number
    per_page: number
  }
}

export function useSimpleCreditSystem(config: CreditSystemConfig = {}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEmbedded, setIsEmbedded] = useState(false)

  const accessTokenRef = useRef<string | null>(null)
  const refreshTokenRef = useRef<string | null>(null)

  const apiBaseUrl = config.apiBaseUrl || import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/secure-credits/jwt'
  const authUrl = config.authUrl || import.meta.env.VITE_AUTH_URL || 'http://127.0.0.1:8000/api/jwt'

  // Retry interval reference
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef(0)

  // Check if we're in an iframe (only once on mount)
  useEffect(() => {
    const inIframe = window.self !== window.top
    setIsEmbedded(inIframe)

    if (inIframe) {
      console.log('Running in embedded mode (iframe)')

      // Clear ALL previous session data immediately
      console.log('Clearing all previous session data...')

      // Clear sessionStorage
      sessionStorage.removeItem('supreme_access_token')
      sessionStorage.removeItem('supreme_refresh_token')
      sessionStorage.removeItem('supreme_user')

      // Clear localStorage (in case anything was stored there)
      localStorage.removeItem('supreme_access_token')
      localStorage.removeItem('supreme_refresh_token')
      localStorage.removeItem('supreme_user')

      // Clear any cookies (if applicable)
      document.cookie.split(";").forEach(function(c) {
        if (c.includes('supreme')) {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
        }
      })

      // Reset all state
      accessTokenRef.current = null
      refreshTokenRef.current = null
      setIsAuthenticated(false)
      setUser(null)
      setBalance(0)
      setError(null)

      // Request JWT token from parent after clearing
      setTimeout(() => {
        console.log('Requesting fresh JWT token from parent...')
        window.parent.postMessage({
          type: 'REQUEST_JWT_TOKEN',
          timestamp: Date.now()
        }, '*')
      }, 500)

      // Set up retry mechanism - if not authenticated after 15 seconds, reload iframe
      retryIntervalRef.current = setInterval(() => {
        if (!accessTokenRef.current && retryCountRef.current < 3) {
          retryCountRef.current++
          console.log(`⚠️ JWT not received, retrying... (attempt ${retryCountRef.current}/3)`)

          // Request JWT token again
          window.parent.postMessage({
            type: 'REQUEST_JWT_TOKEN',
            timestamp: Date.now()
          }, '*')

          // If still no token after 3 attempts, request parent to reload iframe
          if (retryCountRef.current >= 3) {
            console.error('❌ Failed to receive JWT after 3 attempts, requesting iframe reload...')
            window.parent.postMessage({
              type: 'RELOAD_IFRAME_REQUEST',
              reason: 'JWT_NOT_RECEIVED',
              timestamp: Date.now()
            }, '*')
          }
        } else if (accessTokenRef.current) {
          // Token received, clear the interval
          if (retryIntervalRef.current) {
            clearInterval(retryIntervalRef.current)
            retryIntervalRef.current = null
            console.log('✅ JWT received, stopping retry mechanism')
          }
        }
      }, 15000) // Check every 15 seconds
    }

    // Cleanup
    return () => {
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current)
      }
    }
  }, []) // Empty dependency array - runs only once

  // Message handler ref to avoid circular dependency
  const checkBalanceRef = useRef<(() => Promise<OperationResult>) | null>(null)

  // Separate useEffect for message handling
  useEffect(() => {
    if (!isEmbedded) return

    const handleMessage = (event: MessageEvent) => {
      // Handle JWT token response first
      if (event.data && event.data.type === 'JWT_TOKEN_RESPONSE') {
        console.log('Received JWT token from parent:', event.data)

        if (event.data.token) {
          // First, clear everything to ensure no stale data
          console.log('Clearing old session before setting new JWT...')

          // Clear storage
          sessionStorage.clear()
          localStorage.removeItem('supreme_access_token')
          localStorage.removeItem('supreme_refresh_token')
          localStorage.removeItem('supreme_user')

          // Reset all state
          setIsAuthenticated(false)
          setUser(null)
          setBalance(0)
          setError(null)

          // Now set the new values
          accessTokenRef.current = event.data.token
          refreshTokenRef.current = event.data.refreshToken

          // Save to sessionStorage
          sessionStorage.setItem('supreme_access_token', event.data.token)
          sessionStorage.setItem('supreme_refresh_token', event.data.refreshToken)
          sessionStorage.setItem('supreme_user', JSON.stringify(event.data.user))

          setUser(event.data.user)
          setIsAuthenticated(true)

          // Clear retry mechanism since we got the token
          if (retryIntervalRef.current) {
            clearInterval(retryIntervalRef.current)
            retryIntervalRef.current = null
            retryCountRef.current = 0
            console.log('✅ JWT received, stopped retry mechanism')
          }

          // Notify parent that credit system is ready
          window.parent.postMessage({
            type: 'CREDIT_SYSTEM_READY',
            user: event.data.user,
            timestamp: Date.now()
          }, '*')

          toast.success(`Authenticated as ${event.data.user.email}`)
          console.log('✓ Fresh authentication complete for:', event.data.user.email)
        } else if (event.data.error) {
          console.error('Failed to get JWT token:', event.data.error)
          setError(event.data.error)
        }
      }

      // Handle other parent control messages
      if (event.data && event.data.type) {
        console.log('Received message from parent:', event.data.type)

        switch(event.data.type) {
          case 'REFRESH_BALANCE':
            console.log('Parent requested balance refresh')
            if (checkBalanceRef.current) {
              checkBalanceRef.current()
            }
            break
          case 'CLEAR_STORAGE':
          case 'CLEAR_SESSION':
            console.log('Parent requested session/storage clear')
            // Clear all stored authentication data
            sessionStorage.removeItem('supreme_access_token')
            sessionStorage.removeItem('supreme_refresh_token')
            sessionStorage.removeItem('supreme_user')
            localStorage.removeItem('supreme_access_token')
            localStorage.removeItem('supreme_refresh_token')
            localStorage.removeItem('supreme_user')

            // Clear refs and state
            accessTokenRef.current = null
            refreshTokenRef.current = null
            setIsAuthenticated(false)
            setUser(null)
            setBalance(0)
            setError(null)

            console.log('✓ Session cleared successfully')
            break
          case 'GET_STATUS':
            window.parent.postMessage({
              type: 'STATUS_RESPONSE',
              isAuthenticated,
              user,
              balance,
              timestamp: Date.now()
            }, '*')
            break
        }
      }
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [isEmbedded, isAuthenticated, user, balance])

  // Load tokens from sessionStorage on mount (only in standalone mode)
  useEffect(() => {
    // Skip session restoration in embedded mode - parent will provide correct user
    if (isEmbedded) {
      console.log('Embedded mode - skipping session restoration, waiting for parent')
      return
    }

    try {
      const savedAccessToken = sessionStorage.getItem('supreme_access_token')
      const savedRefreshToken = sessionStorage.getItem('supreme_refresh_token')
      const savedUser = sessionStorage.getItem('supreme_user')

      if (savedAccessToken && savedRefreshToken && savedUser && savedUser !== 'undefined') {
        accessTokenRef.current = savedAccessToken
        refreshTokenRef.current = savedRefreshToken

        try {
          const parsedUser = JSON.parse(savedUser)
          setUser(parsedUser)
          setIsAuthenticated(true)
          console.log('Restored session for user:', parsedUser)
        } catch (parseError) {
          console.error('Failed to parse saved user data:', parseError)
          sessionStorage.removeItem('supreme_user')
        }
      }
    } catch (error) {
      console.error('Error loading saved session:', error)
    }
  }, [isEmbedded])

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${authUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()
      console.log('Login response:', data)

      if (response.ok && data.success) {
        // The JWT controller returns tokens in data.data.tokens
        const { tokens, user } = data.data

        accessTokenRef.current = tokens.access_token
        refreshTokenRef.current = tokens.refresh_token

        sessionStorage.setItem('supreme_access_token', tokens.access_token)
        sessionStorage.setItem('supreme_refresh_token', tokens.refresh_token)
        sessionStorage.setItem('supreme_user', JSON.stringify(user))

        setUser(user)
        setIsAuthenticated(true)
        setLoading(false)

        toast.success('Login successful!')

        // If in embedded mode, notify parent of successful login
        if (isEmbedded && window.parent) {
          window.parent.postMessage({
            type: 'LOGIN_SUCCESS',
            user: user,
            timestamp: Date.now()
          }, '*')
        }

        return {
          success: true,
          user: user,
          tokens: {
            access: tokens.access_token,
            refresh: tokens.refresh_token
          }
        }
      } else {
        const errorMsg = data.message || 'Login failed'
        setError(errorMsg)
        setLoading(false)
        toast.error(errorMsg)
        return { success: false, error: errorMsg }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error'
      setError(errorMsg)
      setLoading(false)
      toast.error(errorMsg)
      return { success: false, error: errorMsg }
    }
  }, [authUrl, isEmbedded])

  const logout = useCallback(async () => {
    setIsAuthenticated(false)
    setUser(null)
    setBalance(0)
    accessTokenRef.current = null
    refreshTokenRef.current = null

    sessionStorage.removeItem('supreme_access_token')
    sessionStorage.removeItem('supreme_refresh_token')
    sessionStorage.removeItem('supreme_user')

    toast.success('Logged out successfully')
  }, [])

  const makeAuthenticatedRequest = useCallback(async (
    url: string,
    options: RequestInit = {}
  ) => {
    if (!accessTokenRef.current) {
      console.error('No access token available')
      throw new Error('Not authenticated')
    }

    console.log('Making authenticated request to:', url)

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessTokenRef.current}`,
        ...options.headers
      }
    })

    console.log('Response status:', response.status)

    // Handle token refresh if needed
    if (response.status === 401) {
      // Try to refresh token
      if (refreshTokenRef.current) {
        const refreshResponse = await fetch(`${authUrl}/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ refresh_token: refreshTokenRef.current })
        })

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json()
          if (refreshData.success && refreshData.data) {
            accessTokenRef.current = refreshData.data.access_token
            sessionStorage.setItem('supreme_access_token', refreshData.data.access_token)
          }

          // Retry original request
          return fetch(url, {
            ...options,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${accessTokenRef.current}`,
              ...options.headers
            }
          })
        }
      }

      // Refresh failed, logout
      await logout()
      throw new Error('Session expired')
    }

    return response
  }, [authUrl, logout])

  const checkBalance = useCallback(async (): Promise<OperationResult> => {
    try {
      console.log('Fetching balance...')
      const response = await makeAuthenticatedRequest(`${apiBaseUrl}/balance`)
      const data = await response.json()
      console.log('Balance API response:', data)

      if (response.ok && data.success) {
        // The balance is in data.data.balance
        const balanceValue = data.data?.balance || 0
        console.log('Setting balance to:', balanceValue)
        setBalance(balanceValue)

        // Notify parent if in embedded mode
        if (isEmbedded && window.parent) {
          window.parent.postMessage({
            type: 'BALANCE_UPDATE',
            balance: balanceValue,
            timestamp: Date.now()
          }, '*')
        }

        return { success: true, balance: balanceValue }
      } else {
        const errorMsg = data.message || 'Failed to fetch balance'
        console.error('Balance fetch error:', errorMsg)
        setError(errorMsg)
        toast.error(errorMsg)
        return { success: false, error: errorMsg }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error'
      console.error('Balance fetch exception:', err)
      setError(errorMsg)
      toast.error(`Failed to fetch balance: ${errorMsg}`)
      return { success: false, error: errorMsg }
    }
  }, [apiBaseUrl, makeAuthenticatedRequest, isEmbedded])

  // Update ref when checkBalance changes
  useEffect(() => {
    checkBalanceRef.current = checkBalance
  }, [checkBalance])

  const spendCredits = useCallback(async (
    amount: number,
    description?: string,
    referenceId?: string
  ): Promise<OperationResult> => {
    try {
      const response = await makeAuthenticatedRequest(`${apiBaseUrl}/spend`, {
        method: 'POST',
        body: JSON.stringify({
          amount,
          description,
          reference_id: referenceId
        })
      })

      const data = await response.json()
      console.log('Spend response:', data)

      if (response.ok && data.success) {
        const newBalance = data.data?.updated_balance || data.data?.new_balance || data.data?.balance
        setBalance(newBalance)

        // Notify parent if in embedded mode
        if (isEmbedded && window.parent) {
          window.parent.postMessage({
            type: 'CREDITS_SPENT',
            amount,
            newBalance,
            description,
            timestamp: Date.now()
          }, '*')
        }

        toast.success(`Successfully spent ${amount} credits`)
        return { success: true, balance: newBalance }
      } else {
        const errorMsg = data.message || 'Failed to spend credits'
        setError(errorMsg)
        toast.error(errorMsg)
        return { success: false, error: errorMsg }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error'
      setError(errorMsg)
      toast.error(errorMsg)
      return { success: false, error: errorMsg }
    }
  }, [apiBaseUrl, makeAuthenticatedRequest, isEmbedded])

  const addCredits = useCallback(async (
    amount: number,
    type?: string,
    description?: string
  ): Promise<OperationResult> => {
    try {
      const response = await makeAuthenticatedRequest(`${apiBaseUrl}/add`, {
        method: 'POST',
        body: JSON.stringify({
          amount,
          type: type || 'bonus',
          description
        })
      })

      const data = await response.json()
      console.log('Add credits response:', data)

      if (response.ok && data.success) {
        const newBalance = data.data?.updated_balance || data.data?.new_balance || data.data?.balance
        setBalance(newBalance)

        toast.success(`Successfully added ${amount} credits`)
        return { success: true, balance: newBalance }
      } else {
        const errorMsg = data.message || 'Failed to add credits'
        setError(errorMsg)
        toast.error(errorMsg)
        return { success: false, error: errorMsg }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error'
      setError(errorMsg)
      toast.error(errorMsg)
      return { success: false, error: errorMsg }
    }
  }, [apiBaseUrl, makeAuthenticatedRequest])

  const getHistory = useCallback(async (
    page?: number,
    limit?: number
  ): Promise<HistoryResult> => {
    try {
      const params = new URLSearchParams()
      if (page) params.append('page', page.toString())
      if (limit) params.append('limit', limit.toString())

      const response = await makeAuthenticatedRequest(
        `${apiBaseUrl}/history?${params.toString()}`
      )

      const data = await response.json()

      if (response.ok && data.success) {
        return { success: true, history: data.data }
      } else {
        const errorMsg = data.message || 'Failed to fetch history'
        setError(errorMsg)
        toast.error(errorMsg)
        return { success: false, error: errorMsg }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Network error'
      setError(errorMsg)
      toast.error(errorMsg)
      return { success: false, error: errorMsg }
    }
  }, [apiBaseUrl, makeAuthenticatedRequest])

  return {
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
  }
}