import { useState, useEffect } from "react";
// @ts-ignore - SDK types may not be fully exported
import * as SupremeAI from "@supreme-ai/si-sdk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { User, Loader2, RefreshCw } from "lucide-react";

interface Persona {
  id: number;
  name: string;
  description?: string;
  category?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

interface PersonasListProps {
  onPersonaSelect?: (persona: Persona) => void;
}

export const PersonasList = ({ onPersonaSelect }: PersonasListProps) => {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchPersonas();
  }, []);

  const fetchPersonas = async () => {
    try {
      setLoading(true);

      // Initialize credit system for JWT token
      const creditClient = new (SupremeAI as any).CreditSystemClient({
        apiBaseUrl: "https://v2.supremegroup.ai/api/secure-credits/jwt",
        authUrl: "https://v2.supremegroup.ai/api/jwt",
        autoInit: true
      });

      // Initialize personas client
      const personasClient = new (SupremeAI as any).PersonasClient({
        apiBaseUrl: "https://v2.supremegroup.ai/api",
        getAuthToken: () => {
          const auth = sessionStorage.getItem('creditSystem_auth');
          return auth ? JSON.parse(auth).token : null;
        },
        debug: true
      });

      const result = await personasClient.getPersonas();
      
      if (result.success && result.personas) {
        setPersonas(result.personas);
        toast({
          title: "Success",
          description: `Loaded ${result.personas.length} personas`,
        });
      } else {
        setPersonas([]);
        toast({
          title: "No personas found",
          description: "You don't have any personas yet",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching personas:", error);
      toast({
        title: "Error",
        description: "Failed to fetch personas. Please try again.",
        variant: "destructive",
      });
      setPersonas([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (personas.length === 0) {
    return (
      <Card className="p-8 text-center">
        <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-xl font-semibold mb-2">No personas found</h3>
        <p className="text-muted-foreground mb-4">
          You don't have any personas yet
        </p>
        <Button onClick={fetchPersonas} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Your Personas ({personas.length})</h2>
        <Button onClick={fetchPersonas} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {personas.map((persona) => (
          <Card
            key={persona.id}
            className="p-6 hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/50"
            onClick={() => onPersonaSelect?.(persona)}
          >
            <div className="flex items-center gap-4 mb-3">
              <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center">
                <User className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{persona.name}</h3>
                <p className="text-xs text-muted-foreground">ID: {persona.id}</p>
              </div>
            </div>
            
            {persona.description && (
              <p className="text-sm text-muted-foreground mb-2">
                {persona.description}
              </p>
            )}
            
            {persona.category && (
              <div className="mt-3">
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                  {persona.category}
                </span>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
