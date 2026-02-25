import { Link } from "react-router-dom";

import { App } from "@/App";
import { Button } from "@/components/ui/button";

export function OfficePage(): JSX.Element {
  return (
    <main className="min-h-screen">
      <div className="p-3 border-b bg-background/80 backdrop-blur">
        <Link to="/">
          <Button variant="outline" size="sm">
            Back to Landing
          </Button>
        </Link>
      </div>
      <App initialTab="office" />
    </main>
  );
}
