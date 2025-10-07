import CreditSystemDemo from '@/components/CreditSystemDemo'
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function Credits() {
  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-4 flex gap-2">
          <Link to="/">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="outline">My Dashboard</Button>
          </Link>
        </div>
        <CreditSystemDemo />
      </div>
    </div>
  )
}