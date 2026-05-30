import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { User } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2, ArrowLeft } from "lucide-react";
import { clearSessionCookie } from "@/lib/sessionBackup";

interface Profile {
  name: string | null;
  email: string | null;
  phone_number: string | null;
  class: string | null;
  college_name: string | null;
  avatar_url: string | null;
}

const Profile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile>({
    name: null,
    email: null,
    phone_number: null,
    class: null,
    college_name: null,
    avatar_url: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if user came from login/signup (should redirect to dashboard if profile complete)
  // vs navigating directly to /profile (should stay on profile)
  const cameFromAuth = location.state?.fromAuth === true;

  useEffect(() => {
    let isMounted = true;

    const fetchUser = async () => {
      try {
        // Race session check against a timeout to avoid hanging on bad network
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);

        if (!sessionResult || !isMounted) {
          if (isMounted) navigate("/auth", { replace: true });
          return;
        }

        const { data: { session }, error } = sessionResult as Awaited<ReturnType<typeof supabase.auth.getSession>>;
        
        if (error) {
          console.error("Profile: Session error", error.message);
          clearSessionCookie();
          if (isMounted) navigate("/auth", { replace: true });
          return;
        }
        
        if (!session) {
          if (isMounted) navigate("/auth", { replace: true });
          return;
        }

        if (isMounted) {
          setUser(session.user);
          await fetchProfile(session.user.id, isMounted);
        }
      } catch (err) {
        console.error("Profile: Unexpected error", err);
        if (isMounted) navigate("/auth", { replace: true });
      }
    };

    fetchUser();

    let subscription: { unsubscribe: () => void } | undefined;
    try {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (!isMounted) return;
        
        if (event === 'SIGNED_OUT') {
          clearSessionCookie();
          navigate("/auth", { replace: true });
        } else if (session) {
          setUser(session.user);
        }
      });
      subscription = data.subscription;
    } catch (err) {
      console.error("Profile: Error setting up auth listener", err);
    }

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [navigate]);

  const fetchProfile = async (userId: string, isMounted: boolean = true) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      if (!isMounted) return;

      if (data) {
        setProfile({
          name: data.name,
          email: data.email,
          phone_number: data.phone_number,
          class: data.class,
          college_name: data.college_name,
          avatar_url: data.avatar_url,
        });
        
        // Check if profile is complete
        const isComplete = !!(data.name && data.class && data.college_name);
        setIsNewUser(!isComplete);
        
        // Only auto-redirect to dashboard if:
        // 1. Profile is complete AND
        // 2. User just logged in (cameFromAuth) - otherwise they want to view/edit profile
        if (isComplete && cameFromAuth) {
          navigate("/dashboard", { replace: true });
        }
      } else {
        setIsNewUser(true);
      }
    } catch (error: any) {
      if (isMounted) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      if (isMounted) setIsFetching(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: profile.name,
          phone_number: profile.phone_number,
          class: profile.class,
          college_name: profile.college_name,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });

      // Redirect to dashboard after first-time setup
      if (isNewUser && profile.name && profile.class && profile.college_name) {
        setTimeout(() => navigate("/dashboard", { replace: true }), 500);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      clearSessionCookie();
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    } catch (error) {
      console.error("Sign out error:", error);
      // Force navigation even if signOut fails
      navigate("/auth", { replace: true });
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image size should be less than 2MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingAvatar(true);

    try {
      // Delete old avatar if exists
      if (profile.avatar_url) {
        try {
          const url = new URL(profile.avatar_url);
          const pathParts = url.pathname.split('/avatars/');
          if (pathParts[1]) {
            await supabase.storage
              .from('avatars')
              .remove([pathParts[1]]);
          }
        } catch {
          // Ignore URL parsing errors for old avatars
        }
      }

      // Upload new avatar
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get signed URL (bucket is private)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('avatars')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry

      if (signedUrlError || !signedUrlData?.signedUrl) throw signedUrlError || new Error('Failed to create signed URL');

      const avatarUrl = signedUrlData.signedUrl;

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: avatarUrl });

      toast({
        title: "Success",
        description: "Profile photo updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  if (isFetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="container max-w-2xl mx-auto pt-8">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-10 w-10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold flex-1">My Profile</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              {isNewUser 
                ? "Complete your profile to get started" 
                : "View and update your personal information"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdate} className="space-y-6">
              {/* Profile Photo Section */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={profile.avatar_url || undefined} alt={profile.name || "User"} />
                    <AvatarFallback className="text-2xl">
                      {profile.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Profile Photo</p>
                  <p className="text-xs text-muted-foreground">
                    Click the camera icon to upload (Max 2MB)
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-sm text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  type="text"
                  value={profile.name || ""}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="Enter your name"
                  required={isNewUser}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone_number">Phone Number</Label>
                <Input
                  id="phone_number"
                  type="tel"
                  value={profile.phone_number || ""}
                  onChange={(e) => setProfile({ ...profile, phone_number: e.target.value })}
                  placeholder="Enter your phone number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="class">Class *</Label>
                <Input
                  id="class"
                  type="text"
                  value={profile.class || ""}
                  onChange={(e) => setProfile({ ...profile, class: e.target.value })}
                  placeholder="Enter your class (e.g., 12th Grade)"
                  required={isNewUser}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="college_name">College Name *</Label>
                <Input
                  id="college_name"
                  type="text"
                  value={profile.college_name || ""}
                  onChange={(e) => setProfile({ ...profile, college_name: e.target.value })}
                  placeholder="Enter your college name"
                  required={isNewUser}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Updating..." : isNewUser ? "Save & Continue" : "Update Profile"}
              </Button>

              {!isNewUser && (
                <div className="mt-6 pt-6 border-t">
                  <Button 
                    type="button" 
                    variant="destructive" 
                    className="w-full"
                    onClick={() => navigate("/delete-account")}
                  >
                    Delete Account
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
