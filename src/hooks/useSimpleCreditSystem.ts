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

  const apiBaseUrl = config.apiBaseUrl || 'http://127.0.0.1:8000/api/secure-credits/jwt'
  const authUrl = config.authUrl || 'http://127.0.0.1:8000/api/jwt'

  // Check if we're in an iframe (only once on mount)
  useEffect(() => {
    const inIframe = window.self !== window.top
    setIsEmbedded(inIframe)

    if (inIframe) {
      console.log('Running in embedded mode (iframe)')

      // Request JWT token from parent after a short delay
      setTimeout(() => {
        console.log('Requesting JWT token from parent...')
        window.parent.postMessage({
          type: 'REQUEST_JWT_TOKEN',
          timestamp: Date.now()
        }, '*')
      }, 500)
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

        if (event.data.token && !accessTokenRef.current) {
          accessTokenRef.current = event.data.token
          refreshTokenRef.current = event.data.refreshToken

          // Save to sessionStorage
          sessionStorage.setItem('supreme_access_token', event.data.token)
          sessionStorage.setItem('supreme_refresh_token', event.data.refreshToken)
          sessionStorage.setItem('supreme_user', JSON.stringify(event.data.user))

          setUser(event.data.user)
          setIsAuthenticated(true)

          // Notify parent that credit system is ready
          window.parent.postMessage({
            type: 'CREDIT_SYSTEM_READY',
            user: event.data.user,
            timestamp: Date.now()
          }, '*')

          toast.success(`Authenticated as ${event.data.user.email}`)
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
            console.log('Parent requested storage clear')
            sessionStorage.clear()
            accessTokenRef.current = null
            refreshTokenRef.current = null
            setIsAuthenticated(false)
            setUser(null)
            setBalance(0)
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

  // Load tokens from sessionStorage on mount (works in both modes now)
  useEffect(() => {
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
  }, [])

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