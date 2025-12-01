import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, TrendingUp, Award } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Hero Section */}
      <header className="container mx-auto px-4 py-20 text-center">
        <div className="animate-float">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-6 rounded-2xl bg-gradient-primary shadow-premium">
            <Shield className="w-10 h-10 text-primary-foreground" />
          </div>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
          Supreme Credit System
        </h1>
        
        <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Advanced credit management and scoring platform for modern financial operations
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/credits">
            <Button
              size="lg"
              className="bg-gradient-primary hover:opacity-90 shadow-premium text-lg px-8"
            >
              Credit System
            </Button>
          </Link>
        </div>
      </header>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Card className="p-8 hover:shadow-premium transition-all duration-300 border-2">
            <div className="w-12 h-12 mb-4 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Secure & Reliable</h3>
            <p className="text-muted-foreground">
              Enterprise-grade security ensuring your credit data is protected at all times
            </p>
          </Card>

          <Card className="p-8 hover:shadow-premium transition-all duration-300 border-2">
            <div className="w-12 h-12 mb-4 rounded-xl bg-accent/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Real-time Analytics</h3>
            <p className="text-muted-foreground">
              Monitor credit scores and trends with live analytics and reporting
            </p>
          </Card>

          <Card className="p-8 hover:shadow-premium transition-all duration-300 border-2">
            <div className="w-12 h-12 mb-4 rounded-xl bg-primary/10 flex items-center justify-center">
              <Award className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Premium Service</h3>
            <p className="text-muted-foreground">
              Supreme quality service with dedicated support for all your needs
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Index;
