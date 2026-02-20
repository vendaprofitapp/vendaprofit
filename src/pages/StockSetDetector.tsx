import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, ArrowRight, CheckSquare, Square, ChevronDown,
  Package, Users, RefreshCw, Send, Sparkles, Info,
  ArrowLeftRight, Zap, ScanSearch, CheckCheck, X
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// --- Types ---
interface StockProduct {
  id: string;
  name: string;
  color_label: string | null;
  size: string | null;
  price: number;
  stock_quantity: number;
  image_url: string | null;
  main_category: string | null;
  subcategory: string | null;
  owner_id: string;
  product_variants: Array<{
    id: string;
    size: string;
    stock_quantity: number;
  }>;
}

interface SetMatch {
  myProduct: StockProduct & { variantId?: string; variantSize?: string };
  partnerProduct: StockProduct & { variantId?: string; variantSize?: string };
  matchType: "same_color_size" | "complementary_set";
  matchLabel: string;
}

type CompareMode = "own_vs_direct" | "own_vs_group";
type ScanMode = "manual" | "auto";

// Complementary subcategory pairs (sets)
const COMPLEMENTARY_PAIRS: Array<[string, string]> = [
  ["Top", "Shorts"],
  ["Top", "Calça"],
  ["Top", "Saia"],
  ["Blusa", "Shorts"],
  ["Blusa", "Calça"],
  ["Blusa", "Saia"],
  ["Camisa", "Shorts"],
  ["Camisa", "Calça"],
  ["Camisa", "Saia"],
  ["Regata", "Shorts"],
  ["Regata", "Calça"],
  ["Regata", "Saia"],
  ["Cropped", "Shorts"],
  ["Cropped", "Calça"],
  ["Cropped", "Saia"],
];

function areComplementary(sub1: string | null, sub2: string | null): boolean {
  if (!sub1 || !sub2) return false;
  const n1 = sub1.trim();
  const n2 = sub2.trim();
  return COMPLEMENTARY_PAIRS.some(
    ([a, b]) =>
      (n1.toLowerCase().includes(a.toLowerCase()) && n2.toLowerCase().includes(b.toLowerCase())) ||
      (n1.toLowerCase().includes(b.toLowerCase()) && n2.toLowerCase().includes(a.toLowerCase()))
  );
}

function normalizeStr(s: string | null | undefined): string {
  return (s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// --- Main component ---
export default function StockSetDetector() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [compareMode, setCompareMode] = useState<CompareMode>("own_vs_direct");
  const [scanMode, setScanMode] = useState<ScanMode>("manual");
  const [searchOwn, setSearchOwn] = useState("");
  const [searchPartner, setSearchPartner] = useState("");
  const [selectedOwnItems, setSelectedOwnItems] = useState<Set<string>>(new Set());
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [requestNotes, setRequestNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resultsVisible, setResultsVisible] = useState(false);

  // --- Fetch my own products ---
  const { data: ownProducts = [], isLoading: loadingOwn } = useQuery({
    queryKey: ["set-detector-own", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, color_label, size, price, stock_quantity, image_url, main_category, subcategory, owner_id, product_variants(id, size, stock_quantity)")
        .eq("owner_id", user!.id)
        .eq("is_active", true)
        .gt("stock_quantity", 0)
        .order("name");
      if (error) throw error;
      return (data || []) as StockProduct[];
    },
    enabled: !!user,
  });

  // --- Fetch partner products based on mode ---
  const { data: partnerProducts = [], isLoading: loadingPartner } = useQuery({
    queryKey: ["set-detector-partner", user?.id, compareMode],
    queryFn: async () => {
      // Get group memberships
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id, groups!inner(id, is_direct)")
        .eq("user_id", user!.id);

      if (!memberships || memberships.length === 0) return [];

      const isDirect = compareMode === "own_vs_direct";
      const groupIds = memberships
        .filter((m: any) => m.groups?.is_direct === isDirect)
        .map((m) => m.group_id);

      if (groupIds.length === 0) return [];

      // Use product_partnerships as the main table to avoid URL length limits
      // when there are hundreds of product IDs in an .in() filter
      const { data: rawData, error } = await supabase
        .from("product_partnerships")
        .select(`
          products!inner(
            id, name, color_label, size, price, stock_quantity,
            image_url, main_category, subcategory, owner_id,
            product_variants(id, size, stock_quantity)
          )
        `)
        .in("group_id", groupIds);

      if (error) throw error;

      // Deduplicate and filter on client side (RLS already ensures authorization)
      const seen = new Set<string>();
      return (rawData || [])
        .map((r: any) => r.products)
        .filter((p: any) =>
          p &&
          p.owner_id !== user!.id &&
          p.is_active &&
          p.stock_quantity > 0 &&
          !seen.has(p.id) &&
          seen.add(p.id)
        ) as StockProduct[];
    },
    enabled: !!user,
  });

  // --- Expand products to include variants ---
  function expandProduct(p: StockProduct): Array<StockProduct & { variantId?: string; variantSize?: string }> {
    if (p.product_variants && p.product_variants.length > 0) {
      return p.product_variants
        .filter((v) => v.stock_quantity > 0)
        .map((v) => ({
          ...p,
          variantId: v.id,
          variantSize: v.size,
          size: v.size,
          stock_quantity: v.stock_quantity,
        }));
    }
    return [{ ...p }];
  }

  // --- Filter own products ---
  const filteredOwn = useMemo(() => {
    const term = normalizeStr(searchOwn);
    return ownProducts.filter((p) =>
      !term || normalizeStr(p.name).includes(term) || normalizeStr(p.color_label).includes(term)
    );
  }, [ownProducts, searchOwn]);

  // --- Filter partner products ---
  const filteredPartner = useMemo(() => {
    const term = normalizeStr(searchPartner);
    return partnerProducts.filter((p) =>
      !term || normalizeStr(p.name).includes(term) || normalizeStr(p.color_label).includes(term)
    );
  }, [partnerProducts, searchPartner]);

  // --- Selected own products (expanded) ---
  const selectedOwnExpanded = useMemo(() => {
    if (scanMode === "auto") {
      return ownProducts.flatMap(expandProduct); // ALL products in auto mode
    }
    return ownProducts
      .filter((p) => selectedOwnItems.has(p.id))
      .flatMap(expandProduct);
  }, [ownProducts, selectedOwnItems, scanMode]);

  // --- Detect matches ---
  const matches = useMemo((): SetMatch[] => {
    if (selectedOwnExpanded.length === 0) return [];

    const partnerExpanded = partnerProducts.flatMap(expandProduct);
    const found: SetMatch[] = [];
    const seen = new Set<string>();

    for (const own of selectedOwnExpanded) {
      for (const partner of partnerExpanded) {
        const ownColor = normalizeStr(own.color_label);
        const partnerColor = normalizeStr(partner.color_label);
        const ownSize = normalizeStr(own.size);
        const partnerSize = normalizeStr(partner.size);
        const sameColor = ownColor && partnerColor && ownColor === partnerColor;
        const sameSize = ownSize && partnerSize && ownSize === partnerSize;

        // Match type 1: same color + same size (exchange / full set)
        if (sameColor && sameSize) {
          const key = `${own.id}-${own.variantId || ""}-${partner.id}-${partner.variantId || ""}-same`;
          if (!seen.has(key)) {
            seen.add(key);
            found.push({
              myProduct: own,
              partnerProduct: partner,
              matchType: "same_color_size",
              matchLabel: `Mesma cor (${own.color_label}) e tamanho (${own.size})`,
            });
          }
        }

        // Match type 2: same color + complementary subcategories = conjunto
        if (sameColor && areComplementary(own.subcategory, partner.subcategory)) {
          const key = `${own.id}-${own.variantId || ""}-${partner.id}-${partner.variantId || ""}-set`;
          if (!seen.has(key)) {
            seen.add(key);
            found.push({
              myProduct: own,
              partnerProduct: partner,
              matchType: "complementary_set",
              matchLabel: `Conjunto: ${own.subcategory} + ${partner.subcategory} (cor ${own.color_label}${sameSize ? `, tam. ${own.size}` : ""})`,
            });
          }
        }
      }
    }
    return found;
  }, [selectedOwnExpanded, partnerProducts]);

  const toggleOwnItem = (id: string) => {
    setSelectedOwnItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setResultsVisible(false);
    setSelectedMatches(new Set());
  };

  const toggleMatch = (key: string) => {
    setSelectedMatches((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getMatchKey = (m: SetMatch) =>
    `${m.myProduct.id}-${m.myProduct.variantId || ""}-${m.partnerProduct.id}-${m.partnerProduct.variantId || ""}`;

  const selectedMatchesList = matches.filter((m) => selectedMatches.has(getMatchKey(m)));

  // --- Send request mutation ---
  const requestMutation = useMutation({
    mutationFn: async () => {
      const inserts = selectedMatchesList.map((m) => ({
        product_id: m.partnerProduct.id,
        requester_id: user!.id,
        owner_id: m.partnerProduct.owner_id,
        quantity: 1,
        notes: requestNotes || `Solicitação via Detector de Conjuntos. Combinação: ${m.matchLabel}`,
        product_name: m.partnerProduct.name,
        product_price: m.partnerProduct.price,
        variant_id: m.partnerProduct.variantId || null,
        variant_size: m.partnerProduct.variantSize || m.partnerProduct.size || null,
        variant_color: m.partnerProduct.color_label || null,
      }));

      const { error } = await supabase.from("stock_requests").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selectedMatchesList.length} solicitação(ões) enviada(s)!`);
      setConfirmOpen(false);
      setSelectedMatches(new Set());
      setRequestNotes("");
      queryClient.invalidateQueries({ queryKey: ["stock-requests"] });
    },
    onError: (err: Error) => {
      toast.error("Erro ao enviar solicitações: " + err.message);
    },
  });

  const loading = loadingOwn || loadingPartner;

  return (
    <MainLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Detector de Conjuntos</h1>
          </div>
          <p className="text-muted-foreground">
            Compare estoques e descubra peças que formam conjuntos perfeitos
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/stock-requests")}>
          Ver Solicitações
        </Button>
      </div>

      {/* Step 1: Choose comparison mode */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
            Escolha os estoques para comparar
          </CardTitle>
          <CardDescription>Seu estoque próprio será comparado com o estoque selecionado abaixo</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={compareMode} onValueChange={(v) => { setCompareMode(v as CompareMode); setSelectedOwnItems(new Set()); setResultsVisible(false); setSelectedMatches(new Set()); }}>
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="own_vs_direct">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-primary" />
                  Próprio × Sociedade 1-1
                </div>
              </SelectItem>
              <SelectItem value="own_vs_group">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Próprio × Grupo / Parceria
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Mode switcher */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-medium">Modo de busca:</span>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => { setScanMode("manual"); setResultsVisible(false); setSelectedMatches(new Set()); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors",
                  scanMode === "manual"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                <Search className="h-3.5 w-3.5" />
                Busca Manual
              </button>
              <button
                onClick={() => { setScanMode("auto"); setResultsVisible(false); setSelectedMatches(new Set()); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors",
                  scanMode === "auto"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                <Zap className="h-3.5 w-3.5" />
                Varredura Automática
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Manual selection or Auto scan */}
      {scanMode === "manual" ? (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              Selecione as peças do seu estoque
            </CardTitle>
            <CardDescription>
              Escolha as peças que deseja comparar. O sistema buscará correspondências no outro estoque.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou cor..."
                  className="pl-9"
                  value={searchOwn}
                  onChange={(e) => setSearchOwn(e.target.value)}
                />
              </div>
            </div>

            {loadingOwn ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredOwn.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p>Nenhum produto encontrado no estoque próprio</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-y-auto pr-1">
                {filteredOwn.map((p) => {
                  const isSelected = selectedOwnItems.has(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleOwnItem(p.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:border-primary/50",
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-card"
                      )}
                    >
                      <div className="flex-shrink-0">
                        {isSelected ? (
                          <CheckSquare className="h-5 w-5 text-primary" />
                        ) : (
                          <Square className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{p.name}</p>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {p.color_label && (
                            <span className="text-xs text-muted-foreground">{p.color_label}</span>
                          )}
                          {p.color_label && p.size && <span className="text-xs text-muted-foreground">·</span>}
                          {p.size && (
                            <span className="text-xs text-muted-foreground">{p.size}</span>
                          )}
                          {p.subcategory && (
                            <Badge variant="outline" className="text-xs h-4 px-1">{p.subcategory}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Estoque: {p.stock_quantity} · R$ {p.price.toFixed(2).replace(".", ",")}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedOwnItems.size > 0 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {selectedOwnItems.size} peça(s) selecionada(s)
                </p>
                <Button
                  onClick={() => setResultsVisible(true)}
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Detectar Conjuntos
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Auto scan card */
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              <Zap className="h-4 w-4 text-primary" />
              Varredura Automática
            </CardTitle>
            <CardDescription>
              Compara <strong>todas as {ownProducts.length} peça{ownProducts.length !== 1 ? "s" : ""}</strong> do seu estoque com o estoque parceiro de uma só vez
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3 text-sm text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                <p>
                  A varredura detecta <strong>todos os conjuntos possíveis</strong>: peças complementares (Top + Shorts, Blusa + Calça, etc.) e peças com mesma cor e tamanho.
                </p>
              </div>
              <Button
                onClick={() => { setResultsVisible(true); setSelectedMatches(new Set()); }}
                disabled={loading || ownProducts.length === 0}
                size="lg"
                className="gap-2 flex-shrink-0"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <ScanSearch className="h-4 w-4" />
                )}
                Iniciar Varredura Completa
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Results */}
      {resultsVisible && (
        <Card className="mb-6 border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                  Conjuntos encontrados
                  {matches.length > 0 && (
                    <Badge className="ml-2">{matches.length}</Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-1">
                  Selecione as peças do outro estoque que deseja solicitar
                </CardDescription>
              </div>
              {/* Bulk select buttons */}
              {matches.length > 0 && (
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setSelectedMatches(new Set(matches.map(getMatchKey)))}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Selecionar Todos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setSelectedMatches(new Set())}
                    disabled={selectedMatches.size === 0}
                  >
                    <X className="h-3.5 w-3.5" />
                    Limpar
                  </Button>
                </div>
              )}
            </div>

            {/* Auto scan summary */}
            {scanMode === "auto" && matches.length > 0 && (
              <div className="mt-3 rounded-lg bg-primary/5 border border-primary/20 p-3">
                <p className="text-sm font-semibold text-primary mb-1.5 flex items-center gap-1.5">
                  <ScanSearch className="h-4 w-4" />
                  Varredura concluída
                </p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-foreground">
                      {matches.filter(m => m.matchType === "complementary_set").length}
                    </p>
                    <p className="text-xs text-muted-foreground">🎭 Conjuntos complementares</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">
                      {matches.filter(m => m.matchType === "same_color_size").length}
                    </p>
                    <p className="text-xs text-muted-foreground">🔄 Mesma cor e tamanho</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{matches.length}</p>
                    <p className="text-xs text-muted-foreground">Total de correspondências</p>
                  </div>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {loadingPartner ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : partnerProducts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="font-medium">Nenhum estoque de parceiro disponível</p>
                <p className="text-sm mt-1">
                  {compareMode === "own_vs_direct"
                    ? "Você ainda não tem sócias com produtos compartilhados."
                    : "Você ainda não tem parceiros em grupos com produtos compartilhados."}
                </p>
              </div>
            ) : matches.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="font-medium">Nenhum conjunto detectado</p>
                <p className="text-sm mt-2 max-w-md mx-auto">
                  {scanMode === "auto"
                    ? "Nenhuma correspondência encontrada em todo o estoque. Verifique se os produtos têm cores, tamanhos e subcategorias preenchidas."
                    : "Nenhuma peça do parceiro tem mesma cor + tamanho ou forma um conjunto complementar (Top+Shorts, Blusa+Calça, etc.) com as peças selecionadas."}
                </p>
                <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5" />
                  <span>{scanMode === "auto" ? "Verifique se os produtos estão com subcategorias configuradas" : "Tente selecionar mais peças ou trocar o modo de comparação"}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Group by match type */}
                {["complementary_set", "same_color_size"].map((type) => {
                  const group = matches.filter((m) => m.matchType === type);
                  if (group.length === 0) return null;
                  return (
                    <div key={type}>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant={type === "complementary_set" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {type === "complementary_set" ? "🎭 Conjuntos Complementares" : "🔄 Mesma Cor e Tamanho"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{group.length} item(s)</span>
                      </div>
                      <div className="space-y-2">
                        {group.map((m) => {
                          const key = getMatchKey(m);
                          const isSelected = selectedMatches.has(key);
                          return (
                            <button
                              key={key}
                              onClick={() => toggleMatch(key)}
                              className={cn(
                                "w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-all hover:border-primary/50",
                                isSelected
                                  ? "border-primary bg-primary/5"
                                  : "border-border bg-card"
                              )}
                            >
                              <div className="flex-shrink-0 mt-0.5">
                                {isSelected ? (
                                  <CheckSquare className="h-5 w-5 text-primary" />
                                ) : (
                                  <Square className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                  {/* My piece */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground mb-0.5">Minha peça</p>
                                    <p className="font-medium text-sm truncate">{m.myProduct.name}</p>
                                    <div className="flex gap-1 flex-wrap mt-0.5">
                                      {m.myProduct.subcategory && <Badge variant="outline" className="text-xs h-4 px-1">{m.myProduct.subcategory}</Badge>}
                                      {m.myProduct.color_label && <span className="text-xs text-muted-foreground">{m.myProduct.color_label}</span>}
                                      {m.myProduct.size && <span className="text-xs text-muted-foreground">· {m.myProduct.size}</span>}
                                    </div>
                                  </div>
                                  {/* Arrow */}
                                  <div className="flex-shrink-0 self-center">
                                    <ArrowRight className="h-4 w-4 text-muted-foreground hidden sm:block" />
                                    <ChevronDown className="h-4 w-4 text-muted-foreground sm:hidden" />
                                  </div>
                                  {/* Partner piece */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground mb-0.5">Peça do parceiro</p>
                                    <p className="font-medium text-sm truncate">{m.partnerProduct.name}</p>
                                    <div className="flex gap-1 flex-wrap mt-0.5">
                                      {m.partnerProduct.subcategory && <Badge variant="outline" className="text-xs h-4 px-1">{m.partnerProduct.subcategory}</Badge>}
                                      {m.partnerProduct.color_label && <span className="text-xs text-muted-foreground">{m.partnerProduct.color_label}</span>}
                                      {m.partnerProduct.size && <span className="text-xs text-muted-foreground">· {m.partnerProduct.size}</span>}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      Estoque: {m.partnerProduct.stock_quantity} · R$ {m.partnerProduct.price.toFixed(2).replace(".", ",")}
                                    </p>
                                  </div>
                                </div>
                                <p className="text-xs text-primary mt-2 font-medium">✓ {m.matchLabel}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Send requests */}
                {selectedMatches.size > 0 && (
                  <div className="mt-4 pt-4 border-t flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {selectedMatches.size} peça(s) selecionada(s) para solicitar
                    </p>
                    <Button onClick={() => setConfirmOpen(true)} className="gap-2">
                      <Send className="h-4 w-4" />
                      Solicitar Peças
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar Solicitações</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Serão criadas <strong>{selectedMatchesList.length}</strong> solicitação(ões) de reserva para os parceiros:
            </p>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {selectedMatchesList.map((m) => (
                <div key={getMatchKey(m)} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                  <Package className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.partnerProduct.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[m.partnerProduct.color_label, m.partnerProduct.size].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <Label htmlFor="req-notes" className="mb-1 block text-sm">
                Observação (opcional)
              </Label>
              <Textarea
                id="req-notes"
                placeholder="Ex: Quero formar conjuntos para o evento do sábado..."
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => requestMutation.mutate()}
              disabled={requestMutation.isPending}
              className="gap-2"
            >
              {requestMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Enviar Solicitações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
