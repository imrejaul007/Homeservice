import React from "react";
import { FileText } from "lucide-react";

const MyClaimsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream p-8">
      <div className="max-w-4xl mx-auto">
        <div className="glass rounded-2xl border border-nilin-border/50 inner-glow p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-nilin-coral/20 flex items-center justify-center">
              <FileText className="h-6 w-6 text-nilin-coral" />
            </div>
            <div>
              <h1 className="text-2xl font-serif text-nilin-charcoal">My Claims</h1>
              <p className="text-sm text-nilin-warmGray">Track your service claims and requests</p>
            </div>
          </div>

          <div className="text-center py-12">
            <FileText className="h-16 w-16 text-nilin-warmGray mx-auto mb-4 opacity-50" />
            <h2 className="text-lg font-medium text-nilin-charcoal mb-2">Claims Feature Coming Soon</h2>
            <p className="text-sm text-nilin-warmGray max-w-md mx-auto">
              The claims and disputes management feature is currently under development.
              You will be able to file and track claims here once it is ready.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyClaimsPage;
