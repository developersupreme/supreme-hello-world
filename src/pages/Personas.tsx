import { useState, useEffect } from "react";
// @ts-ignore - SDK types may not be fully exported
import * as SupremeAI from "@supreme-ai/si-sdk";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { User, Loader2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface Persona {
  id: number;
  name: string;
  description?: string;
  [key: string]: any;
}

const Personas = () => {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPersonas();
  }, []);

  const fetchPersonas = async () => {
    try {
      setLoading(true);

      // 1. Initialize credit system (for JWT token)
      const creditClient = new (SupremeAI as any).CreditSystemClient({
        apiBaseUrl: "https://v2.supremegroup.ai/api/secure-credits/jwt",
        authUrl: "https://v2.supremegroup.ai/api/jwt",
        autoInit: true
      });

      // 2. Initialize personas client
      const personasClient = new (SupremeAI as any).PersonasClient({
        apiBaseUrl: "https://v2.supremegroup.ai/api",
        getAuthToken: () => {
          const auth = sessionStorage.getItem('creditSystem_auth');
          return auth ? JSON.parse(auth).token : null;
        },
        debug: true
      });

      // 3. Fetch all personas for logged user
      const result = await personasClient.getPersonas();
      
      if (result.success && result.personas) {
        setPersonas(result.personas);
        toast({
          title: "Success",
          description: `Loaded ${result.personas.length} personas`,
        });
      } else {
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
    } finally {
      setLoading(false);
    }
  };

  const fetchPersonaById = async (id: number) => {
    try {
      const personasClient = new (SupremeAI as any).PersonasClient({
        apiBaseUrl: "https://v2.supremegroup.ai/api",
        getAuthToken: () => {
          const auth = sessionStorage.getItem('creditSystem_auth');
          return auth ? JSON.parse(auth).token : null;
        },
        debug: true
      });

      const result = await personasClient.getPersonaById(id);
      
      if (result.success && result.persona) {
        setSelectedPersona(result.persona);
        toast({
          title: "Persona loaded",
          description: `Viewing details for ${result.persona.name}`,
        });
      }
    } catch (error) {
      console.error("Error fetching persona:", error);
      toast({
        title: "Error",
        description: "Failed to fetch persona details",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link to="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          
          <h1 className="text-4xl font-bold mb-2 bg-gradient-primary bg-clip-text text-transparent">
            My Personas
          </h1>
          <p className="text-muted-foreground">
            View and manage your personas
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : personas.length === 0 ? (
          <Card className="p-12 text-center">
            <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No personas found</h3>
            <p className="text-muted-foreground mb-6">
              You don't have any personas yet
            </p>
            <Button onClick={fetchPersonas}>Refresh</Button>
          </Card>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {personas.map((persona) => (
                <Card
                  key={persona.id}
                  className="p-6 hover:shadow-premium transition-all duration-300 border-2 cursor-pointer"
                  onClick={() => fetchPersonaById(persona.id)}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center">
                      <User className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{persona.name}</h3>
                      <p className="text-sm text-muted-foreground">ID: {persona.id}</p>
                    </div>
                  </div>
                  {persona.description && (
                    <p className="text-muted-foreground text-sm">
                      {persona.description}
                    </p>
                  )}
                </Card>
              ))}
            </div>

            {selectedPersona && (
              <Card className="p-8 border-2 shadow-premium">
                <h2 className="text-2xl font-bold mb-4">Persona Details</h2>
                <div className="space-y-3">
                  <div>
                    <span className="font-semibold">Name:</span>{" "}
                    {selectedPersona.name}
                  </div>
                  <div>
                    <span className="font-semibold">ID:</span>{" "}
                    {selectedPersona.id}
                  </div>
                  {selectedPersona.description && (
                    <div>
                      <span className="font-semibold">Description:</span>{" "}
                      {selectedPersona.description}
                    </div>
                  )}
                  <div className="pt-4">
                    <span className="font-semibold block mb-2">Full Data:</span>
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                      {JSON.stringify(selectedPersona, null, 2)}
                    </pre>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Personas;
