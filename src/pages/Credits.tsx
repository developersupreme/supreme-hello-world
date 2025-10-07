import CreditSystemDemo from '@/components/CreditSystemDemo'
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function Credits() {
  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="container mx-auto px-4 py-8">
        <CreditSystemDemo />
      </div>
    </div>
  )
}