import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface InviteCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const VALID_CODE = "Izunia";

export function InviteCodeModal({ open, onOpenChange }: InviteCodeModalProps) {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    setIsLoading(true);

    if (code === VALID_CODE) {
      sessionStorage.setItem("zanarkand_access", "true");
      toast.success("Access granted! Welcome to Zanarkand");
      onOpenChange(false);
      navigate("/office");
    } else {
      toast.error("Invalid invite code");
    }

    setIsLoading(false);
    setCode("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enter Invite Code</DialogTitle>
          <DialogDescription>Command your agents. Build your business. Compete to win.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            placeholder="Enter invite code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full"
          />
          <Button type="submit" className="w-full" disabled={isLoading || !code}>
            {isLoading ? "Verifying..." : "Access Zanarkand"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
