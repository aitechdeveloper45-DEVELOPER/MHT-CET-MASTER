import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Mail, Copy, Check, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const SUPPORT_EMAIL = "aitechdeveloper45@gmail.com";
const SUPPORT_PHONE = "9403140045";

const ContactSupport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopiedEmail(true);
      toast({ title: "Copied!", description: "Email address copied to clipboard." });
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      toast({ title: "Error", description: "Failed to copy.", variant: "destructive" });
    }
  };

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_PHONE);
      setCopiedPhone(true);
      toast({ title: "Copied!", description: "Phone number copied to clipboard." });
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch {
      toast({ title: "Error", description: "Failed to copy.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-10 w-10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Contact Support</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Phone Card */}
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Phone className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">Phone Support</h2>
              <p className="text-sm text-muted-foreground">Copy the number to contact our support team.</p>
            </div>
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-3 border">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium flex-1">{SUPPORT_PHONE}</span>
            </div>
            <Button className="w-full h-12 gap-2" onClick={handleCopyPhone}>
              {copiedPhone ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              {copiedPhone ? "Copied!" : "Copy Phone Number"}
            </Button>
          </CardContent>
        </Card>

        {/* Email Card */}
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="flex items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-semibold">Email Us</h2>
              <p className="text-sm text-muted-foreground">Copy the email and send us your query. We'll respond within 24 hours.</p>
            </div>
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-3 border">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium flex-1 truncate">{SUPPORT_EMAIL}</span>
            </div>
            <Button className="w-full h-12 gap-2" onClick={handleCopyEmail}>
              {copiedEmail ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
              {copiedEmail ? "Copied!" : "Copy Email Address"}
            </Button>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">We typically respond within 24 hours.</p>
      </div>
    </div>
  );
};

export default ContactSupport;
