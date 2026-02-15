import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Award, Shield } from "lucide-react";

const AVAILABLE_FEATURES = [
  { key: "fidelidade", label: "Entrar no Programa Fidelidade" },
  { key: "area_secreta", label: "Acessar Área Secreta" },
  { key: "bazar_comprar", label: "Comprar produtos no Bazar VIP" },
  { key: "bazar_vender", label: "Vender produtos no Bazar VIP" },
];

interface LoyaltyLevel {
  id: string;
  owner_id: string;
  name: string;
  min_spent: number;
  color: string;
  features: string[];
  display_order: number;
  created_at: string;
}

export default function LoyaltyAdmin() {
  const { user } = useAuth();
  const [levels, setLevels] = useState<LoyaltyLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<LoyaltyLevel | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formMinSpent, setFormMinSpent] = useState("");
  const [formColor, setFormColor] = useState("#8B5CF6");
  const [formFeatures, setFormFeatures] = useState<string[]>([]);

  useEffect(() => {
    if (user) fetchLevels();
  }, [user]);

  async function fetchLevels() {
    const { data, error } = await supabase
      .from("loyalty_levels")
      .select("*")
      .order("min_spent", { ascending: true });

    if (error) {
      toast({ title: "Erro ao carregar níveis", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    let parsed = (data || []).map((d: any) => ({
      ...d,
      features: Array.isArray(d.features) ? d.features : [],
    })) as LoyaltyLevel[];

    // Auto-create default levels if none exist
    if (parsed.length === 0 && user) {
      const defaultLevels = [
        { owner_id: user.id, name: "Inicial", min_spent: 0, color: "#9CA3AF", features: [], display_order: 0 },
        { owner_id: user.id, name: "Prata", min_spent: 500, color: "#A0AEC0", features: ["fidelidade"], display_order: 1 },
        { owner_id: user.id, name: "Ouro", min_spent: 1000, color: "#D69E2E", features: ["fidelidade", "area_secreta"], display_order: 2 },
        { owner_id: user.id, name: "Gold", min_spent: 2000, color: "#B7791F", features: ["fidelidade", "area_secreta", "bazar_comprar"], display_order: 3 },
        { owner_id: user.id, name: "VIP", min_spent: 4000, color: "#8B5CF6", features: ["fidelidade", "area_secreta", "bazar_comprar", "bazar_vender"], display_order: 4 },
      ];

      const { data: newLevels, error: insertError } = await supabase
        .from("loyalty_levels")
        .insert(defaultLevels)
        .select();

      if (!insertError && newLevels) {
        parsed = newLevels.map((d: any) => ({ ...d, features: Array.isArray(d.features) ? d.features : [] })) as LoyaltyLevel[];
      }
    }

    setLevels(parsed);
    setLoading(false);
  }

  function openCreate() {
    setEditingLevel(null);
    setFormName("");
    setFormMinSpent("");
    setFormColor("#8B5CF6");
    setFormFeatures([]);
    setDialogOpen(true);
  }

  function openEdit(level: LoyaltyLevel) {
    setEditingLevel(level);
    setFormName(level.name);
    setFormMinSpent(String(level.min_spent));
    setFormColor(level.color);
    setFormFeatures(level.features);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!user) return;
    const minSpent = parseFloat(formMinSpent);
    if (!formName.trim() || isNaN(minSpent) || minSpent < 0) {
      toast({ title: "Preencha todos os campos corretamente", variant: "destructive" });
      return;
    }

    if (editingLevel) {
      const { error } = await supabase
        .from("loyalty_levels")
        .update({ name: formName, min_spent: minSpent, color: formColor, features: formFeatures })
        .eq("id", editingLevel.id);

      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Nível atualizado!" });
    } else {
      const { error } = await supabase
        .from("loyalty_levels")
        .insert({
          owner_id: user.id,
          name: formName,
          min_spent: minSpent,
          color: formColor,
          features: formFeatures,
          display_order: levels.length,
        });

      if (error) {
        toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Nível criado!" });
    }

    setDialogOpen(false);
    fetchLevels();
  }

  async function handleDelete(level: LoyaltyLevel) {
    if (level.min_spent === 0) {
      toast({ title: "O nível Inicial não pode ser excluído", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("loyalty_levels").delete().eq("id", level.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Nível excluído!" });
    fetchLevels();
  }

  function toggleFeature(key: string) {
    setFormFeatures((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Award className="h-6 w-6 text-primary" />
              Programa de Fidelidade
            </h1>
            <p className="text-muted-foreground">Configure os níveis de recompensa para seus clientes</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Nível
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Níveis Configurados</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : levels.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum nível configurado</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cor</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Gasto Mínimo</TableHead>
                    <TableHead>Funcionalidades</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {levels.map((level) => (
                    <TableRow key={level.id}>
                      <TableCell>
                        <div
                          className="h-6 w-6 rounded-full border"
                          style={{ backgroundColor: level.color }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{level.name}</TableCell>
                      <TableCell>
                        {level.min_spent === 0
                          ? "Automático"
                          : `R$ ${Number(level.min_spent).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {level.features.length === 0 ? (
                            <span className="text-muted-foreground text-xs">Nenhuma</span>
                          ) : (
                            level.features.map((f) => {
                              const feat = AVAILABLE_FEATURES.find((af) => af.key === f);
                              return (
                                <span
                                  key={f}
                                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                                  style={{ backgroundColor: level.color }}
                                >
                                  {feat?.label || f}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="icon" onClick={() => openEdit(level)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {level.min_spent !== 0 && (
                            <Button variant="outline" size="icon" onClick={() => handleDelete(level)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Como funciona
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>• O nível de cada cliente é calculado automaticamente com base no gasto acumulado.</p>
            <p>• Quando uma venda é concluída, o valor é somado ao perfil do cliente.</p>
            <p>• O sistema compara o gasto total com os níveis que você configurou para determinar o nível atual.</p>
            <p>• O nível "Inicial" (gasto R$ 0) é obrigatório e não pode ser excluído.</p>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de criação/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLevel ? "Editar Nível" : "Novo Nível"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="level-name">Nome do Nível</Label>
              <Input
                id="level-name"
                placeholder="Ex: Bronze, Prata, Ouro..."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="level-min-spent">Gasto Mínimo Acumulado (R$)</Label>
              <Input
                id="level-min-spent"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formMinSpent}
                onChange={(e) => setFormMinSpent(e.target.value)}
                disabled={editingLevel?.min_spent === 0}
              />
            </div>
            <div>
              <Label htmlFor="level-color">Cor</Label>
              <div className="flex items-center gap-3">
                <input
                  id="level-color"
                  type="color"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded border border-input"
                />
                <Input
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  placeholder="#8B5CF6"
                  className="flex-1"
                />
                <div
                  className="h-10 w-10 rounded-full border"
                  style={{ backgroundColor: formColor }}
                />
              </div>
            </div>
            <div>
              <Label>Funcionalidades Liberadas</Label>
              <div className="space-y-2 mt-2">
                {AVAILABLE_FEATURES.map((feat) => (
                  <div key={feat.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`feat-${feat.key}`}
                      checked={formFeatures.includes(feat.key)}
                      onCheckedChange={() => toggleFeature(feat.key)}
                    />
                    <Label htmlFor={`feat-${feat.key}`} className="cursor-pointer">
                      {feat.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingLevel ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
