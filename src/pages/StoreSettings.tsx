import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ExternalLink, Copy, Store, Palette, Upload, X, ImageIcon } from "lucide-react";

interface StoreSettings {
  id: string;
  owner_id: string;
  store_slug: string;
  store_name: string;
  store_description: string | null;
  whatsapp_number: string | null;
  show_own_products: boolean;
  is_active: boolean;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string | null;
}

interface Group {
  id: string;
  name: string;
}

interface StorePartnership {
  id: string;
  store_id: string;
  group_id: string;
}

export default function StoreSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    store_slug: "",
    store_name: "",
    store_description: "",
    whatsapp_number: "",
    show_own_products: true,
    is_active: true,
    primary_color: "#8B5CF6",
  });
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Fetch store settings
  const { data: storeSettings, isLoading } = useQuery({
    queryKey: ["my-store-settings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .eq("owner_id", user!.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as StoreSettings | null;
    },
    enabled: !!user,
  });

  // Fetch user groups
  const { data: userGroups = [] } = useQuery({
    queryKey: ["user-groups-for-store", user?.id],
    queryFn: async () => {
      const { data: memberships, error } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user!.id);
      
      if (error) throw error;
      
      if (!memberships || memberships.length === 0) return [];
      
      const { data: groups, error: groupsError } = await supabase
        .from("groups")
        .select("id, name")
        .in("id", memberships.map(m => m.group_id));
      
      if (groupsError) throw groupsError;
      return groups as Group[];
    },
    enabled: !!user,
  });

  // Fetch store partnerships
  const { data: storePartnerships = [] } = useQuery({
    queryKey: ["store-partnerships-config", storeSettings?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_partnerships")
        .select("*")
        .eq("store_id", storeSettings!.id);
      
      if (error) throw error;
      return data as StorePartnership[];
    },
    enabled: !!storeSettings?.id,
  });

  // Set form data when store settings load
  useEffect(() => {
    if (storeSettings) {
      setFormData({
        store_slug: storeSettings.store_slug,
        store_name: storeSettings.store_name,
        store_description: storeSettings.store_description || "",
        whatsapp_number: storeSettings.whatsapp_number || "",
        show_own_products: storeSettings.show_own_products,
        is_active: storeSettings.is_active,
        primary_color: storeSettings.primary_color || "#8B5CF6",
      });
      setLogoUrl(storeSettings.logo_url);
    }
  }, [storeSettings]);

  // Handle logo upload
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB");
      return;
    }

    setUploadingLogo(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user!.id}/logo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      setLogoUrl(publicUrl.publicUrl);

      // Update in database if store exists
      if (storeSettings?.id) {
        await supabase
          .from("store_settings")
          .update({ logo_url: publicUrl.publicUrl })
          .eq("id", storeSettings.id);
        queryClient.invalidateQueries({ queryKey: ["my-store-settings"] });
      }

      toast.success("Logo enviada com sucesso!");
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Erro ao enviar logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = async () => {
    setLogoUrl(null);
    if (storeSettings?.id) {
      await supabase
        .from("store_settings")
        .update({ logo_url: null })
        .eq("id", storeSettings.id);
      queryClient.invalidateQueries({ queryKey: ["my-store-settings"] });
    }
  };

  // Set selected groups when partnerships load
  useEffect(() => {
    if (storePartnerships.length > 0) {
      setSelectedGroups(storePartnerships.map(p => p.group_id));
    }
  }, [storePartnerships]);

  // Create/Update store
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (storeSettings) {
        // Update existing
        const { error } = await supabase
          .from("store_settings")
          .update({
            store_slug: formData.store_slug,
            store_name: formData.store_name,
            store_description: formData.store_description || null,
            whatsapp_number: formData.whatsapp_number || null,
            show_own_products: formData.show_own_products,
            is_active: formData.is_active,
            primary_color: formData.primary_color,
          })
          .eq("id", storeSettings.id);
        
        if (error) throw error;
        return storeSettings.id;
      } else {
        // Create new
        const { data, error } = await supabase
          .from("store_settings")
          .insert({
            owner_id: user!.id,
            store_slug: formData.store_slug,
            store_name: formData.store_name,
            store_description: formData.store_description || null,
            whatsapp_number: formData.whatsapp_number || null,
            show_own_products: formData.show_own_products,
            is_active: formData.is_active,
            primary_color: formData.primary_color,
          })
          .select("id")
          .single();
        
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: async (storeId) => {
      // Update partnerships
      // First delete existing
      await supabase
        .from("store_partnerships")
        .delete()
        .eq("store_id", storeId);
      
      // Then insert new
      if (selectedGroups.length > 0) {
        await supabase
          .from("store_partnerships")
          .insert(selectedGroups.map(groupId => ({
            store_id: storeId,
            group_id: groupId,
          })));
      }
      
      queryClient.invalidateQueries({ queryKey: ["my-store-settings"] });
      queryClient.invalidateQueries({ queryKey: ["store-partnerships-config"] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast.error("Este slug já está em uso. Escolha outro.");
      } else {
        toast.error("Erro ao salvar configurações");
      }
    },
  });

  const handleToggleGroup = (groupId: string) => {
    setSelectedGroups(prev => 
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const storeUrl = `${window.location.origin}/loja/${formData.store_slug}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(storeUrl);
    toast.success("Link copiado!");
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Store className="h-6 w-6" />
            Minha Loja / Catálogo
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure sua loja pública para exibir seus produtos
          </p>
        </div>

        {/* Store URL Preview */}
        {formData.store_slug && (
          <Card>
            <CardContent className="pt-4">
              <Label className="text-sm text-muted-foreground">Link da sua loja</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input value={storeUrl} readOnly className="bg-muted" />
                <Button variant="outline" size="icon" onClick={copyUrl}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={storeUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Logo Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Logomarca
            </CardTitle>
            <CardDescription>Adicione a logo da sua loja</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <div className="relative">
                  <img
                    src={logoUrl}
                    alt="Logo da loja"
                    className="w-24 h-24 object-contain rounded-lg border bg-muted"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={removeLogo}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/50">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="space-y-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingLogo ? "Enviando..." : "Enviar Logo"}
                </Button>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>PNG, JPG ou WebP. Máximo 2MB.</p>
                  <p className="font-medium text-amber-600">📐 Tamanho recomendado: 200x200px a 400x400px</p>
                  <p>Imagens quadradas funcionam melhor. A logo será exibida em formato circular.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Basic Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
            <CardDescription>Dados que aparecerão na sua loja</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="store_name">Nome da Loja *</Label>
                <Input
                  id="store_name"
                  value={formData.store_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, store_name: e.target.value }))}
                  placeholder="Minha Loja"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="store_slug">URL da Loja *</Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">/loja/</span>
                  <Input
                    id="store_slug"
                    value={formData.store_slug}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      store_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") 
                    }))}
                    placeholder="minha-loja"
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="store_description">Descrição</Label>
              <Textarea
                id="store_description"
                value={formData.store_description}
                onChange={(e) => setFormData(prev => ({ ...prev, store_description: e.target.value }))}
                placeholder="Descreva sua loja..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp_number">WhatsApp para Contato</Label>
              <Input
                id="whatsapp_number"
                value={formData.whatsapp_number}
                onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_number: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
              <p className="text-xs text-muted-foreground">
                Os clientes poderão entrar em contato via WhatsApp para comprar
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="primary_color" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Cor Principal
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="primary_color"
                  value={formData.primary_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                  className="w-10 h-10 rounded border cursor-pointer"
                />
                <Input
                  value={formData.primary_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                  className="w-28"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Product Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
            <CardDescription>Configure quais produtos aparecerão no catálogo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Exibir meus próprios produtos</Label>
                <p className="text-sm text-muted-foreground">
                  Seus produtos com estoque disponível aparecerão na loja
                </p>
              </div>
              <Switch
                checked={formData.show_own_products}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, show_own_products: checked }))}
              />
            </div>

            {userGroups.length > 0 && (
              <div className="space-y-2">
                <Label>Exibir produtos de parcerias</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Selecione as parcerias cujos produtos você quer exibir
                </p>
                <div className="space-y-2">
                  {userGroups.map(group => (
                    <div key={group.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`group-${group.id}`}
                        checked={selectedGroups.includes(group.id)}
                        onCheckedChange={() => handleToggleGroup(group.id)}
                      />
                      <Label htmlFor={`group-${group.id}`} className="cursor-pointer">
                        {group.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle>Status da Loja</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label>Loja Ativa</Label>
                <p className="text-sm text-muted-foreground">
                  Quando desativada, a loja não estará acessível publicamente
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={() => saveMutation.mutate()}
            disabled={!formData.store_slug || !formData.store_name || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
