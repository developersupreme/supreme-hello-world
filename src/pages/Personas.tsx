import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, Mail, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { PersonasList } from "@/components/PersonasList";

interface Persona {
  id: number;
  name: string;
  description?: string;
  [key: string]: any;
}

const Personas = () => {
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = sessionStorage.getItem('creditSystem_accessToken');
    if (!accessToken) {
      navigate("/auth");
      return;
    }
    const userStr = sessionStorage.getItem('creditSystem_user');
    if (userStr) {
      const userData = JSON.parse(userStr);
      setUserEmail(userData.email || "");
      setUserName(userData.name || "");
    }
  }, [navigate]);

  const fetchPersonaById = async (id: number) => {
    try {
      // Dynamically import SDK
      const SDK = await import("@supreme-ai/si-sdk");
      const PersonasClientClass = (SDK as any).PersonasClient || (SDK as any).default?.PersonasClient;
      
      if (!PersonasClientClass) {
        throw new Error("PersonasClient not available in SDK");
      }

      const personasClient = new PersonasClientClass({
        apiBaseUrl: import.meta.env.VITE_PERSONAS_API_URL || "http://127.0.0.1:8000/api",
        getAuthToken: () => {
          return sessionStorage.getItem('creditSystem_accessToken');
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

  const handlePersonaSelect = (persona: Persona) => {
    fetchPersonaById(persona.id);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('creditSystem_accessToken');
    sessionStorage.removeItem('creditSystem_refreshToken');
    sessionStorage.removeItem('creditSystem_user');
    toast({
      title: "Logged out",
      description: "You have been logged out successfully",
    });
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-end mb-4">
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>

          <Card className="p-6 border-2 shadow-lg mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center">
                <User className="h-8 w-8 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{userName || "User Profile"}</h2>
                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                  <Mail className="h-4 w-4" />
                  <span>{userEmail}</span>
                </div>
              </div>
            </div>
          </Card>
          
          <h1 className="text-4xl font-bold mb-2 bg-gradient-primary bg-clip-text text-transparent">
            My Personas
          </h1>
          <p className="text-muted-foreground">
            View and manage your personas
          </p>
        </div>

        <PersonasList onPersonaSelect={handlePersonaSelect} />

        {selectedPersona && (
          <Card className="p-8 border-2 shadow-lg mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Persona Details</h2>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedPersona(null)}
              >
                Close
              </Button>
            </div>
            <div className="space-y-3">
              <div>
                <span className="font-semibold">Name:</span>{" "}
                {selectedPersona.name}
              </div>
              <div>
                <span className="font-semibold">ID:</span>{" "}
                {selectedPersona.id}
              </div>
              {selectedPersona.short_description && (
                <div>
                  <span className="font-semibold">Short Description:</span>{" "}
                  {selectedPersona.short_description}
                </div>
              )}
              {selectedPersona.long_description && (
                <div>
                  <span className="font-semibold">Long Description:</span>{" "}
                  <div className="mt-1 text-sm whitespace-pre-wrap">{selectedPersona.long_description}</div>
                </div>
              )}
              {selectedPersona.category && (
                <div>
                  <span className="font-semibold">Category:</span>{" "}
                  {selectedPersona.category}
                </div>
              )}
              {selectedPersona.geo && (
                <div>
                  <span className="font-semibold">Geography:</span>{" "}
                  {selectedPersona.geo}
                </div>
              )}
              {selectedPersona.size && (
                <div>
                  <span className="font-semibold">Size:</span>{" "}
                  {selectedPersona.size}
                </div>
              )}
              {selectedPersona.industry && (
                <div>
                  <span className="font-semibold">Industry:</span>{" "}
                  {selectedPersona.industry}
                </div>
              )}
              {selectedPersona.job_title && (
                <div>
                  <span className="font-semibold">Job Title:</span>{" "}
                  {selectedPersona.job_title}
                </div>
              )}
              {selectedPersona.value && (
                <div>
                  <span className="font-semibold">Value:</span>{" "}
                  {selectedPersona.value}
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
      </div>
    </div>
  );
};

export default Personas;
