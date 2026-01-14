import { useState, useEffect, useCallback } from "react";
import { useCreditSystem } from "@supreme-ai/si-sdk";
import type { Transaction, HistoryResult, BalanceResult, SpendResult, AddResult } from "@supreme-ai/si-sdk";
import { toast } from "sonner";

// Local type definitions for Agent (not exported from SDK)
type Agent = {
  id: number;
  name: string;
  description?: string;
  short_desc?: string;
  assistant_id?: string;
  is_default?: boolean;
  grant_type?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
};

type RoleGroupedAgents = {
  [roleId: string]: {
    role_name: string;
    agents: Agent[];
  };
};

type AgentsResult = {
  success: boolean;
  error?: string;
  agents?: Agent[];
  roleGrouped?: RoleGroupedAgents;
  total?: number;
};

// API configuration
const API_BASE_URL = import.meta.env.VITE_SUPREME_AI_API_BASE_URL || "https://app.supremegroup.ai/api/secure-credits/jwt";
const AUTH_URL = import.meta.env.VITE_SUPREME_AI_AUTH_URL || "https://app.supremegroup.ai/api/jwt";

// User type for standalone mode
type StandaloneUser = {
  id: number;
  name: string;
  email: string;
  organizations: { id: number; name: string }[];
};
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Building2,
  Bot,
} from "lucide-react";

// Event log entry type
type LogEntry = {
  id: string;
  message: string;
  type: "info" | "success" | "error" | "warning";
  timestamp: Date;
};

// Organization type for standalone mode
type Organization = {
  id: number;
  name: string;
  isSelected: boolean;
};

export default function CreditSystemDemo() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Standalone mode state
  const [standaloneMode, setStandaloneMode] = useState(false);
  const [standaloneUser, setStandaloneUser] = useState<StandaloneUser | null>(null);
  const [standaloneBalance, setStandaloneBalance] = useState<number | null>(null);
  const [standaloneLoading, setStandaloneLoading] = useState(false);
  const [standaloneAuthenticated, setStandaloneAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Organizations state for standalone mode
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  // Transaction history with pagination
  const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const transactionsPerPage = 10;

  // AI Agents state
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([]);
  // Role-grouped agents: { roleId: { role_name: string, agents: Agent[] } }
  const [roleGroupedAgents, setRoleGroupedAgents] = useState<Record<string, { role_name: string; agents: Agent[] }>>({});
  const [agentsLoading, setAgentsLoading] = useState(false);

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
    getAgents,
  } = useCreditSystem({
    apiBaseUrl: import.meta.env.VITE_SUPREME_AI_API_BASE_URL || "https://app.supremegroup.ai/api/secure-credits/jwt",
    authUrl: import.meta.env.VITE_SUPREME_AI_AUTH_URL || "https://app.supremegroup.ai/api/jwt",
    autoInit: true,
    debug: DEBUG,
    parentTimeout: 15000,
    tokenRefreshInterval: 600000,
    balanceRefreshInterval: 0,
    allowedOrigins: (import.meta.env.VITE_ALLOWED_PARENTS || "")
      .split(",")
      .map((domain) => domain.trim())
      .filter(Boolean),
  });

  const isEmbedded = mode === "embedded";

  // Storage key for standalone auth
  const STANDALONE_AUTH_KEY = "standalone_auth";

  // Save standalone auth to sessionStorage
  const saveStandaloneAuth = (token: string, user: StandaloneUser, orgs: Organization[]) => {
    try {
      sessionStorage.setItem(STANDALONE_AUTH_KEY, JSON.stringify({ token, user, organizations: orgs }));
    } catch (err) {
      console.error("Failed to save standalone auth:", err);
    }
  };

  // Clear standalone auth from sessionStorage
  const clearStandaloneAuth = () => {
    try {
      sessionStorage.removeItem(STANDALONE_AUTH_KEY);
    } catch (err) {
      console.error("Failed to clear standalone auth:", err);
    }
  };

  // Restore standalone auth from sessionStorage
  const restoreStandaloneAuth = async () => {
    try {
      const stored = sessionStorage.getItem(STANDALONE_AUTH_KEY);
      if (stored) {
        const { token, user, organizations: orgs } = JSON.parse(stored);
        if (token && user) {
          setAccessToken(token);
          setStandaloneUser(user);
          setStandaloneAuthenticated(true);
          if (orgs && Array.isArray(orgs)) {
            setOrganizations(orgs);
          }
          log("🔄 Session restored", "info");

          // Fetch balance for the selected organization
          const selectedOrg = orgs?.find((org: Organization) => org.isSelected);
          if (selectedOrg) {
            const balanceResult = await standaloneCheckBalance(selectedOrg.id, token);
            if (balanceResult.success) {
              setBalanceLoaded(true);
            }
            // Load transaction history
            await loadTransactionHistory(1, selectedOrg.id, token);
            // Load AI agents
            await loadAgents(selectedOrg.id, user?.userRoleIds || user?.user_role_ids, token);
          }
          return true;
        }
      }
    } catch (err) {
      console.error("Failed to restore standalone auth:", err);
    }
    return false;
  };

  // Detect standalone mode on mount (not in iframe) and restore session
  useEffect(() => {
    const inIframe = window !== window.parent;
    setStandaloneMode(!inIframe);
    if (!inIframe) {
      log("🖥️ Running in standalone mode", "info");
      // Restore session after a small delay to ensure state is ready
      setTimeout(() => {
        restoreStandaloneAuth();
      }, 100);
    }
  }, []);

  // Helper function to make authenticated API requests (standalone mode)
  const apiRequest = async (endpoint: string, options: RequestInit = {}, token?: string) => {
    const authToken = token || accessToken;
    if (!authToken) {
      return { success: false, error: "No access token" };
    }
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          "Authorization": `Bearer ${authToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
          ...options.headers,
        },
      });
      const data = await response.json();
      return { success: response.ok && data.success, data: data.data, message: data.message, error: data.message };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Standalone mode: Login
  const standaloneLogin = async (email: string, password: string) => {
    setStandaloneLoading(true);
    try {
      const response = await fetch(`${AUTH_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (response.ok && data.success && data.data) {
        const { user: userData, tokens } = data.data;
        setAccessToken(tokens.access_token);
        setStandaloneUser(userData);
        setStandaloneAuthenticated(true);

        // Set organizations
        let orgsWithSelection: Organization[] = [];
        if (userData.organizations && Array.isArray(userData.organizations)) {
          orgsWithSelection = userData.organizations.map(
            (org: { id: number; name: string }, index: number) => ({
              id: org.id,
              name: org.name,
              isSelected: index === 0,
            })
          );
          setOrganizations(orgsWithSelection);
        }

        // Save to sessionStorage for persistence across page refresh
        saveStandaloneAuth(tokens.access_token, userData, orgsWithSelection);

        setStandaloneLoading(false);
        return { success: true, user: userData, tokens };
      } else {
        setStandaloneLoading(false);
        return { success: false, error: data.message || "Login failed" };
      }
    } catch (err: any) {
      setStandaloneLoading(false);
      return { success: false, error: err.message || "Network error" };
    }
  };

  // Standalone mode: Logout
  const standaloneLogout = async () => {
    setAccessToken(null);
    setStandaloneUser(null);
    setStandaloneBalance(null);
    setStandaloneAuthenticated(false);
    setOrganizations([]);
    setTransactionHistory([]);
    clearStandaloneAuth();
  };

  // Standalone mode: Check Balance
  const standaloneCheckBalance = async (orgId?: number, token?: string) => {
    const organizationId = orgId ?? getSelectedOrganization()?.id;
    if (!organizationId) {
      return { success: false, error: "No organization selected" };
    }

    const result = await apiRequest(`/balance?organization_id=${organizationId}`, {}, token);
    if (result.success && result.data) {
      setStandaloneBalance(result.data.balance);
      return { success: true, balance: result.data.balance };
    }
    return result;
  };

  // Standalone mode: Spend Credits
  const standaloneSpendCredits = async (amount: number, description: string, orgId?: number) => {
    const organizationId = orgId ?? getSelectedOrganization()?.id;
    if (!organizationId) {
      return { success: false, error: "No organization selected" };
    }

    const result = await apiRequest("/spend", {
      method: "POST",
      body: JSON.stringify({
        organization_id: organizationId,
        amount,
        description,
      }),
    });

    if (result.success) {
      const newBalance = result.data?.new_balance ?? result.data?.balance ?? ((standaloneBalance ?? 0) - amount);
      setStandaloneBalance(newBalance);
      return { success: true, newBalance };
    }
    return result;
  };

  // Standalone mode: Add Credits
  const standaloneAddCredits = async (amount: number, type: string, description: string, orgId?: number) => {
    const organizationId = orgId ?? getSelectedOrganization()?.id;
    if (!organizationId) {
      return { success: false, error: "No organization selected" };
    }

    const result = await apiRequest("/add", {
      method: "POST",
      body: JSON.stringify({
        organization_id: organizationId,
        amount,
        type,
        description,
      }),
    });

    if (result.success) {
      const newBalance = result.data?.new_balance ?? result.data?.balance ?? ((standaloneBalance ?? 0) + amount);
      setStandaloneBalance(newBalance);
      return { success: true, newBalance };
    }
    return result;
  };

  // Standalone mode: Get History
  const standaloneGetHistory = async (page: number, limit: number, orgId?: number, token?: string) => {
    const organizationId = orgId ?? getSelectedOrganization()?.id;
    if (!organizationId) {
      return { success: false, error: "No organization selected" };
    }

    const offset = (page - 1) * limit;
    const result = await apiRequest(`/history?organization_id=${organizationId}&limit=${limit}&offset=${offset}`, {}, token);

    if (result.success && result.data) {
      const pagination = result.data.pagination || {};
      const total = pagination.total || 0;
      const totalPages = Math.ceil(total / limit);
      const transactions = (result.data.transactions || []).map((tx: any) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        description: tx.description || "",
        reference_id: tx.reference_id,
        created_at: tx.created_at,
        balance_after: tx.balance_after || 0,
        user_id: tx.user_id,
      }));

      return { success: true, transactions, total, page, pages: totalPages };
    }
    return result;
  };

  // Standalone mode: Get AI Agents
  const standaloneGetAgents = async (all: boolean = false, orgId?: number, roleIds?: number[], token?: string) => {
    const organizationId = orgId ?? getSelectedOrganization()?.id;
    if (!organizationId) {
      return { success: false, error: "No organization selected", agents: [], roleGrouped: {} };
    }

    let queryParams = `organization_id=${organizationId}`;
    if (all) {
      queryParams += "&all=true";
    } else if (roleIds && roleIds.length > 0) {
      queryParams += `&role_ids=${roleIds.join(",")}`;
    }

    const result = await apiRequest(`/ai-agents?${queryParams}`, {}, token);

    if (DEBUG) {
      console.log("[standaloneGetAgents] API Response:", result);
    }

    if (result.success && result.data) {
      // Handle various response structures
      let agents: any[] = [];
      let roleGrouped: Record<string, { role_name: string; agents: any[] }> = {};

      // Debug: Log the structure we received
      console.log("[standaloneGetAgents] result.data structure:", {
        isArray: Array.isArray(result.data),
        hasAgents: !!result.data.agents,
        agentsType: result.data.agents ? typeof result.data.agents : "undefined",
        agentsIsArray: Array.isArray(result.data.agents),
        agentsKeys: result.data.agents && typeof result.data.agents === "object" ? Object.keys(result.data.agents) : []
      });

      if (Array.isArray(result.data)) {
        agents = result.data;
      } else if (result.data.agents) {
        // Handle nested agents structure: { agents: { all: [...] } } or { agents: { "2": { role_name: "CEO", agents: [...] } } }
        // Note: Admin/superadmin users get "all" format even without passing all=true
        if (Array.isArray(result.data.agents.all)) {
          // Agents are under "all" key (admin/superadmin response or all=true)
          agents = result.data.agents.all;
        } else if (Array.isArray(result.data.agents)) {
          // Direct array: { agents: [...] }
          agents = result.data.agents;
        } else if (typeof result.data.agents === "object" && !Array.isArray(result.data.agents)) {
          // For role-specific or default (no all=true), agents are under role ID keys with role_name and agents array
          // Format: { agents: { "2": { role_name: "CEO", agents: [...] }, "3": { role_name: "Manager", agents: [...] } } }
          const agentObj = result.data.agents;
          const keys = Object.keys(agentObj);
          console.log("[standaloneGetAgents] Processing role keys:", keys);

          keys.forEach((roleId) => {
            // Skip "all" key which is for all=true response
            if (roleId === "all") return;

            const roleData = agentObj[roleId];
            console.log(`[standaloneGetAgents] Role ${roleId}:`, {
              hasRoleName: !!roleData?.role_name,
              roleName: roleData?.role_name,
              hasAgents: !!roleData?.agents,
              agentsCount: roleData?.agents?.length
            });

            if (roleData && typeof roleData === "object") {
              // Check if it's the new format with role_name and agents
              if (roleData.role_name && Array.isArray(roleData.agents)) {
                roleGrouped[roleId] = {
                  role_name: roleData.role_name,
                  agents: roleData.agents
                };
                agents = agents.concat(roleData.agents);
              } else if (Array.isArray(roleData)) {
                // Old format: direct array under role ID
                agents = agents.concat(roleData);
              }
            }
          });
        }
      } else if (Array.isArray(result.data.data)) {
        agents = result.data.data;
      }

      console.log("[standaloneGetAgents] Final result:", {
        agentsCount: agents.length,
        roleGroupedKeys: Object.keys(roleGrouped),
        roleGroupedCount: Object.keys(roleGrouped).length
      });

      return { success: true, agents, total: agents.length, roleGrouped };
    }
    return { ...result, agents: [], roleGrouped: {} };
  };

  // Helper function to set organization in cookie (for SDK to read - embedded mode only)
  const setOrganizationCookie = (orgId: string | number) => {
    const cookieValue = String(orgId);
    document.cookie = `user-selected-org-id=${cookieValue}; path=/; max-age=31536000`;
  };

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
      // Auto-load AI agents
      loadAgents();
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
  const loadTransactionHistory = async (page: number = 1, organizationId?: number, token?: string) => {
    setHistoryRefreshing(true);
    log(`📜 Loading transaction history (page ${page})...`, "info");

    // Standalone mode: use direct API
    if (standaloneMode && (standaloneAuthenticated || token)) {
      const result = await standaloneGetHistory(page, transactionsPerPage, organizationId, token);
      if (result.success && 'transactions' in result && result.transactions) {
        const sortedTransactions = [...result.transactions].sort((a: Transaction, b: Transaction) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setTransactionHistory(sortedTransactions);
        setCurrentPage('page' in result ? result.page : page);
        setTotalPages('pages' in result ? result.pages : 1);
        setTotalTransactions('total' in result ? result.total : 0);
        log(`✅ Loaded ${result.transactions.length} transactions (page ${'page' in result ? result.page : page}/${'pages' in result ? result.pages : 1})`, "success");
      } else {
        log(`❌ Failed to load transactions: ${'error' in result ? result.error : "Unknown error"}`, "error");
      }
      setTimeout(() => setHistoryRefreshing(false), 600);
      return;
    }

    // Embedded mode: use SDK
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

  // Load AI Agents (both all and filtered)
  const loadAgents = async (organizationId?: number, roleIds?: number[], token?: string) => {
    setAgentsLoading(true);
    log("🤖 Loading AI agents...", "info");

    // Standalone mode: use direct API
    if (standaloneMode && (standaloneAuthenticated || token)) {
      // Get user role IDs from session storage if not provided
      let userRoleIds = roleIds;
      if (!userRoleIds) {
        try {
          const stored = sessionStorage.getItem(STANDALONE_AUTH_KEY);
          if (stored) {
            const { user } = JSON.parse(stored);
            // Try to get role IDs from user data
            userRoleIds = user?.userRoleIds || user?.user_role_ids || [];
          }
        } catch (err) {
          console.error("Failed to get role IDs:", err);
        }
      }

      // Fetch all agents
      const allResult = await standaloneGetAgents(true, organizationId, undefined, token);
      if (allResult.success && 'agents' in allResult && allResult.agents) {
        const agents = Array.isArray(allResult.agents) ? allResult.agents : [];
        setAllAgents(agents);
        log(`✅ Loaded ${agents.length} total agents (all=true)`, "success");
      } else {
        setAllAgents([]);
        log(`❌ Failed to load all agents: ${'error' in allResult ? allResult.error : "Unknown error"}`, "error");
      }

      // Fetch filtered agents (by role IDs or without all=true to get user's role agents)
      // If we have role IDs, use them; otherwise just call without all=true to get role-based agents
      const filteredResult = await standaloneGetAgents(false, organizationId, userRoleIds && userRoleIds.length > 0 ? userRoleIds : undefined, token);
      if (filteredResult.success && 'agents' in filteredResult && filteredResult.agents) {
        const agents = Array.isArray(filteredResult.agents) ? filteredResult.agents : [];
        setFilteredAgents(agents);
        // Store role-grouped agents if available
        if ('roleGrouped' in filteredResult && filteredResult.roleGrouped && Object.keys(filteredResult.roleGrouped).length > 0) {
          setRoleGroupedAgents(filteredResult.roleGrouped as Record<string, { role_name: string; agents: Agent[] }>);
          const roleCount = Object.keys(filteredResult.roleGrouped).length;
          log(`✅ Loaded ${agents.length} filtered agents across ${roleCount} roles`, "success");
        } else {
          setRoleGroupedAgents({});
          log(`✅ Loaded ${agents.length} filtered agents`, "success");
        }
      } else {
        setFilteredAgents([]);
        setRoleGroupedAgents({});
        log(`❌ Failed to load filtered agents: ${'error' in filteredResult ? filteredResult.error : "Unknown error"}`, "error");
      }

      setAgentsLoading(false);
      return;
    }

    // Embedded mode: use SDK
    // Fetch all agents
    const allResult = await getAgents(true);
    if (allResult.success && allResult.agents) {
      const agents = Array.isArray(allResult.agents) ? allResult.agents : [];
      setAllAgents(agents);
      log(`✅ Loaded ${agents.length} total agents (all=true)`, "success");
    } else {
      setAllAgents([]);
      log(`❌ Failed to load all agents: ${allResult.error || "Unknown error"}`, "error");
    }

    // Fetch filtered agents - SDK now returns roleGrouped data
    const filteredResult = await getAgents(false);
    console.log("[loadAgents] SDK filteredResult:", filteredResult);

    if (filteredResult.success) {
      const agents = Array.isArray(filteredResult.agents) ? filteredResult.agents : [];
      setFilteredAgents(agents);

      // SDK now returns roleGrouped directly
      if (filteredResult.roleGrouped && Object.keys(filteredResult.roleGrouped).length > 0) {
        setRoleGroupedAgents(filteredResult.roleGrouped as Record<string, { role_name: string; agents: Agent[] }>);
        const roleCount = Object.keys(filteredResult.roleGrouped).length;
        log(`✅ Loaded ${agents.length} filtered agents across ${roleCount} roles`, "success");
      } else {
        setRoleGroupedAgents({});
        log(`✅ Loaded ${agents.length} filtered agents (by role IDs)`, "success");
      }
    } else {
      setFilteredAgents([]);
      setRoleGroupedAgents({});
      log(`❌ Failed to load filtered agents: ${filteredResult.error || "Unknown error"}`, "error");
    }

    setAgentsLoading(false);
  };

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      return;
    }

    // Standalone mode: use direct API
    if (standaloneMode) {
      const result = await standaloneLogin(email, password);
      if (result.success) {
        log(`✅ Login successful! Welcome ${result.user?.email}`, "success");
        log(`🔑 Access token stored`, "info");
        log(`🏢 Loaded ${result.user?.organizations?.length || 0} organizations`, "info");

        setEmail("");
        setPassword("");

        // Fetch balance after login - pass token directly since state may not be updated yet
        const firstOrgId = result.user?.organizations?.[0]?.id;
        const token = result.tokens?.access_token;
        if (firstOrgId && token) {
          const balanceResult = await standaloneCheckBalance(firstOrgId, token);
          if (balanceResult.success && 'balance' in balanceResult) {
            setBalanceLoaded(true);
            log(`💰 Balance: ${balanceResult.balance?.toLocaleString()} credits`, "info");
          }
          // Load transaction history
          await loadTransactionHistory(1, firstOrgId, token);
          // Load AI agents
          await loadAgents(firstOrgId, result.user?.userRoleIds || result.user?.user_role_ids, token);
        }
      } else {
        log(`❌ Login failed: ${result.error}`, "error");
        toast.error(result.error || "Login failed");
      }
      return;
    }

    // Embedded mode: use SDK
    const result = await login(email, password);
    if (result.success) {
      log(`✅ Login successful! Welcome ${result.user?.email}`, "success");
      setBalanceLoaded(false);

      // Store organizations with isSelected property (first one selected by default)
      if (result.user?.organizations && Array.isArray(result.user.organizations)) {
        const orgsWithSelection: Organization[] = result.user.organizations.map(
          (org, index) => ({
            id: typeof org.id === 'string' ? parseInt(org.id, 10) : (org.id as number) || 0,
            name: org.name || '',
            isSelected: index === 0,
          })
        );
        setOrganizations(orgsWithSelection);
        log(`🏢 Loaded ${orgsWithSelection.length} organizations. Selected: ${orgsWithSelection[0]?.name}`, "info");
      }

      // Set organization cookie for SDK
      const firstOrgId = result.user?.organizations?.[0]?.id;
      if (firstOrgId) {
        setOrganizationCookie(firstOrgId);
        log(`🏢 Set organization: ${firstOrgId}`, "info");
      }

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

  // Handle organization change
  const handleOrganizationChange = async (orgId: string) => {
    const selectedId = parseInt(orgId);
    const updatedOrgs = organizations.map((org) => ({
      ...org,
      isSelected: org.id === selectedId,
    }));
    setOrganizations(updatedOrgs);

    const selectedOrg = organizations.find((org) => org.id === selectedId);
    if (selectedOrg) {
      log(`🏢 Switching organization to: ${selectedOrg.name}...`, "info");

      // Clear transaction history immediately
      setTransactionHistory([]);
      setCurrentPage(1);
      setTotalPages(1);
      setTotalTransactions(0);

      // Standalone mode: use direct API calls
      if (standaloneMode && standaloneAuthenticated) {
        log(`✅ Organization switched to: ${selectedOrg.name}`, "success");

        // Update sessionStorage with new organization selection
        if (accessToken && standaloneUser) {
          saveStandaloneAuth(accessToken, standaloneUser, updatedOrgs);
        }

        // Refresh balance and history for the new organization
        setBalanceLoaded(false);
        const balanceResult = await standaloneCheckBalance(selectedId);
        if (balanceResult.success) {
          setBalanceLoaded(true);
        }
        await loadTransactionHistory(1, selectedId);
        // Reload agents for the new organization
        await loadAgents(selectedId);
        return;
      }

      // Embedded mode: use SDK with cookie
      setOrganizationCookie(orgId);
      log(`✅ Organization switched to: ${selectedOrg.name}`, "success");

      // Refresh balance and history for the new organization
      setBalanceLoaded(false);
      await checkBalance();
      setBalanceLoaded(true);
      // Pass the organization ID directly to avoid stale state
      await loadTransactionHistory(1, selectedId);
      // Reload agents for the new organization
      await loadAgents();
    }
  };

  // Get currently selected organization
  const getSelectedOrganization = (): Organization | undefined => {
    // For standalone mode, use local organizations state
    if (organizations.length > 0) {
      return organizations.find((org) => org.isSelected);
    }
    // For embedded mode, get from user object
    if (user?.organizations && Array.isArray(user.organizations)) {
      const userOrgs = user.organizations as any[];
      const selectedOrg = userOrgs.find((org: any) => org.selectedStatus === true);
      if (selectedOrg) {
        return { id: selectedOrg.id, name: selectedOrg.name, isSelected: true };
      }
      // If no selectedStatus, return first org
      if (userOrgs.length > 0) {
        return { id: userOrgs[0].id, name: userOrgs[0].name, isSelected: true };
      }
    }
    return undefined;
  };

  // Handle logout
  const handleLogout = async () => {
    // Standalone mode: use direct logout
    if (standaloneMode) {
      await standaloneLogout();
      log("👋 Logged out successfully", "info");
      setTransactionHistory([]);
      setLogs([]);
      setBalanceLoaded(false);
      return;
    }

    // Embedded mode: use SDK
    await logout();
    log("👋 Logged out successfully", "info");
    setTransactionHistory([]);
    setOrganizations([]);
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

    // Use appropriate balance based on mode
    const currentBalance = standaloneMode ? standaloneBalance : balance;
    if (currentBalance === null || amount > currentBalance) {
      setInsufficientBalanceError({
        show: true,
        currentBalance: currentBalance || 0,
        requested: amount,
      });
      return;
    }

    if (!spendDescription || spendDescription.trim() === "") {
      toast.error("Please enter a description");
      return;
    }

    const description = spendDescription.trim();
    const selectedOrg = getSelectedOrganization();

    log(`💸 Spending ${amount} credits${selectedOrg ? ` for ${selectedOrg.name}` : ""}...`, "info");

    // Standalone mode: use direct API call
    if (standaloneMode && standaloneAuthenticated) {
      if (!selectedOrg) {
        log(`❌ No organization selected`, "error");
        toast.error("No organization selected. Please select an organization.");
        return;
      }

      const result = await standaloneSpendCredits(amount, description, selectedOrg.id);

      if (result.success && 'newBalance' in result) {
        log(`💸 Spent ${amount} credits. New balance: ${result.newBalance?.toLocaleString()}`, "success");
        setSpendSuccess({
          show: true,
          amount: amount,
          newBalance: result.newBalance || 0,
        });
        setSpendAmount("");
        setSpendDescription("");
        setBalanceLoaded(true);

        // Refresh history
        await loadTransactionHistory(1, selectedOrg.id);
      } else {
        const errorMsg = 'error' in result ? result.error : "Unknown error";
        log(`❌ Failed to spend credits: ${errorMsg}`, "error");
        toast.error(errorMsg || "Failed to spend credits");
      }
      return;
    }

    // Embedded mode: use SDK
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

    // Use appropriate balance based on mode
    const currentBalance = standaloneMode ? (standaloneBalance || 0) : (balance || 0);
    if (currentBalance + amount > MAX_CREDIT_LIMIT) {
      setCreditLimitError({
        show: true,
        currentBalance: currentBalance,
        requested: amount,
      });
      return;
    }

    const description = addDescription.trim();
    const selectedOrg = getSelectedOrganization();

    log(`➕ Adding ${amount} credits${selectedOrg ? ` for ${selectedOrg.name}` : ""}...`, "info");

    // Standalone mode: use direct API call
    if (standaloneMode && standaloneAuthenticated) {
      if (!selectedOrg) {
        log(`❌ No organization selected`, "error");
        toast.error("No organization selected. Please select an organization.");
        return;
      }

      const result = await standaloneAddCredits(amount, "manual", description, selectedOrg.id);

      if (result.success && 'newBalance' in result) {
        log(`➕ Added ${amount} credits. New balance: ${result.newBalance?.toLocaleString()}`, "success");
        setAddSuccess({
          show: true,
          amount: amount,
          newBalance: result.newBalance || 0,
        });
        setAddAmount("");
        setAddDescription("");
        setBalanceLoaded(true);

        // Refresh history
        await loadTransactionHistory(1, selectedOrg.id);
      } else {
        const errorMsg = 'error' in result ? result.error : "Unknown error";
        log(`❌ Failed to add credits: ${errorMsg}`, "error");
        toast.error(errorMsg || "Failed to add credits");
      }
      return;
    }

    // Embedded mode: use SDK
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
      const errorMessage = result.error || "Failed to add credits";
      log(`❌ Failed to add credits: ${errorMessage}`, "error");
      toast.error(errorMessage);
    }
  };

  // Handle balance refresh
  const handleRefreshBalance = async () => {
    setBalanceRefreshing(true);
    log("📊 Checking balance...", "info");

    // Standalone mode: use direct API
    if (standaloneMode && standaloneAuthenticated) {
      const result = await standaloneCheckBalance();
      if (result.success && 'balance' in result) {
        setBalanceLoaded(true);
        log(`💰 Balance: ${result.balance?.toLocaleString()} credits`, "info");
      } else {
        const errorMsg = 'error' in result ? result.error : "Unknown error";
        log(`❌ Failed to check balance: ${errorMsg}`, "error");
      }
      setTimeout(() => setBalanceRefreshing(false), 600);
      return;
    }

    // Embedded mode: use SDK
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
    // For standalone mode, use local organizations state
    if (organizations.length > 0) {
      const selectedOrg = organizations.find((org) => org.isSelected);
      return selectedOrg?.name || "-";
    }
    // For embedded mode, use user.organizations with selectedStatus
    if (!user?.organizations) return "-";
    const userOrgs = user.organizations as any[];
    const selectedOrg = userOrgs?.find((org: any) => org.selectedStatus === true);
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

  // Computed values based on mode (standalone vs embedded)
  const effectiveIsAuthenticated = standaloneMode ? standaloneAuthenticated : isAuthenticated;
  const effectiveUser = standaloneMode ? standaloneUser : user;
  const effectiveBalance = standaloneMode ? standaloneBalance : balance;
  const effectiveLoading = standaloneMode ? standaloneLoading : loading;

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
          <Badge variant={effectiveIsAuthenticated ? "default" : "outline"} className="text-sm">
            {effectiveIsAuthenticated ? "✅" : "❌"} {effectiveIsAuthenticated ? "Authenticated" : "Not Authenticated"}
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
              Initialized: {effectiveIsAuthenticated !== undefined ? "✅" : "❌"}
            </Badge>
            <Badge variant="outline" className="text-xs hover:bg-transparent cursor-default">
              Authenticated: {effectiveIsAuthenticated ? "✅" : "❌"}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-3 border">
              <div className="text-xs text-muted-foreground mb-1">User:</div>
              <div className="text-sm font-bold break-all">{effectiveUser?.email || "-"}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border">
              <div className="text-xs text-muted-foreground mb-1">Organization:</div>
              <div className="text-sm font-bold truncate">{getOrganizationName()}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border">
              <div className="text-xs text-muted-foreground mb-1">Balance:</div>
              <div className="text-sm font-bold text-emerald-600">{effectiveBalance?.toLocaleString() || 0}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!effectiveIsAuthenticated ? (
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
                      disabled={effectiveLoading}
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
                        disabled={effectiveLoading}
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
                  <Button type="submit" disabled={effectiveLoading} className="w-auto px-8">
                    {effectiveLoading ? "Logging in..." : "Login"}
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
              <CardContent className="space-y-4">
                <div>
                  <span className="text-sm text-muted-foreground">Welcome,</span>
                  <p className="text-lg font-semibold">{effectiveUser?.name || effectiveUser?.email}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">User ID:</span>
                  <p className="text-sm font-mono">{effectiveUser?.id}</p>
                </div>
                {/* Organization Selector for Standalone Mode */}
                {!isEmbedded && organizations.length > 0 && (
                  <div>
                    <Label className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                      <Building2 className="h-4 w-4" />
                      Organization
                    </Label>
                    <Select
                      value={getSelectedOrganization()?.id.toString()}
                      onValueChange={handleOrganizationChange}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id.toString()}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
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
                    disabled={effectiveLoading || balanceRefreshing}
                  >
                    <RefreshCw className={`h-4 w-4 ${balanceRefreshing ? "animate-spin" : ""}`} />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-600">
                  {!balanceLoaded || effectiveBalance == null ? (
                    <span className="text-2xl text-muted-foreground">Loading...</span>
                  ) : (
                    `${effectiveBalance.toLocaleString()} Credits`
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
                  <Button onClick={handleLogout} disabled={effectiveLoading} className="w-auto px-8 bg-red-500 hover:bg-red-600 text-white">
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
                  disabled={effectiveLoading || historyRefreshing}
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

          {/* AI Agents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  🤖 AI Agents
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => loadAgents()}
                  disabled={agentsLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${agentsLoading ? "animate-spin" : ""}`} />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                {/* All Agents (with all=true) */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">all=true</Badge>
                    All Organization Agents
                  </h3>
                  <ScrollArea className="h-[300px] rounded-lg border bg-gray-50 p-4">
                    {agentsLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
                        <p>Loading agents...</p>
                      </div>
                    ) : allAgents.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Bot className="h-12 w-12 mx-auto mb-2 opacity-30" />
                        <p>No agents found</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {allAgents.map((agent) => (
                          <div
                            key={agent.id}
                            className="p-3 bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                                <Bot className="h-5 w-5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 truncate">{agent.name}</p>
                                {agent.description && (
                                  <p className="text-sm text-gray-500 line-clamp-2">{agent.description}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">ID: {agent.id}</Badge>
                                  {agent.status && (
                                    <Badge variant={agent.status === "active" ? "default" : "secondary"} className="text-xs">
                                      {agent.status}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground mt-2">
                    Total: {allAgents.length} agents
                  </p>
                </div>

                {/* Filtered Agents (by role IDs) - Grouped by Role */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">role_ids</Badge>
                    Your Role's Agents
                  </h3>
                  <ScrollArea className="h-[300px] rounded-lg border bg-gray-50 p-4">
                    {agentsLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
                        <p>Loading agents...</p>
                      </div>
                    ) : filteredAgents.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Bot className="h-12 w-12 mx-auto mb-2 opacity-30" />
                        <p>No agents found for your roles</p>
                      </div>
                    ) : Object.keys(roleGroupedAgents).length > 0 ? (
                      // Display agents grouped by role
                      <div className="space-y-4">
                        {Object.entries(roleGroupedAgents).map(([roleId, roleData]) => (
                          <div key={roleId} className="space-y-2">
                            {/* Role Header */}
                            <div className="sticky top-0 bg-gray-100 p-2 rounded-lg border-l-4 border-emerald-500 z-10">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs bg-white">Role ID: {roleId}</Badge>
                                <span className="font-semibold text-emerald-800">{roleData.role_name}</span>
                                <Badge variant="secondary" className="text-xs ml-auto">
                                  {roleData.agents.length} agent{roleData.agents.length !== 1 ? 's' : ''}
                                </Badge>
                              </div>
                            </div>
                            {/* Agents under this role */}
                            <div className="space-y-2 pl-2">
                              {roleData.agents.map((agent) => (
                                <div
                                  key={agent.id}
                                  className="p-3 bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                                      <Bot className="h-5 w-5 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold text-gray-900 truncate">{agent.name}</p>
                                      {(agent.short_desc || agent.description) && (
                                        <p className="text-sm text-gray-500 line-clamp-2">{agent.short_desc || agent.description}</p>
                                      )}
                                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <Badge variant="outline" className="text-xs">ID: {agent.id}</Badge>
                                        {agent.grant_type && (
                                          <Badge variant="secondary" className="text-xs">{agent.grant_type}</Badge>
                                        )}
                                        {agent.is_default && (
                                          <Badge className="text-xs bg-amber-100 text-amber-800">Default</Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      // Fallback to flat list if role-grouped data is not available
                      <div className="space-y-2">
                        {filteredAgents.map((agent) => (
                          <div
                            key={agent.id}
                            className="p-3 bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                                <Bot className="h-5 w-5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 truncate">{agent.name}</p>
                                {agent.description && (
                                  <p className="text-sm text-gray-500 line-clamp-2">{agent.description}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">ID: {agent.id}</Badge>
                                  {agent.status && (
                                    <Badge variant={agent.status === "active" ? "default" : "secondary"} className="text-xs">
                                      {agent.status}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground mt-2">
                    Total: {filteredAgents.length} agents
                    {Object.keys(roleGroupedAgents).length > 0 && ` across ${Object.keys(roleGroupedAgents).length} role(s)`}
                  </p>
                </div>
              </div>
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
