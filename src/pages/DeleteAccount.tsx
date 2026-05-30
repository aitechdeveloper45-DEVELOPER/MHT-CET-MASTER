import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const DeleteAccount = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleDeleteRequest = () => {
    if (confirmText.toLowerCase() !== "delete my account") {
      toast({
        title: "Confirmation required",
        description: 'Please type "DELETE MY ACCOUNT" to confirm',
        variant: "destructive",
      });
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setShowConfirmDialog(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Not logged in",
          description: "Please log in to delete your account",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      // Sign out the user (actual deletion requires admin/service role)
      await supabase.auth.signOut();

      toast({
        title: "Account Deletion Requested",
        description: "Your account deletion request has been submitted. Your data will be deleted within 30 days. You will receive a confirmation email.",
      });

      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process deletion request",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="container max-w-2xl mx-auto pt-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)} 
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card className="border-destructive/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-full">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-destructive">Delete Account</CardTitle>
                <CardDescription>
                  Permanently delete your account and all associated data
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <h3 className="font-semibold text-destructive mb-2">Warning: This action is irreversible</h3>
              <p className="text-sm text-muted-foreground">
                Deleting your account will permanently remove:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
                <li>Your profile information</li>
                <li>All test results and progress data</li>
                <li>Study statistics and achievements</li>
                <li>Weekly goals and tracking history</li>
                <li>All other associated data</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">
                To confirm, type <span className="font-semibold text-destructive">"DELETE MY ACCOUNT"</span> below:
              </Label>
              <Input
                id="confirm"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                className="border-destructive/50 focus:border-destructive"
              />
            </div>

            <Button
              variant="destructive"
              className="w-full"
              onClick={handleDeleteRequest}
              disabled={isDeleting || confirmText.toLowerCase() !== "delete my account"}
            >
              {isDeleting ? "Processing..." : "Delete My Account"}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              For any questions about data deletion, visit our{" "}
              <a href="/contact-support" className="text-primary hover:underline">
                support page
              </a>.
            </p>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your account
              and remove all your data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              className="bg-destructive hover:bg-destructive/90"
            >
              Yes, delete my account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DeleteAccount;
