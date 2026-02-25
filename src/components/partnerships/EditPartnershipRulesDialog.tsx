import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, HelpCircle, Settings, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface EditPartnershipRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  partnerName: string;
  currentCostSplit: number;       // 0–100
  currentProfitSeller: number;    // 0–100
  currentProfitPartner: number;   // 0–100
  currentThirdParty: number;      // 0–100
}

type RetroScope = "future_only" | "from_date" | "all";

export function EditPartnershipRulesDialog({
  open,
  onOpenChange,
  groupId,
  partnerName,
  currentCostSplit,
  currentProfitSeller,
  currentProfitPartner,
  currentThirdParty,
}: EditPartnershipRulesDialogProps) {
  const queryClient = useQueryClient();

  const [costSplit, setCostSplit] = useState(currentCostSplit);
  const [profitSeller, setProfitSeller] = useState(currentProfitSeller);
  const [profitPartner, setProfitPartner] = useState(currentProfitPartner);
  const [thirdParty, setThirdParty] = useState(currentThirdParty);
  const [retroScope, setRetroScope] = useState<RetroScope>("future_only");
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);

  // Reset to current values when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setCostSplit(currentCostSplit);
      setProfitSeller(currentProfitSeller);
      setProfitPartner(currentProfitPartner);
      setThirdParty(currentThirdParty);
      setRetroScope("future_only");
      setFromDate(undefined);
    }
    onOpenChange(v);
  };

  const handleSave = async () => {
    if (retroScope === "from_date" && !fromDate) {
      toast({ title: "Selecione uma data base", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      // 1. Update groups table
      const { error: groupErr } = await supabase
        .from("groups")
        .update({
          cost_split_ratio: costSplit / 100,
          profit_share_seller: profitSeller / 100,
          profit_share_partner: profitPartner / 100,
          commission_percent: thirdParty / 100,
        })
        .eq("id", groupId);
      if (groupErr) throw groupErr;

      // 2. Upsert partnership_rules
      const { error: rulesErr } = await supabase
        .from("partnership_rules")
        .upsert(
          {
            group_id: groupId,
            seller_cost_percent: costSplit,
            seller_profit_percent: profitSeller,
            owner_cost_percent: 100 - costSplit,
            owner_profit_percent: profitPartner,
          },
          { onConflict: "group_id" }
        );
      if (rulesErr) throw rulesErr;

      // 3. Retroactive recalculation via Edge Function (avoids URL length limits)
      let reprocessedCount = 0;
      if (retroScope !== "future_only") {
        const { data: fnData, error: fnErr } = await supabase.functions.invoke(
          "recalculate-partnership-splits",
          {
            body: {
              groupId,
              costSplit,
              profitSeller,
              profitPartner,
              scope: retroScope,
              fromDate: fromDate ? fromDate.toISOString() : null,
            },
          }
        );
        if (fnErr) throw fnErr;
        reprocessedCount = fnData?.count ?? 0;
      }

      // 4. Invalidate caches
      await queryClient.invalidateQueries({ queryKey: ["direct-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["partnership-rules"] });
      await queryClient.invalidateQueries({ queryKey: ["society-splits"] });
      await queryClient.invalidateQueries({ queryKey: ["society-sales"] });

      const msg = retroScope === "future_only"
        ? "Regras atualizadas para novas vendas."
        : `Regras atualizadas. ${reprocessedCount} venda(s) reprocessada(s).`;

      toast({ title: "Regras salvas!", description: msg });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Editar Regras da Sociedade
          </DialogTitle>
          <DialogDescription>Parceria com {partnerName}</DialogDescription>
        </DialogHeader>

        <TooltipProvider>
          <div className="space-y-5">

            {/* Cost Split */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Divisão de Custo</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Como o custo da peça é dividido entre vocês ao acertar contas.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={0} max={100}
                  value={costSplit}
                  onChange={(e) => setCostSplit(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  % você / {100 - costSplit}% {partnerName.split(" ")[0]}
                </span>
              </div>
            </div>

            {/* Profit when YOU sell */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Sua participação no lucro quando VOCÊ vende</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Quando você vende, qual % do lucro fica com você?</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={0} max={100}
                  value={profitSeller}
                  onChange={(e) => setProfitSeller(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  % para você ({partnerName.split(" ")[0]} fica com {100 - profitSeller}%)
                </span>
              </div>
            </div>

            {/* Profit when PARTNER sells */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Sua participação no lucro quando {partnerName.split(" ")[0]} vende</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Quando sua sócia vende, qual % do lucro fica com você?</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={0} max={100}
                  value={profitPartner}
                  onChange={(e) => setProfitPartner(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  % para você ({partnerName.split(" ")[0]} fica com {100 - profitPartner}%)
                </span>
              </div>
            </div>

            {/* Third-party commission */}
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center gap-2">
                <Label>Comissão em Vendas de Terceiros</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>% do lucro que a sociedade recebe quando um terceiro do grupo vende uma peça de vocês.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={0} max={100}
                  value={thirdParty}
                  onChange={(e) => setThirdParty(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">% para a sociedade</span>
              </div>
            </div>

            {/* Retroactivity scope */}
            <div className="border-t pt-4 space-y-3">
              <Label className="text-sm font-semibold">Aplicar a vendas existentes?</Label>
              <RadioGroup value={retroScope} onValueChange={(v) => setRetroScope(v as RetroScope)} className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer">
                  <RadioGroupItem value="future_only" id="future_only" className="mt-0.5" />
                  <label htmlFor="future_only" className="cursor-pointer space-y-0.5">
                    <p className="text-sm font-medium">Apenas vendas futuras</p>
                    <p className="text-xs text-muted-foreground">Vendas já registradas não são alteradas. As novas regras valem a partir de agora.</p>
                  </label>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer">
                  <RadioGroupItem value="from_date" id="from_date" className="mt-0.5" />
                  <label htmlFor="from_date" className="cursor-pointer space-y-0.5 flex-1">
                    <p className="text-sm font-medium">A partir de uma data</p>
                    <p className="text-xs text-muted-foreground">Recalcula splits de vendas a partir da data selecionada.</p>
                    {retroScope === "from_date" && (
                      <div className="mt-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn("w-48 justify-start text-left font-normal", !fromDate && "text-muted-foreground")}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {fromDate ? format(fromDate, "dd/MM/yyyy", { locale: ptBR }) : "Escolher data"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={fromDate}
                              onSelect={setFromDate}
                              disabled={(d) => d > new Date()}
                              initialFocus
                              locale={ptBR}
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </label>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors cursor-pointer">
                  <RadioGroupItem value="all" id="all" className="mt-0.5" />
                  <label htmlFor="all" className="cursor-pointer space-y-0.5">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      Todas as vendas da sociedade
                    </p>
                    <p className="text-xs text-muted-foreground">Recalcula todos os splits históricos. Isso alterará relatórios de períodos já fechados.</p>
                  </label>
                </div>
              </RadioGroup>
            </div>

          </div>
        </TooltipProvider>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar Regras"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Retroactive recalculation ───────────────────────────────────────────────
async function recalculateSplits(
  groupId: string,
  costSplit: number,
  profitSeller: number,
  profitPartner: number,
  scope: RetroScope,
  fromDate?: Date
): Promise<number> {
  // 1. Get product IDs in this partnership
  const { data: ppData, error: ppErr } = await supabase
    .from("product_partnerships")
    .select("product_id")
    .eq("group_id", groupId);
  if (ppErr) throw ppErr;
  if (!ppData || ppData.length === 0) return 0;

  const productIds = ppData.map((p) => p.product_id);

  // 2. Get sale IDs that contain these products
  let saleItemsQuery = supabase
    .from("sale_items")
    .select("sale_id, sales!inner(id, owner_id, subtotal, created_at, status)")
    .in("product_id", productIds)
    .eq("sales.status", "completed");

  const { data: saleItemsData, error: siErr } = await saleItemsQuery;
  if (siErr) throw siErr;
  if (!saleItemsData || saleItemsData.length === 0) return 0;

  // Deduplicate and filter by date
  const seen = new Set<string>();
  const sales: { id: string; owner_id: string; subtotal: number; created_at: string }[] = [];

  for (const row of saleItemsData) {
    const sale = (row as any).sales;
    if (!sale || seen.has(sale.id)) continue;
    seen.add(sale.id);

    if (scope === "from_date" && fromDate) {
      if (new Date(sale.created_at) < fromDate) continue;
    }
    sales.push(sale);
  }

  if (sales.length === 0) return 0;

  const saleIds = sales.map((s) => s.id);

  // 3. Get existing profit_share splits for these sales
  const { data: existingSplits, error: splErr } = await supabase
    .from("financial_splits")
    .select("id, sale_id, user_id, amount, type")
    .in("sale_id", saleIds)
    .eq("type", "profit_share");
  if (splErr) throw splErr;

  // 4. Get group members to identify owner (socioA) and partner (socioB)
  const { data: members, error: memErr } = await supabase
    .from("group_members")
    .select("user_id, role")
    .eq("group_id", groupId);
  if (memErr) throw memErr;

  const ownerMember = members?.find((m) => m.role === "owner");
  const partnerMember = members?.find((m) => m.role !== "owner");
  if (!ownerMember || !partnerMember) return 0;

  const ownerId = ownerMember.user_id;
  const partnerId = partnerMember.user_id;

  // 5. For each sale, get cost of items
  const { data: allItems, error: itemsErr } = await supabase
    .from("sale_items")
    .select("sale_id, quantity, products(cost_price)")
    .in("sale_id", saleIds)
    .in("product_id", productIds);
  if (itemsErr) throw itemsErr;

  const costBySale = new Map<string, number>();
  for (const item of allItems ?? []) {
    const cost = ((item as any).products?.cost_price ?? 0) * (item.quantity ?? 1);
    costBySale.set(item.sale_id, (costBySale.get(item.sale_id) ?? 0) + cost);
  }

  // 6. Delete old profit_share splits
  if (existingSplits && existingSplits.length > 0) {
    const idsToDelete = existingSplits.map((s) => s.id);
    const { error: delErr } = await supabase
      .from("financial_splits")
      .delete()
      .in("id", idsToDelete);
    if (delErr) throw delErr;
  }

  // 7. Rebuild splits
  const newSplits: { sale_id: string; user_id: string; amount: number; type: string; description: string }[] = [];

  const sellerPct = profitSeller / 100;
  const partnerPct = profitPartner / 100;

  for (const sale of sales) {
    const cost = costBySale.get(sale.id) ?? 0;
    const grossProfit = (sale.subtotal ?? 0) - cost;
    if (grossProfit <= 0) continue;

    const isOwnerSale = sale.owner_id === ownerId;
    const sellerIsOwner = isOwnerSale;

    // Seller gets sellerPct of gross profit
    const sellerShare = grossProfit * sellerPct;
    // Partner gets partnerPct of gross profit
    const partnerShare = grossProfit * partnerPct;

    const sellerId = isOwnerSale ? ownerId : partnerId;
    const nonSellerId = isOwnerSale ? partnerId : ownerId;

    newSplits.push({
      sale_id: sale.id,
      user_id: sellerId,
      amount: sellerShare,
      type: "profit_share",
      description: `Lucro sociedade (vendedora ${sellerPct * 100}%)`,
    });
    newSplits.push({
      sale_id: sale.id,
      user_id: nonSellerId,
      amount: partnerShare,
      type: "profit_share",
      description: `Lucro sociedade (sócia ${partnerPct * 100}%)`,
    });
  }

  if (newSplits.length > 0) {
    const { error: insErr } = await supabase.from("financial_splits").insert(newSplits);
    if (insErr) throw insErr;
  }

  return sales.length;
}
