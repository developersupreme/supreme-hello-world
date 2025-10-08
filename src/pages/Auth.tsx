import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield, Mail, Lock, Loader2 } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"standalone" | "embedded">("standalone");
  const { toast } = useToast();
  const navigate = useNavigate();

  // Debug mode flag - controlled via VITE_DEV_MODE env variable
  const DEBUG = import.meta.env.VITE_DEV_MODE === 'true';

  // Detect embedded mode and handle auto-login
  useEffect(() => {
    const isInIframe = window.self !== window.top;

    if (DEBUG) {
      console.log('[Auth DEBUG] Starting Auth component');
      console.log('[Auth DEBUG] Is in iframe:', isInIframe);
    }

    if (isInIframe) {
      setMode("embedded");
      setLoading(true);

      if (DEBUG) {
        console.log('[Auth DEBUG] Entering embedded mode');
      }

      const allowedOrigins = (import.meta.env.VITE_ALLOWED_PARENTS || "")
        .split(",")
        .map((domain) => domain.trim())
        .filter(Boolean);

      if (DEBUG) {
        console.log('[Auth DEBUG] Allowed origins:', allowedOrigins);
      }

      const handleMessage = (event: MessageEvent) => {
        if (DEBUG) {
          console.log('[Auth DEBUG] 📨 Received message:', event.data);
          console.log('[Auth DEBUG] 📍 Message origin:', event.origin);
        }

        // Validate origin
        if (!allowedOrigins.includes(event.origin)) {
          if (DEBUG) {
            console.warn('[Auth DEBUG] ❌ Rejected message from unauthorized origin:', event.origin);
            console.log('[Auth DEBUG] Allowed origins:', allowedOrigins);
          }
          return;
        }

        if (DEBUG) {
          console.log('[Auth DEBUG] ✅ Origin verified');
        }

        // Handle JWT token from parent (same format as credit system)
        if (event.data.type === 'JWT_TOKEN_RESPONSE') {
          if (DEBUG) {
            console.log('[Auth DEBUG] 🔑 Received JWT_TOKEN_RESPONSE');
            console.log('[Auth DEBUG] Token present:', !!event.data.token);
            console.log('[Auth DEBUG] User present:', !!event.data.user);
            console.log('[Auth DEBUG] Response data:', {
              hasToken: !!event.data.token,
              hasRefreshToken: !!event.data.refreshToken,
              hasUser: !!event.data.user,
              user: event.data.user
            });
          }

          if (event.data.token && event.data.user) {
            const { token, refreshToken, user } = event.data;

            if (DEBUG) {
              console.log('[Auth DEBUG] 💾 Storing tokens in sessionStorage');
              console.log('[Auth DEBUG] User:', user);
            }

            // Store tokens (using same keys as credit system)
            sessionStorage.setItem('creditSystem_accessToken', token);
            if (refreshToken) {
              sessionStorage.setItem('creditSystem_refreshToken', refreshToken);
            }
            sessionStorage.setItem('creditSystem_user', JSON.stringify(user));

            if (DEBUG) {
              console.log('[Auth DEBUG] ✅ Tokens stored successfully');
              console.log('[Auth DEBUG] 🔄 Redirecting to /dashboard');
            }

            toast({
              title: "Auto-login successful",
              description: `Welcome, ${user.email}!`,
            });

            // Redirect to dashboard
            navigate("/dashboard");
          } else {
            if (DEBUG) {
              console.warn('[Auth DEBUG] ⚠️ JWT_TOKEN_RESPONSE missing token or user');
              console.log('[Auth DEBUG] Event data:', event.data);
            }
            setLoading(false);
            toast({
              title: "Authentication failed",
              description: event.data.error || "No token received from parent",
              variant: "destructive",
            });
          }
        } else {
          if (DEBUG) {
            console.log('[Auth DEBUG] ℹ️ Message type:', event.data.type);
          }
        }
      };

      if (DEBUG) {
        console.log('[Auth DEBUG] 🎧 Adding message event listener');
      }

      window.addEventListener('message', handleMessage);

      // Request JWT from parent (same message as credit system)
      if (DEBUG) {
        console.log('[Auth DEBUG] 📤 Sending REQUEST_JWT_TOKEN to parent');
        console.log('[Auth DEBUG] Target:', '*');
      }

      window.parent.postMessage({ type: 'REQUEST_JWT_TOKEN' }, '*');

      // Timeout after 15 seconds
      const timeout = setTimeout(() => {
        if (DEBUG) {
          console.warn('[Auth DEBUG] ⏱️ Timeout: No response from parent after 15 seconds');
        }
        setLoading(false);
        toast({
          title: "Authentication timeout",
          description: "Failed to receive authentication from parent",
          variant: "destructive",
        });
      }, 15000);

      return () => {
        if (DEBUG) {
          console.log('[Auth DEBUG] 🧹 Cleanup: Removing message listener and timeout');
        }
        window.removeEventListener('message', handleMessage);
        clearTimeout(timeout);
      };
    } else {
      if (DEBUG) {
        console.log('[Auth DEBUG] Running in standalone mode');
      }
    }
  }, [navigate, toast, DEBUG]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (DEBUG) {
      console.log('[Auth DEBUG] 🔐 Login attempt - standalone mode');
    }

    if (!email || !password) {
      if (DEBUG) {
        console.warn('[Auth DEBUG] ⚠️ Missing email or password');
      }
      toast({
        title: "Error",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const authUrl = import.meta.env.VITE_AUTH_URL || "https://v2.supremegroup.ai/api/jwt";

      if (DEBUG) {
        console.log('[Auth DEBUG] 📤 Sending login request to:', `${authUrl}/login`);
      }

      const response = await fetch(`${authUrl}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (DEBUG) {
        console.log('[Auth DEBUG] 📥 Login response:', {
          ok: response.ok,
          status: response.status,
          success: data.success,
          hasData: !!data.data
        });
      }

      if (response.ok && data.success && data.data) {
        if (DEBUG) {
          console.log('[Auth DEBUG] ✅ Login successful');
          console.log('[Auth DEBUG] 💾 Storing tokens');
          console.log('[Auth DEBUG] User:', data.data.user);
        }

        // Store JWT tokens and user data
        sessionStorage.setItem('creditSystem_accessToken', data.data.tokens.access_token);
        sessionStorage.setItem('creditSystem_refreshToken', data.data.tokens.refresh_token);
        sessionStorage.setItem('creditSystem_user', JSON.stringify(data.data.user));

        if (DEBUG) {
          console.log('[Auth DEBUG] 🔄 Redirecting to /dashboard');
        }

        toast({
          title: "Login successful",
          description: `Welcome back, ${data.data.user.email}!`,
        });

        // Redirect to dashboard
        navigate("/dashboard");
      } else {
        if (DEBUG) {
          console.warn('[Auth DEBUG] ❌ Login failed:', data.message);
        }
        toast({
          title: "Login failed",
          description: data.message || "Invalid credentials",
          variant: "destructive",
        });
      }
    } catch (error) {
      if (DEBUG) {
        console.error('[Auth DEBUG] ❌ Login error:', error);
      }
      toast({
        title: "Error",
        description: "Failed to login. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Show loading state in embedded mode
  if (mode === "embedded" && loading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 border-2 shadow-premium">
          <div className="flex flex-col items-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <h2 className="text-xl font-semibold mb-2">Authenticating...</h2>
            <p className="text-muted-foreground text-center">
              Waiting for authentication from parent application
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 border-2 shadow-premium">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 mb-4 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-premium">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            User Authentication
          </h1>
          <p className="text-muted-foreground mt-2">
            Sign in to view your details and personas
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="border-2"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="border-2"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-gradient-primary hover:opacity-90 shadow-premium"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
            Back to home
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
