import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Users, Database, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const AdminPanel = () => {
  const { toast } = useToast();

  const handleViewUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      toast({
        title: "User Stats",
        description: `Total users: ${data?.length || 0}`,
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch user data",
        variant: "destructive",
      });
    }
  };

  const handleViewDatabase = () => {
    toast({
      title: "Database Access",
      description: "Open Lovable Cloud dashboard to manage your database",
    });
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Admin Controls</CardTitle>
        </div>
        <CardDescription className="text-xs">
          You have full control over the app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleViewUsers}
            className="w-full text-xs"
          >
            <Users className="mr-2 h-3 w-3" />
            View Users
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleViewDatabase}
            className="w-full text-xs"
          >
            <Database className="mr-2 h-3 w-3" />
            Database
          </Button>
        </div>
        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
          <Settings className="h-3 w-3 inline mr-1" />
          To update the live app: Make changes and click Publish
        </div>
      </CardContent>
    </Card>
  );
};
