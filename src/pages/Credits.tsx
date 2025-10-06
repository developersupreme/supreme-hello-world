import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function Credits() {
  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="container mx-auto px-4 py-12">
        <Link to="/">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-gradient-primary shadow-premium">
              <CreditCard className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
              Credit Management
            </h1>
            <p className="text-lg text-muted-foreground">
              Welcome to the Supreme Credit System
            </p>
          </div>

          <Card className="border-2 shadow-premium">
            <CardHeader>
              <CardTitle>Hello World!</CardTitle>
              <CardDescription>
                Your credit management dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                This is your Supreme Credit System dashboard. Here you can manage credits, view transactions, and monitor your account.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}