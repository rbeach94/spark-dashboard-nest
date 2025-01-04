import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { ChromePicker } from 'react-color';
import { useToast } from "@/hooks/use-toast";

const Profile = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showColorPicker, setShowColorPicker] = useState<'background' | 'text' | 'button' | null>(null);

  console.log('Profile component mounted with id:', id); // Debug log

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile', id],
    queryFn: async () => {
      console.log('Fetching profile data for id:', id); // Debug log
      const { data, error } = await supabase
        .from('nfc_profiles')
        .select(`
          *,
          profile_buttons (
            id,
            label,
            action_type,
            action_value,
            sort_order
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error); // Debug log
        throw error;
      }
      
      console.log('Profile data received:', data); // Debug log
      return data;
    },
    enabled: !!id, // Only run query if we have an ID
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase
        .from('nfc_profiles')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', id] });
      toast({
        title: "Profile updated",
        description: "Your changes have been saved successfully.",
      });
    },
  });

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${id}/${crypto.randomUUID()}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('Tappio Profiles')
        .upload(fileName, file);

      if (uploadError) {
        toast({
          title: "Upload failed",
          description: "Failed to upload logo. Please try again.",
          variant: "destructive",
        });
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('Tappio Profiles')
        .getPublicUrl(fileName);

      updateProfile.mutate({ logo_url: publicUrl });
      
      toast({
        title: "Logo uploaded",
        description: "Your logo has been updated successfully.",
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Upload failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };

  const addButton = useMutation({
    mutationFn: async (buttonData: {
      label: string;
      action_type: 'link' | 'email' | 'call';
      action_value: string;
    }) => {
      const { error } = await supabase
        .from('profile_buttons')
        .insert({
          profile_id: id,
          ...buttonData,
          sort_order: profile?.profile_buttons?.length || 0,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', id] });
      toast({
        title: "Button added",
        description: "New button has been added successfully.",
      });
    },
  });

  const deleteButton = useMutation({
    mutationFn: async (buttonId: string) => {
      const { error } = await supabase
        .from('profile_buttons')
        .delete()
        .eq('id', buttonId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', id] });
      toast({
        title: "Button deleted",
        description: "The button has been removed successfully.",
      });
    },
  });

  const generateVCard = () => {
    if (!profile) return;
    
    const vCard = `BEGIN:VCARD
VERSION:3.0
FN:${profile.full_name}
ORG:${profile.company}
TITLE:${profile.job_title}
TEL:${profile.phone}
EMAIL:${profile.email}
URL:${profile.website}
END:VCARD`;

    const blob = new Blob([vCard], { type: 'text/vcard' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${profile.full_name}.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (error) {
    console.error('Error in profile component:', error); // Debug log
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Profile</h1>
        <p className="text-gray-600 mb-4">There was an error loading your profile. Please try again later.</p>
        <Button 
          onClick={() => window.location.href = '/dashboard'}
          variant="outline"
        >
          Return to Dashboard
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Profile Not Found</h1>
        <p className="text-gray-600 mb-4">The profile you're looking for doesn't exist or you don't have permission to view it.</p>
        <Button 
          onClick={() => window.location.href = '/dashboard'}
          variant="outline"
        >
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen p-4"
      style={{
        backgroundColor: profile.background_color || '#ffffff',
        color: profile.text_color || '#000000',
      }}
    >
      <div className="max-w-md mx-auto space-y-6">
        {/* Logo Upload */}
        <div className="text-center">
          {profile.logo_url ? (
            <div className="relative group">
              <img 
                src={profile.logo_url} 
                alt="Business Logo" 
                className="w-32 h-32 mx-auto object-contain rounded-lg"
              />
              <label 
                htmlFor="logo-upload"
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-lg"
              >
                <span className="text-white">Change Logo</span>
              </label>
              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </div>
          ) : (
            <div className="w-32 h-32 mx-auto border-2 border-dashed rounded-lg flex items-center justify-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                id="logo-upload"
              />
              <label 
                htmlFor="logo-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Plus className="w-8 h-8 mb-2" />
                <span>Add Logo</span>
              </label>
            </div>
          )}
        </div>

        {/* Profile Information */}
        <div className="space-y-4">
          <Input
            value={profile.full_name || ''}
            onChange={(e) => updateProfile.mutate({ full_name: e.target.value })}
            placeholder="Full Name"
            className="text-black"
          />
          <Input
            value={profile.job_title || ''}
            onChange={(e) => updateProfile.mutate({ job_title: e.target.value })}
            placeholder="Job Title"
            className="text-black"
          />
          <Input
            value={profile.company || ''}
            onChange={(e) => updateProfile.mutate({ company: e.target.value })}
            placeholder="Company"
            className="text-black"
          />
          <Input
            value={profile.email || ''}
            onChange={(e) => updateProfile.mutate({ email: e.target.value })}
            placeholder="Email"
            type="email"
            className="text-black"
          />
          <Input
            value={profile.phone || ''}
            onChange={(e) => updateProfile.mutate({ phone: e.target.value })}
            placeholder="Phone"
            type="tel"
            className="text-black"
          />
          <Input
            value={profile.website || ''}
            onChange={(e) => updateProfile.mutate({ website: e.target.value })}
            placeholder="Website"
            type="url"
            className="text-black"
          />
        </div>

        {/* Save Contact Button */}
        <Button 
          onClick={generateVCard}
          className="w-full"
          style={{ backgroundColor: profile.button_color }}
        >
          Save My Contact
        </Button>

        {/* Custom Buttons */}
        <div className="space-y-4">
          {profile.profile_buttons?.map((button) => (
            <div key={button.id} className="flex gap-2">
              <Button
                className="flex-1"
                style={{ backgroundColor: profile.button_color }}
                onClick={() => {
                  switch (button.action_type) {
                    case 'link':
                      window.open(button.action_value, '_blank');
                      break;
                    case 'email':
                      window.location.href = `mailto:${button.action_value}`;
                      break;
                    case 'call':
                      window.location.href = `tel:${button.action_value}`;
                      break;
                  }
                }}
              >
                {button.label}
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteButton.mutate(button.id)}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>

        {/* Add Button Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            addButton.mutate({
              label: formData.get('label') as string,
              action_type: formData.get('action_type') as 'link' | 'email' | 'call',
              action_value: formData.get('action_value') as string,
            });
            (e.target as HTMLFormElement).reset();
          }}
          className="space-y-4"
        >
          <Input name="label" placeholder="Button Label" required className="text-black" />
          <select name="action_type" required className="w-full p-2 rounded border text-black">
            <option value="link">Link</option>
            <option value="email">Email</option>
            <option value="call">Call</option>
          </select>
          <Input name="action_value" placeholder="URL/Email/Phone" required className="text-black" />
          <Button type="submit" className="w-full">Add Button</Button>
        </form>

        {/* Bio */}
        <Textarea
          value={profile.bio || ''}
          onChange={(e) => updateProfile.mutate({ bio: e.target.value })}
          placeholder="Add your bio here..."
          className="min-h-[100px] text-black"
        />

        {/* Color Pickers */}
        <div className="space-y-4">
          <div>
            <Button
              onClick={() => setShowColorPicker(showColorPicker === 'background' ? null : 'background')}
              className="w-full mb-2"
            >
              Change Background Color
            </Button>
            {showColorPicker === 'background' && (
              <div className="absolute z-10">
                <ChromePicker
                  color={profile.background_color}
                  onChange={(color) => updateProfile.mutate({ background_color: color.hex })}
                />
              </div>
            )}
          </div>

          <div>
            <Button
              onClick={() => setShowColorPicker(showColorPicker === 'text' ? null : 'text')}
              className="w-full mb-2"
            >
              Change Text Color
            </Button>
            {showColorPicker === 'text' && (
              <div className="absolute z-10">
                <ChromePicker
                  color={profile.text_color}
                  onChange={(color) => updateProfile.mutate({ text_color: color.hex })}
                />
              </div>
            )}
          </div>

          <div>
            <Button
              onClick={() => setShowColorPicker(showColorPicker === 'button' ? null : 'button')}
              className="w-full mb-2"
            >
              Change Button Color
            </Button>
            {showColorPicker === 'button' && (
              <div className="absolute z-10">
                <ChromePicker
                  color={profile.button_color}
                  onChange={(color) => updateProfile.mutate({ button_color: color.hex })}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;