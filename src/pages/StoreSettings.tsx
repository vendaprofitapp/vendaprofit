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
import { ExternalLink, Copy, Store, Palette, Upload, X, ImageIcon, Link2, Type, Flame, Clock, Rocket, GripVertical, Filter, Layers, Video, Lock, Eye, EyeOff, Plus, Trash2, Gift, Truck, Star, Crown, CreditCard } from "lucide-react";
import { VideoUploader } from "@/components/admin/VideoUploader";
import { cn } from "@/lib/utils";
import { type PurchaseIncentivesConfig, type IncentiveTier, defaultIncentivesConfig } from "@/components/catalog/PurchaseIncentives";

// Filter button configuration type
interface FilterButtonConfig {
  visible: boolean;
  color: string;
  order: number;
  label: string;
}

interface FilterButtonsConfig {
  categories: FilterButtonConfig;
  opportunity: FilterButtonConfig;
  presale: FilterButtonConfig;
  launch: FilterButtonConfig;
}

const defaultFilterButtonsConfig: FilterButtonsConfig = {
  categories: { visible: true, color: "#1f2937", order: 0, label: "Categorias" },
  opportunity: { visible: true, color: "#f97316", order: 1, label: "Oportunidades" },
  presale: { visible: true, color: "#a855f7", order: 2, label: "Pré-venda" },
  launch: { visible: true, color: "#22c55e", order: 3, label: "Lançamentos" },
};

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
  logo_position: string | null;
  logo_size: string | null;
  banner_url: string | null;
  banner_url_mobile: string | null;
  primary_color: string | null;
  background_color: string | null;
  card_background_color: string | null;
  banner_link: string | null;
  is_banner_visible: boolean;
  banner_height_mobile: string | null;
  banner_height_desktop: string | null;
  font_heading: string | null;
  font_body: string | null;
  custom_font_url: string | null;
  custom_font_name: string | null;
  show_opportunities_button: boolean;
  opportunities_button_text: string | null;
  opportunities_button_color: string | null;
  show_store_url: boolean;
  show_store_description: boolean;
  custom_domain: string | null;
  filter_buttons_config: FilterButtonsConfig | null;
  bio_video_preview: string | null;
  bio_video_full: string | null;
  secret_area_active: boolean | null;
  secret_area_name: string | null;
  secret_area_password: string | null;
  purchase_incentives_config: PurchaseIncentivesConfig | null;
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
    banner_height_desktop: "120px",
    font_heading: "Inter",
    font_body: "Inter",
    custom_font_name: "",
    show_opportunities_button: true,
    opportunities_button_text: "OPORTUNIDADES",
    opportunities_button_color: "#f97316",
    logo_position: "center",
    logo_size: "medium",
    show_store_url: true,
    show_store_description: true,
    custom_domain: "",
    filter_buttons_config: defaultFilterButtonsConfig,
    secret_area_active: false,
    secret_area_name: "Área VIP",
    secret_area_password: "",
    purchase_incentives_config: defaultIncentivesConfig,
  });
  const [draggedButton, setDraggedButton] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [bannerUrlMobile, setBannerUrlMobile] = useState<string | null>(null);
  const [customFontUrl, setCustomFontUrl] = useState<string | null>(null);
  const [bioVideoPreview, setBioVideoPreview] = useState<string | null>(null);
  const [bioVideoFull, setBioVideoFull] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingBannerMobile, setUploadingBannerMobile] = useState(false);
  const [uploadingFont, setUploadingFont] = useState(false);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const bannerMobileInputRef = useRef<HTMLInputElement>(null);

  // Available Google Fonts
  const availableFonts = [
    { name: "Inter", category: "Sans-serif" },
    { name: "Roboto", category: "Sans-serif" },
    { name: "Open Sans", category: "Sans-serif" },
    { name: "Montserrat", category: "Sans-serif" },
    { name: "Poppins", category: "Sans-serif" },
    { name: "Playfair Display", category: "Serif" },
    { name: "Lora", category: "Serif" },
    { name: "Raleway", category: "Sans-serif" },
    { name: "Oswald", category: "Sans-serif" },
    { name: "Bebas Neue", category: "Display" },
    { name: "Dancing Script", category: "Script" },
    { name: "Pacifico", category: "Script" },
    { name: "Great Vibes", category: "Script" },
  ];

  // Google Fonts to load for preview
  const googleFontsForPreview = availableFonts.map(f => f.name).filter(f => f !== "Inter");

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
      if (!data) return null;
      
      // Parse configs from JSON
      const result = {
        ...data,
        filter_buttons_config: (data.filter_buttons_config as unknown as FilterButtonsConfig) || defaultFilterButtonsConfig,
        purchase_incentives_config: (data.purchase_incentives_config as unknown as PurchaseIncentivesConfig) || defaultIncentivesConfig,
      };
      return result as StoreSettings;
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
        banner_height_desktop: storeSettings.banner_height_desktop || "120px",
        font_heading: storeSettings.font_heading || "Inter",
        font_body: storeSettings.font_body || "Inter",
        custom_font_name: storeSettings.custom_font_name || "",
        show_opportunities_button: storeSettings.show_opportunities_button ?? true,
        opportunities_button_text: storeSettings.opportunities_button_text || "OPORTUNIDADES",
        opportunities_button_color: storeSettings.opportunities_button_color || "#f97316",
        logo_position: storeSettings.logo_position || "center",
        logo_size: storeSettings.logo_size || "medium",
        show_store_url: storeSettings.show_store_url ?? true,
        show_store_description: storeSettings.show_store_description ?? true,
        custom_domain: storeSettings.custom_domain || "",
        filter_buttons_config: storeSettings.filter_buttons_config || defaultFilterButtonsConfig,
        secret_area_active: storeSettings.secret_area_active ?? false,
        secret_area_name: storeSettings.secret_area_name || "Área VIP",
        secret_area_password: storeSettings.secret_area_password || "",
        purchase_incentives_config: (storeSettings.purchase_incentives_config as unknown as PurchaseIncentivesConfig) || defaultIncentivesConfig,
      });
      setLogoUrl(storeSettings.logo_url);
      setBannerUrl(storeSettings.banner_url);
      setBannerUrlMobile(storeSettings.banner_url_mobile);
      setCustomFontUrl(storeSettings.custom_font_url);
      setBioVideoPreview(storeSettings.bio_video_preview);
      setBioVideoFull(storeSettings.bio_video_full);
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

  // Handle mobile banner upload
  const handleBannerMobileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

    setUploadingBannerMobile(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user!.id}/banner-mobile-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("store-banners")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from("store-banners")
        .getPublicUrl(fileName);

      setBannerUrlMobile(publicUrl.publicUrl);

      // Update in database if store exists
      if (storeSettings?.id) {
        await supabase
          .from("store_settings")
          .update({ banner_url_mobile: publicUrl.publicUrl })
          .eq("id", storeSettings.id);
        queryClient.invalidateQueries({ queryKey: ["my-store-settings"] });
      }

      toast.success("Banner mobile enviado com sucesso!");
    } catch (error) {
      console.error("Error uploading mobile banner:", error);
      toast.error("Erro ao enviar banner mobile");
    } finally {
      setUploadingBannerMobile(false);
    }
  };

  const removeBannerMobile = async () => {
    setBannerUrlMobile(null);
    if (storeSettings?.id) {
      await supabase
        .from("store_settings")
        .update({ banner_url_mobile: null })
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
            banner_height_desktop: formData.banner_height_desktop,
            show_opportunities_button: formData.show_opportunities_button,
            opportunities_button_text: formData.opportunities_button_text || null,
            opportunities_button_color: formData.opportunities_button_color,
            logo_position: formData.logo_position,
            logo_size: formData.logo_size,
            show_store_url: formData.show_store_url,
            show_store_description: formData.show_store_description,
            custom_domain: formData.custom_domain || null,
            filter_buttons_config: JSON.parse(JSON.stringify(formData.filter_buttons_config)),
            bio_video_preview: bioVideoPreview,
            bio_video_full: bioVideoFull,
            secret_area_active: formData.secret_area_active,
            secret_area_name: formData.secret_area_name || null,
            secret_area_password: formData.secret_area_password || null,
            purchase_incentives_config: JSON.parse(JSON.stringify(formData.purchase_incentives_config)),
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
            banner_height_desktop: formData.banner_height_desktop,
            show_opportunities_button: formData.show_opportunities_button,
            opportunities_button_text: formData.opportunities_button_text || null,
            opportunities_button_color: formData.opportunities_button_color,
            logo_position: formData.logo_position,
            logo_size: formData.logo_size,
            show_store_url: formData.show_store_url,
            show_store_description: formData.show_store_description,
            custom_domain: formData.custom_domain || null,
            filter_buttons_config: JSON.parse(JSON.stringify(formData.filter_buttons_config)),
            bio_video_preview: bioVideoPreview,
            bio_video_full: bioVideoFull,
            secret_area_active: formData.secret_area_active,
            secret_area_name: formData.secret_area_name || null,
            secret_area_password: formData.secret_area_password || null,
            purchase_incentives_config: JSON.parse(JSON.stringify(formData.purchase_incentives_config)),
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

  // Prioriza domínio personalizado, depois usa o padrão
  const getBaseUrl = () => {
    if (formData.custom_domain) {
      const domain = formData.custom_domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      return `https://${domain}`;
    }
    return "https://vendaprofit.com.br";
  };

  const storeUrl = `${getBaseUrl()}/${formData.store_slug}`;

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

        {/* 0 - Status da Loja */}
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

        {/* 1 - Link da sua loja */}
        {formData.store_slug && (
          <Card className="border-2 border-green-500/30 bg-green-50/50 dark:bg-green-950/20">
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

        {/* 2 - Informações Básicas (URL + WhatsApp) */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
            <CardDescription>URL da loja e contato</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

        {/* 3 - Produtos */}
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

        {/* 4 - Logomarca */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Logomarca
            </CardTitle>
            <CardDescription>Adicione a logo da sua loja - aceita qualquer formato e tamanho</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-start gap-4">
              {logoUrl ? (
                <div className="relative flex-shrink-0">
                  <img
                    src={logoUrl}
                    alt="Logo da loja"
                    className="max-w-32 max-h-32 object-contain border-2 border-primary/20 bg-muted shadow-md rounded-lg"
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
                <div className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/50 flex-shrink-0">
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
                  <p className="text-green-600 font-medium">✓ Formato livre: redonda, quadrada ou retangular</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-3">
                <Label className="font-medium">Posição da Logo</Label>
                <div className="flex gap-2">
                  {[
                    { value: 'left', label: '← Esquerda' },
                    { value: 'center', label: 'Centro' },
                    { value: 'right', label: 'Direita →' },
                  ].map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, logo_position: option.value }))}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-all ${
                        formData.logo_position === option.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/50 hover:bg-muted border-border'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="font-medium">Tamanho da Logo</Label>
                <div className="flex gap-2">
                  {[
                    { value: 'small', label: 'Pequena' },
                    { value: 'medium', label: 'Média' },
                    { value: 'large', label: 'Grande' },
                  ].map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, logo_size: option.value }))}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-all ${
                        formData.logo_size === option.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/50 hover:bg-muted border-border'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 5 - Botões de Filtro */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Botões de Filtro
            </CardTitle>
            <CardDescription>
              Configure cores, ordem e visibilidade dos botões de filtro na sua loja
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label className="font-medium flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Arraste para reordenar
              </Label>
              <p className="text-xs text-muted-foreground">
                A ordem dos botões na lista abaixo será a ordem exibida na loja
              </p>
              
              <div className="space-y-2">
                {([...["categories", "opportunity", "presale", "launch"]] as ("categories" | "opportunity" | "presale" | "launch")[])
                  .sort((a, b) => formData.filter_buttons_config[a].order - formData.filter_buttons_config[b].order)
                  .map((buttonKey) => {
                    const config = formData.filter_buttons_config[buttonKey];
                    const icons: Record<string, typeof Flame> = {
                      categories: Layers,
                      opportunity: Flame,
                      presale: Clock,
                      launch: Rocket,
                    };
                    const Icon = icons[buttonKey];

                    return (
                      <div
                        key={buttonKey}
                        draggable
                        onDragStart={() => setDraggedButton(buttonKey)}
                        onDragEnd={() => setDraggedButton(null)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (draggedButton && draggedButton !== buttonKey) {
                            const draggedOrder = formData.filter_buttons_config[draggedButton as keyof FilterButtonsConfig].order;
                            const targetOrder = config.order;
                            
                            setFormData(prev => ({
                              ...prev,
                              filter_buttons_config: {
                                ...prev.filter_buttons_config,
                                [draggedButton]: { 
                                  ...prev.filter_buttons_config[draggedButton as keyof FilterButtonsConfig], 
                                  order: targetOrder 
                                },
                                [buttonKey]: { 
                                  ...prev.filter_buttons_config[buttonKey], 
                                  order: draggedOrder 
                                },
                              }
                            }));
                          }
                        }}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-grab active:cursor-grabbing",
                          draggedButton === buttonKey 
                            ? "border-primary bg-primary/5 opacity-50" 
                            : "border-border bg-background hover:border-primary/30"
                        )}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        
                        <input
                          type="color"
                          value={config.color}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            filter_buttons_config: {
                              ...prev.filter_buttons_config,
                              [buttonKey]: { ...config, color: e.target.value }
                            }
                          }))}
                          className="w-8 h-8 rounded cursor-pointer border border-border flex-shrink-0"
                        />
                        
                        <div 
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
                          style={{ 
                            backgroundColor: config.visible ? `${config.color}15` : '#f3f4f6',
                            color: config.visible ? config.color : '#9ca3af'
                          }}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span>{config.label}</span>
                        </div>

                        <Input
                          value={config.label}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            filter_buttons_config: {
                              ...prev.filter_buttons_config,
                              [buttonKey]: { ...config, label: e.target.value }
                            }
                          }))}
                          className="w-32 h-8 text-sm"
                          placeholder="Rótulo"
                        />
                        
                        <Switch
                          checked={config.visible}
                          onCheckedChange={(checked) => setFormData(prev => ({
                            ...prev,
                            filter_buttons_config: {
                              ...prev.filter_buttons_config,
                              [buttonKey]: { ...config, visible: checked }
                            }
                          }))}
                        />
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="border-t pt-4">
              <Label className="font-medium mb-3 block">Prévia dos Botões</Label>
              <div className="flex flex-wrap gap-2 justify-center p-4 bg-muted/30 rounded-lg">
                {([...["categories", "opportunity", "presale", "launch"]] as ("categories" | "opportunity" | "presale" | "launch")[])
                  .filter(k => formData.filter_buttons_config[k].visible)
                  .sort((a, b) => formData.filter_buttons_config[a].order - formData.filter_buttons_config[b].order)
                  .map((buttonKey) => {
                    const config = formData.filter_buttons_config[buttonKey];
                    const icons: Record<string, typeof Flame> = {
                      categories: Layers,
                      opportunity: Flame,
                      presale: Clock,
                      launch: Rocket,
                    };
                    const Icon = icons[buttonKey];

                    return (
                      <button
                        key={buttonKey}
                        type="button"
                        className="px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5"
                        style={{ 
                          backgroundColor: `${config.color}15`,
                          color: config.color
                        }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {config.label}
                      </button>
                    );
                  })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 6 - Banner */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              Banner
            </CardTitle>
            <CardDescription>
              Adicione banners promocionais à sua loja
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Configure imagens diferentes para desktop e mobile para exibição 100% correta em cada dispositivo.
            </p>
            
            {/* Desktop Banner */}
            <div className="space-y-3 p-4 bg-muted/20 rounded-lg border">
              <Label className="font-medium flex items-center gap-2">
                🖥️ Banner Desktop
                <span className="text-xs text-muted-foreground font-normal">(Recomendado: 1920x400px)</span>
              </Label>
              
              {bannerUrl ? (
                <div className="relative">
                  <img
                    src={bannerUrl}
                    alt="Banner desktop"
                    className="w-full h-24 object-cover rounded-lg border shadow-sm"
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
                <div className="w-full h-24 border-2 border-dashed rounded-lg flex items-center justify-center bg-background">
                  <p className="text-sm text-muted-foreground">Nenhum banner desktop</p>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBannerUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={uploadingBanner}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingBanner ? "Enviando..." : "Enviar Desktop"}
                </Button>
              </div>
            </div>

            {/* Mobile Banner */}
            <div className="space-y-3 p-4 bg-muted/20 rounded-lg border">
              <Label className="font-medium flex items-center gap-2">
                📱 Banner Mobile
                <span className="text-xs text-muted-foreground font-normal">(Recomendado: 800x400px)</span>
              </Label>
              
              {bannerUrlMobile ? (
                <div className="relative">
                  <img
                    src={bannerUrlMobile}
                    alt="Banner mobile"
                    className="w-full h-32 object-cover rounded-lg border shadow-sm"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 rounded-full"
                    onClick={removeBannerMobile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="w-full h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-background">
                  <p className="text-sm text-muted-foreground">Nenhum banner mobile</p>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <input
                  ref={bannerMobileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBannerMobileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => bannerMobileInputRef.current?.click()}
                  disabled={uploadingBannerMobile}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingBannerMobile ? "Enviando..." : "Enviar Mobile"}
                </Button>
              </div>
            </div>

            {/* Banner Visibility Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <Label className="font-medium">Exibir Banners</Label>
                <p className="text-sm text-muted-foreground">
                  Ative para mostrar os banners na sua loja
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
                Se preenchido, os banners serão clicáveis
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 7 - Cores da Loja */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Cores da Loja
            </CardTitle>
            <CardDescription>Personalize as cores da sua loja</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>

        {/* 8 - Tipografia */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5" />
              Tipografia
            </CardTitle>
            <CardDescription>Escolha as fontes da sua loja</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Google Fonts Loader for Preview */}
            <link
              rel="stylesheet"
              href={`https://fonts.googleapis.com/css2?${googleFontsForPreview.map(f => `family=${f.replace(/\s+/g, '+')}:wght@400;600`).join('&')}&display=swap`}
            />
            
            {/* Heading Font */}
            <div className="space-y-3">
              <Label className="font-medium">Fonte dos Títulos</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {availableFonts.map(font => (
                  <button
                    key={font.name}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, font_heading: font.name }))}
                    className={cn(
                      "p-3 rounded-lg border-2 transition-all text-left hover:border-primary/50",
                      formData.font_heading === font.name
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background"
                    )}
                  >
                    <span 
                      className="text-lg font-semibold block truncate"
                      style={{ fontFamily: font.name }}
                    >
                      Título
                    </span>
                    <span className="text-xs text-muted-foreground">{font.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Body Font */}
            <div className="space-y-3">
              <Label className="font-medium">Fonte do Corpo</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {availableFonts.map(font => (
                  <button
                    key={font.name}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, font_body: font.name }))}
                    className={cn(
                      "p-3 rounded-lg border-2 transition-all text-left hover:border-primary/50",
                      formData.font_body === font.name
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background"
                    )}
                  >
                    <span 
                      className="text-sm block truncate"
                      style={{ fontFamily: font.name }}
                    >
                      Texto exemplo
                    </span>
                    <span className="text-xs text-muted-foreground">{font.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 9 - Área Secreta / VIP */}
        <Card className="border-2 border-rose-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-rose-500" />
              Área Secreta / VIP
            </CardTitle>
            <CardDescription>
              Crie uma área exclusiva para produtos especiais. Produtos marcados como "Secreto" só ficam visíveis para quem tem a senha.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-rose-50 dark:bg-rose-950/20 rounded-lg">
              <div className="space-y-0.5">
                <Label className="font-medium flex items-center gap-2">
                  <Lock className="h-4 w-4 text-rose-500" />
                  Ativar Área Secreta na Loja
                </Label>
                <p className="text-sm text-muted-foreground">
                  Quando ativada, um botão aparecerá na loja para acessar produtos exclusivos
                </p>
              </div>
              <Switch
                checked={formData.secret_area_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, secret_area_active: checked }))}
              />
            </div>

            {formData.secret_area_active && (
              <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="secret_area_name" className="font-medium">
                      Nome do Botão
                    </Label>
                    <Input
                      id="secret_area_name"
                      value={formData.secret_area_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, secret_area_name: e.target.value }))}
                      placeholder="Área VIP"
                    />
                    <p className="text-xs text-muted-foreground">
                      Ex: "Clube VIP", "Exclusivo", "Área Secreta"
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secret_area_password" className="font-medium">
                      Senha de Acesso
                    </Label>
                    <div className="relative">
                      <Input
                        id="secret_area_password"
                        type={showPassword ? "text" : "password"}
                        value={formData.secret_area_password}
                        onChange={(e) => setFormData(prev => ({ ...prev, secret_area_password: e.target.value }))}
                        placeholder="Digite a senha..."
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Ex: VIP2024, EXCLUSIVO, sua senha personalizada
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-muted/30 rounded-lg border">
                  <Label className="font-medium mb-3 block">Prévia do Botão</Label>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      {formData.secret_area_name || "Área VIP"}
                    </button>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">💡 Como funciona:</p>
                  <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                    <li>• Marque produtos como "Secreto" 🔒 no seletor de marketing (ao editar produto/variação)</li>
                    <li>• Produtos secretos ficam invisíveis na listagem principal da loja</li>
                    <li>• O cliente clica no botão, digita a senha e vê os produtos exclusivos</li>
                    <li>• Use para clientes VIP, promoções secretas ou lançamentos exclusivos</li>
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 10 - Incentivos de Compra */}
        <Card className="border-2 border-emerald-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-500" />
              Incentivos de Compra
            </CardTitle>
            <CardDescription>
              Configure parcelamento, desconto PIX e faixas de benefícios para seus clientes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
              <div className="space-y-0.5">
                <Label className="font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-500" />
                  Ativar Incentivos de Compra
                </Label>
                <p className="text-sm text-muted-foreground">
                  Mostra parcelamento, PIX e barra de progresso no carrinho
                </p>
              </div>
              <Switch
                checked={formData.purchase_incentives_config.enabled}
                onCheckedChange={(checked) => setFormData(prev => ({
                  ...prev,
                  purchase_incentives_config: { ...prev.purchase_incentives_config, enabled: checked }
                }))}
              />
            </div>

            {formData.purchase_incentives_config.enabled && (
              <div className="space-y-6 animate-in slide-in-from-top-2 duration-200">
                {/* Installments Config */}
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">💳 Parcelamento</Label>
                    <Switch
                      checked={formData.purchase_incentives_config.installments.enabled}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        purchase_incentives_config: {
                          ...prev.purchase_incentives_config,
                          installments: { ...prev.purchase_incentives_config.installments, enabled: checked }
                        }
                      }))}
                    />
                  </div>
                  {formData.purchase_incentives_config.installments.enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Máx. parcelas</Label>
                        <Input
                          type="number"
                          min={2}
                          max={12}
                          value={formData.purchase_incentives_config.installments.max_installments}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            purchase_incentives_config: {
                              ...prev.purchase_incentives_config,
                              installments: { ...prev.purchase_incentives_config.installments, max_installments: parseInt(e.target.value) || 3 }
                            }
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Valor mín. por parcela (R$)</Label>
                        <Input
                          type="number"
                          min={1}
                          value={formData.purchase_incentives_config.installments.min_amount_per_installment}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            purchase_incentives_config: {
                              ...prev.purchase_incentives_config,
                              installments: { ...prev.purchase_incentives_config.installments, min_amount_per_installment: parseInt(e.target.value) || 30 }
                            }
                          }))}
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-5">
                        <Checkbox
                          checked={formData.purchase_incentives_config.installments.no_interest}
                          onCheckedChange={(checked) => setFormData(prev => ({
                            ...prev,
                            purchase_incentives_config: {
                              ...prev.purchase_incentives_config,
                              installments: { ...prev.purchase_incentives_config.installments, no_interest: !!checked }
                            }
                          }))}
                        />
                        <Label className="text-sm">Sem juros</Label>
                      </div>
                    </div>
                  )}
                </div>

                {/* PIX Discount Config */}
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">💰 Desconto PIX</Label>
                    <Switch
                      checked={formData.purchase_incentives_config.pix_discount.enabled}
                      onCheckedChange={(checked) => setFormData(prev => ({
                        ...prev,
                        purchase_incentives_config: {
                          ...prev.purchase_incentives_config,
                          pix_discount: { ...prev.purchase_incentives_config.pix_discount, enabled: checked }
                        }
                      }))}
                    />
                  </div>
                  {formData.purchase_incentives_config.pix_discount.enabled && (
                    <div className="space-y-2 max-w-xs">
                      <Label className="text-xs">Percentual de desconto (%)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={formData.purchase_incentives_config.pix_discount.discount_percent}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          purchase_incentives_config: {
                            ...prev.purchase_incentives_config,
                            pix_discount: { ...prev.purchase_incentives_config.pix_discount, discount_percent: parseInt(e.target.value) || 5 }
                          }
                        }))}
                      />
                    </div>
                  )}
                </div>

                {/* Tiers Config */}
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                  <Label className="font-medium">🎁 Faixas de Benefícios</Label>
                  <p className="text-xs text-muted-foreground">
                    Configure faixas de valor do carrinho e os benefícios correspondentes
                  </p>
                  
                  <div className="space-y-3">
                    {formData.purchase_incentives_config.tiers.map((tier, index) => {
                      const emojiOptions = [
                        { value: "truck", label: "🚚", Icon: Truck },
                        { value: "gift", label: "🎁", Icon: Gift },
                        { value: "star", label: "⭐", Icon: Star },
                        { value: "crown", label: "👑", Icon: Crown },
                      ];
                      
                      return (
                        <div key={index} className="flex items-center gap-2 p-3 bg-background rounded-lg border">
                          <select
                            value={tier.emoji}
                            onChange={(e) => {
                              const newTiers = [...formData.purchase_incentives_config.tiers];
                              newTiers[index] = { ...newTiers[index], emoji: e.target.value };
                              setFormData(prev => ({
                                ...prev,
                                purchase_incentives_config: { ...prev.purchase_incentives_config, tiers: newTiers }
                              }));
                            }}
                            className="w-16 h-9 rounded-md border border-input bg-background px-2 text-sm"
                          >
                            {emojiOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <div className="flex-shrink-0 w-24">
                            <Input
                              type="number"
                              min={1}
                              placeholder="R$"
                              value={tier.min_value}
                              onChange={(e) => {
                                const newTiers = [...formData.purchase_incentives_config.tiers];
                                newTiers[index] = { ...newTiers[index], min_value: parseInt(e.target.value) || 0 };
                                setFormData(prev => ({
                                  ...prev,
                                  purchase_incentives_config: { ...prev.purchase_incentives_config, tiers: newTiers }
                                }));
                              }}
                              className="h-9"
                            />
                          </div>
                          <Input
                            placeholder="Benefício"
                            value={tier.benefit}
                            onChange={(e) => {
                              const newTiers = [...formData.purchase_incentives_config.tiers];
                              newTiers[index] = { ...newTiers[index], benefit: e.target.value };
                              setFormData(prev => ({
                                ...prev,
                                purchase_incentives_config: { ...prev.purchase_incentives_config, tiers: newTiers }
                              }));
                            }}
                            className="h-9 flex-1"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive hover:text-destructive"
                            onClick={() => {
                              const newTiers = formData.purchase_incentives_config.tiers.filter((_, i) => i !== index);
                              setFormData(prev => ({
                                ...prev,
                                purchase_incentives_config: { ...prev.purchase_incentives_config, tiers: newTiers }
                              }));
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newTiers = [...formData.purchase_incentives_config.tiers, { min_value: 0, benefit: "", emoji: "gift" }];
                      setFormData(prev => ({
                        ...prev,
                        purchase_incentives_config: { ...prev.purchase_incentives_config, tiers: newTiers }
                      }));
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Faixa
                  </Button>
                </div>

                {/* Messages Config */}
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                  <Label className="font-medium">💬 Mensagens Personalizadas</Label>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Ao adicionar produto</Label>
                      <Input
                        value={formData.purchase_incentives_config.messages.on_add}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          purchase_incentives_config: {
                            ...prev.purchase_incentives_config,
                            messages: { ...prev.purchase_incentives_config.messages, on_add: e.target.value }
                          }
                        }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Perto do frete grátis <span className="text-emerald-500">(use {"${remaining}"} para o valor restante)</span>
                      </Label>
                      <Input
                        value={formData.purchase_incentives_config.messages.near_free_shipping}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          purchase_incentives_config: {
                            ...prev.purchase_incentives_config,
                            messages: { ...prev.purchase_incentives_config.messages, near_free_shipping: e.target.value }
                          }
                        }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Desbloqueou frete grátis</Label>
                      <Input
                        value={formData.purchase_incentives_config.messages.unlocked_free_shipping}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          purchase_incentives_config: {
                            ...prev.purchase_incentives_config,
                            messages: { ...prev.purchase_incentives_config.messages, unlocked_free_shipping: e.target.value }
                          }
                        }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Desbloqueou brinde</Label>
                      <Input
                        value={formData.purchase_incentives_config.messages.unlocked_gift}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          purchase_incentives_config: {
                            ...prev.purchase_incentives_config,
                            messages: { ...prev.purchase_incentives_config.messages, unlocked_gift: e.target.value }
                          }
                        }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 11 - Vídeo Vendedor */}
        <Card className="border-2 border-pink-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-pink-500" />
              Vídeo Vendedor (Bolinha Flutuante)
            </CardTitle>
            <CardDescription>
              Configure os vídeos que aparecerão na bolinha flutuante da sua loja. A bolinha só aparece se os vídeos estiverem configurados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <VideoUploader
                label="Vídeo da Bolinha (Preview - Mudo/Loop)"
                description="Vídeo curto que aparece na bolinha flutuante. Recomendado: até 10 segundos, formato quadrado."
                value={bioVideoPreview}
                onChange={setBioVideoPreview}
                maxSizeMB={10}
              />
              <VideoUploader
                label="Vídeo de Apresentação (Stories)"
                description="Vídeo completo exibido ao clicar na bolinha. Formato vertical (9:16) recomendado, estilo Stories."
                value={bioVideoFull}
                onChange={setBioVideoFull}
                maxSizeMB={50}
              />
            </div>
            
            <div className="bg-pink-50 dark:bg-pink-950/20 p-4 rounded-lg">
              <p className="text-sm font-medium text-pink-800 dark:text-pink-200 mb-2">💡 Dicas para seus vídeos:</p>
              <ul className="text-sm text-pink-700 dark:text-pink-300 space-y-1">
                <li>• Faça upload diretamente ou cole uma URL externa (MP4)</li>
                <li>• O vídeo da bolinha deve ser curto e chamar atenção (máx. 10MB)</li>
                <li>• O vídeo de apresentação pode ter até 60 segundos (máx. 50MB)</li>
                <li>• Fale diretamente com seu cliente, seja autêntico!</li>
              </ul>
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
