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
import { ExternalLink, Copy, Store, Palette, Upload, X, ImageIcon, Sparkles, Link2, Type } from "lucide-react";

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
  background_color: string | null;
  card_background_color: string | null;
  banner_link: string | null;
  is_banner_visible: boolean;
  banner_height_mobile: string | null;
  font_heading: string | null;
  font_body: string | null;
  custom_font_url: string | null;
  custom_font_name: string | null;
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
  const bannerInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    store_slug: "",
    store_name: "",
    store_description: "",
    whatsapp_number: "",
    show_own_products: true,
    is_active: true,
    primary_color: "#8B5CF6",
    background_color: "#fafaf9",
    card_background_color: "#ffffff",
    banner_link: "",
    is_banner_visible: false,
    banner_height_mobile: "150px",
    font_heading: "Inter",
    font_body: "Inter",
    custom_font_name: "",
  });
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [customFontUrl, setCustomFontUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingFont, setUploadingFont] = useState(false);
  const fontInputRef = useRef<HTMLInputElement>(null);

  // Available Google Fonts
  const availableFonts = [
    "Inter",
    "Roboto", 
    "Open Sans",
    "Montserrat",
    "Poppins",
    "Playfair Display",
    "Lora",
    "Raleway",
    "Oswald",
    "Bebas Neue",
    "Dancing Script",
    "Pacifico",
    "Great Vibes",
    "Fonte Personalizada"
  ];

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
        background_color: storeSettings.background_color || "#fafaf9",
        card_background_color: storeSettings.card_background_color || "#ffffff",
        banner_link: storeSettings.banner_link || "",
        is_banner_visible: storeSettings.is_banner_visible ?? false,
        banner_height_mobile: storeSettings.banner_height_mobile || "150px",
        font_heading: storeSettings.font_heading || "Inter",
        font_body: storeSettings.font_body || "Inter",
        custom_font_name: storeSettings.custom_font_name || "",
      });
      setLogoUrl(storeSettings.logo_url);
      setBannerUrl(storeSettings.banner_url);
      setCustomFontUrl(storeSettings.custom_font_url);
    }
  }, [storeSettings]);

  // Handle banner upload
  const handleBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    setUploadingBanner(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user!.id}/banner-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("store-banners")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from("store-banners")
        .getPublicUrl(fileName);

      setBannerUrl(publicUrl.publicUrl);

      // Update in database if store exists
      if (storeSettings?.id) {
        await supabase
          .from("store_settings")
          .update({ banner_url: publicUrl.publicUrl })
          .eq("id", storeSettings.id);
        queryClient.invalidateQueries({ queryKey: ["my-store-settings"] });
      }

      toast.success("Banner enviado com sucesso!");
    } catch (error) {
      console.error("Error uploading banner:", error);
      toast.error("Erro ao enviar banner");
    } finally {
      setUploadingBanner(false);
    }
  };

  const removeBanner = async () => {
    setBannerUrl(null);
    if (storeSettings?.id) {
      await supabase
        .from("store_settings")
        .update({ banner_url: null })
        .eq("id", storeSettings.id);
      queryClient.invalidateQueries({ queryKey: ["my-store-settings"] });
    }
  };

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

  // Handle custom font upload
  const handleFontUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['.ttf', '.otf', '.woff', '.woff2'];
    const fileExt = file.name.split(".").pop()?.toLowerCase();
    if (!fileExt || !allowedTypes.includes(`.${fileExt}`)) {
      toast.error("Por favor, selecione um arquivo de fonte válido (TTF, OTF, WOFF, WOFF2)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 5MB");
      return;
    }

    setUploadingFont(true);

    try {
      const fontName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "");
      const fileName = `${user!.id}/font-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("store-fonts")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from("store-fonts")
        .getPublicUrl(fileName);

      setCustomFontUrl(publicUrl.publicUrl);
      setFormData(prev => ({ ...prev, custom_font_name: fontName }));

      toast.success(`Fonte "${fontName}" enviada com sucesso!`);
    } catch (error) {
      console.error("Error uploading font:", error);
      toast.error("Erro ao enviar fonte");
    } finally {
      setUploadingFont(false);
    }
  };

  const removeCustomFont = async () => {
    setCustomFontUrl(null);
    setFormData(prev => ({ ...prev, custom_font_name: "" }));
    if (storeSettings?.id) {
      await supabase
        .from("store_settings")
        .update({ custom_font_url: null, custom_font_name: null })
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
      const fontData = {
        font_heading: formData.font_heading === "Fonte Personalizada" 
          ? (formData.custom_font_name || "Inter") 
          : formData.font_heading,
        font_body: formData.font_body === "Fonte Personalizada"
          ? (formData.custom_font_name || "Inter")
          : formData.font_body,
        custom_font_url: customFontUrl,
        custom_font_name: formData.custom_font_name || null,
      };

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
            background_color: formData.background_color,
            card_background_color: formData.card_background_color,
            banner_link: formData.banner_link || null,
            is_banner_visible: formData.is_banner_visible,
            banner_height_mobile: formData.banner_height_mobile,
            ...fontData,
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
            background_color: formData.background_color,
            card_background_color: formData.card_background_color,
            banner_link: formData.banner_link || null,
            is_banner_visible: formData.is_banner_visible,
            banner_height_mobile: formData.banner_height_mobile,
            ...fontData,
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

  const storeUrl = `https://www.vendaprofit.com.br/${formData.store_slug}`;

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
                    className="w-24 h-24 object-cover rounded-full border-2 border-primary/20 bg-muted shadow-md"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-1 -right-1 h-6 w-6 rounded-full"
                    onClick={removeLogo}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="w-24 h-24 border-2 border-dashed rounded-full flex items-center justify-center bg-muted/50">
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

        {/* Visual Customization & Banner */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Personalização Visual & Banner
            </CardTitle>
            <CardDescription>
              Personalize as cores e adicione um banner promocional à sua loja
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Banner Section */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Banner Promocional
              </h4>
              <p className="text-sm text-muted-foreground">
                📱 Formato ideal para mobile: retangular horizontal (ex: 1200x300px)
              </p>
              
              <div className="space-y-4">
                {bannerUrl ? (
                  <div className="relative">
                    <img
                      src={bannerUrl}
                      alt="Banner promocional"
                      className="w-full h-32 object-cover rounded-lg border shadow-sm"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8 rounded-full"
                      onClick={removeBanner}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="w-full h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/30">
                    <div className="text-center">
                      <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhum banner configurado</p>
                    </div>
                  </div>
                )}
                
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBannerUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => bannerInputRef.current?.click()}
                    disabled={uploadingBanner}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadingBanner ? "Enviando..." : "Enviar Banner"}
                  </Button>
                  <p className="text-xs text-muted-foreground">PNG, JPG ou WebP. Máximo 5MB.</p>
                </div>

                {/* Banner Visibility Toggle */}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <Label className="font-medium">Exibir Banner</Label>
                    <p className="text-sm text-muted-foreground">
                      Ative para mostrar o banner na sua loja
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_banner_visible}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_banner_visible: checked }))}
                  />
                </div>

                {/* Banner Link */}
                <div className="space-y-2">
                  <Label htmlFor="banner_link" className="flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Link do Banner (opcional)
                  </Label>
                  <Input
                    id="banner_link"
                    value={formData.banner_link}
                    onChange={(e) => setFormData(prev => ({ ...prev, banner_link: e.target.value }))}
                    placeholder="https://..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Se preenchido, o banner será clicável e abrirá este link
                  </p>
                </div>

                {/* Banner Height Mobile */}
                <div className="space-y-2">
                  <Label htmlFor="banner_height_mobile">Altura do Banner (Mobile)</Label>
                  <Input
                    id="banner_height_mobile"
                    value={formData.banner_height_mobile}
                    onChange={(e) => setFormData(prev => ({ ...prev, banner_height_mobile: e.target.value }))}
                    placeholder="150px"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ex: 150px, 200px. Define a altura do banner em dispositivos móveis.
                  </p>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t pt-6">
              <h4 className="font-medium flex items-center gap-2 mb-4">
                <Palette className="h-4 w-4" />
                Cores da Loja
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Primary Color */}
                <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                  <Label htmlFor="primary_color_picker" className="font-medium">
                    Cor Primária (Botões e Destaques)
                  </Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      id="primary_color_picker"
                      value={formData.primary_color}
                      onChange={(e) => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                      className="w-12 h-12 rounded-lg border-2 cursor-pointer shadow-sm"
                    />
                    <div className="flex-1">
                      <Input
                        value={formData.primary_color}
                        onChange={(e) => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <div 
                    className="h-8 rounded-md mt-2 flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: formData.primary_color }}
                  >
                    Preview do Botão
                  </div>
                </div>

                {/* Background Color */}
                <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                  <Label htmlFor="background_color_picker" className="font-medium">
                    Cor de Fundo da Página
                  </Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      id="background_color_picker"
                      value={formData.background_color}
                      onChange={(e) => setFormData(prev => ({ ...prev, background_color: e.target.value }))}
                      className="w-12 h-12 rounded-lg border-2 cursor-pointer shadow-sm"
                    />
                    <div className="flex-1">
                      <Input
                        value={formData.background_color}
                        onChange={(e) => setFormData(prev => ({ ...prev, background_color: e.target.value }))}
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <div 
                    className="h-8 rounded-md mt-2 border flex items-center justify-center text-xs"
                    style={{ backgroundColor: formData.background_color }}
                  >
                    Preview do Fundo
                  </div>
                </div>

                {/* Card Background Color */}
                <div className="space-y-2 p-4 bg-muted/30 rounded-lg md:col-span-2">
                  <Label htmlFor="card_background_color_picker" className="font-medium">
                    Cor de Fundo dos Cards de Produto
                  </Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      id="card_background_color_picker"
                      value={formData.card_background_color}
                      onChange={(e) => setFormData(prev => ({ ...prev, card_background_color: e.target.value }))}
                      className="w-12 h-12 rounded-lg border-2 cursor-pointer shadow-sm"
                    />
                    <div className="flex-1 max-w-xs">
                      <Input
                        value={formData.card_background_color}
                        onChange={(e) => setFormData(prev => ({ ...prev, card_background_color: e.target.value }))}
                        className="font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Font Section */}
            <div className="border-t pt-6">
              <h4 className="font-medium flex items-center gap-2 mb-4">
                <Type className="h-4 w-4" />
                Tipografia
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Heading Font */}
                <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                  <Label htmlFor="font_heading" className="font-medium">
                    Fonte dos Títulos
                  </Label>
                  <select
                    id="font_heading"
                    value={formData.font_heading}
                    onChange={(e) => setFormData(prev => ({ ...prev, font_heading: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {availableFonts.map(font => (
                      <option key={font} value={font}>{font}</option>
                    ))}
                  </select>
                </div>

                {/* Body Font */}
                <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                  <Label htmlFor="font_body" className="font-medium">
                    Fonte do Corpo
                  </Label>
                  <select
                    id="font_body"
                    value={formData.font_body}
                    onChange={(e) => setFormData(prev => ({ ...prev, font_body: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {availableFonts.map(font => (
                      <option key={font} value={font}>{font}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Custom Font Upload */}
              {(formData.font_heading === "Fonte Personalizada" || formData.font_body === "Fonte Personalizada") && (
                <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <Label className="font-medium text-amber-900 flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Fonte Personalizada (TTF, OTF, WOFF)
                  </Label>
                  
                  {customFontUrl && formData.custom_font_name ? (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1 p-3 bg-white rounded-lg border">
                        <p className="font-medium text-sm">{formData.custom_font_name}</p>
                        <p className="text-xs text-muted-foreground">Fonte carregada com sucesso</p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={removeCustomFont}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <input
                        ref={fontInputRef}
                        type="file"
                        accept=".ttf,.otf,.woff,.woff2"
                        onChange={handleFontUpload}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        onClick={() => fontInputRef.current?.click()}
                        disabled={uploadingFont}
                        className="w-full"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadingFont ? "Enviando..." : "Enviar Arquivo de Fonte"}
                      </Button>
                      <p className="text-xs text-amber-700">
                        Formatos aceitos: TTF, OTF, WOFF, WOFF2. Máximo 5MB.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
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
                  <span className="text-sm text-muted-foreground">/</span>
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
              <Label htmlFor="store_description">Descrição (Exibida em Bullet Points)</Label>
              <Textarea
                id="store_description"
                value={formData.store_description}
                onChange={(e) => setFormData(prev => ({ ...prev, store_description: e.target.value }))}
                placeholder="Cada linha será um bullet point&#10;Exemplo: Moda fitness de alta qualidade&#10;Envio para todo o Brasil&#10;Trocas em até 30 dias"
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                💡 Cada linha será exibida como um bullet point abaixo da logo. Use para destacar diferenciais da sua loja.
              </p>
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
