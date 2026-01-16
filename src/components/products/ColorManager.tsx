import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Color {
  id: string;
  name: string;
  hex_code: string | null;
  owner_id: string;
}

interface ColorManagerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onColorCreated?: () => void;
}

const defaultColors = [
  { name: "Preto", hex: "#000000" },
  { name: "Branco", hex: "#FFFFFF" },
  { name: "Azul", hex: "#2563EB" },
  { name: "Vermelho", hex: "#DC2626" },
  { name: "Verde", hex: "#16A34A" },
  { name: "Amarelo", hex: "#EAB308" },
  { name: "Rosa", hex: "#EC4899" },
  { name: "Roxo", hex: "#9333EA" },
  { name: "Laranja", hex: "#EA580C" },
  { name: "Marrom", hex: "#78350F" },
  { name: "Cinza", hex: "#6B7280" },
  { name: "Bege", hex: "#D4B896" },
];

// Helper to normalize color names for comparison (case-insensitive, trimmed)
const normalizeColorName = (name: string) => name.toLowerCase().trim();

// Find matching color from list (case-insensitive)
export const findMatchingColor = (colorName: string, colors: Color[]): Color | null => {
  const normalized = normalizeColorName(colorName);
  return colors.find(c => normalizeColorName(c.name) === normalized) || null;
};

export function ColorManager({ value, onChange, placeholder = "Cor", onColorCreated }: ColorManagerProps) {
  const { user } = useAuth();
  const [colors, setColors] = useState<Color[]>([]);
  const [loading, setLoading] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);
  const [editColor, setEditColor] = useState<Color | null>(null);
  const [colorName, setColorName] = useState("");
  const [colorHex, setColorHex] = useState("#000000");

  const fetchColors = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("colors")
      .select("id, name, hex_code, owner_id")
      .eq("owner_id", user.id)
      .order("name");

    if (error) {
      console.error("Error fetching colors:", error);
      setColors([]);
    } else {
      setColors(data ?? []);
    }
    setLoading(false);
  };

  const initializeDefaultColors = async () => {
    if (!user) return;
    
    // Check if user has any colors
    const { count } = await supabase
      .from("colors")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", user.id);
    
    if (count === 0) {
      // Insert default colors
      const colorsToInsert = defaultColors.map(c => ({
        name: c.name,
        hex_code: c.hex,
        owner_id: user.id
      }));
      
      await supabase.from("colors").insert(colorsToInsert);
      fetchColors();
    }
  };

  useEffect(() => {
    if (user) {
      fetchColors().then(() => initializeDefaultColors());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleSaveColor = async () => {
    if (!user || !colorName.trim()) {
      toast.error("Digite o nome da cor");
      return;
    }

    // Check if color already exists (case-insensitive)
    const existingColor = findMatchingColor(colorName.trim(), colors);
    
    if (editColor) {
      // If editing, check if new name conflicts with another color
      if (existingColor && existingColor.id !== editColor.id) {
        toast.error("Já existe uma cor com esse nome");
        return;
      }
      
      const { error } = await supabase
        .from("colors")
        .update({ name: colorName.trim(), hex_code: colorHex })
        .eq("id", editColor.id);

      if (error) {
        toast.error("Erro ao atualizar cor");
        return;
      }
      toast.success("Cor atualizada!");
    } else {
      // If creating, check if color already exists
      if (existingColor) {
        // Instead of creating, just select the existing color
        onChange(existingColor.name);
        toast.info(`Cor "${existingColor.name}" já existe e foi selecionada`);
        resetColorForm();
        return;
      }
      
      const { error } = await supabase
        .from("colors")
        .insert({ name: colorName.trim(), hex_code: colorHex, owner_id: user.id });

      if (error) {
        toast.error("Erro ao criar cor");
        return;
      }
      toast.success("Cor criada!");
      onColorCreated?.();
    }

    resetColorForm();
    fetchColors();
  };

  const handleDeleteColor = async (color: Color) => {
    if (!window.confirm(`Excluir cor "${color.name}"?`)) return;

    const { error } = await supabase
      .from("colors")
      .delete()
      .eq("id", color.id);

    if (error) {
      toast.error("Erro ao excluir cor");
      return;
    }

    toast.success("Cor excluída!");
    if (value === color.name) {
      onChange("");
    }
    fetchColors();
  };

  const openEditColor = (color: Color) => {
    setEditColor(color);
    setColorName(color.name);
    setColorHex(color.hex_code || "#000000");
  };

  const resetColorForm = () => {
    setEditColor(null);
    setColorName("");
    setColorHex("#000000");
  };

  return (
    <div className="flex gap-1">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder={loading ? "..." : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {colors.map((c) => (
            <SelectItem key={c.id} value={c.name}>
              <div className="flex items-center gap-2">
                {c.hex_code && (
                  <div 
                    className="w-3 h-3 rounded-full border border-border" 
                    style={{ backgroundColor: c.hex_code }}
                  />
                )}
                {c.name}
              </div>
            </SelectItem>
          ))}
          {colors.length === 0 && !loading && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              Nenhuma cor
            </div>
          )}
        </SelectContent>
      </Select>

      <Dialog open={manageOpen} onOpenChange={(open) => {
        setManageOpen(open);
        if (!open) resetColorForm();
      }}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" type="button" className="shrink-0">
            <Palette className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Cores</DialogTitle>
            <DialogDescription>
              Adicione, edite ou remova cores para seus produtos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nome da cor"
                value={colorName}
                onChange={(e) => setColorName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveColor()}
                className="flex-1"
              />
              <input
                type="color"
                value={colorHex}
                onChange={(e) => setColorHex(e.target.value)}
                className="w-10 h-10 rounded border border-border cursor-pointer"
              />
              <Button onClick={handleSaveColor}>
                {editColor ? "Salvar" : <Plus className="h-4 w-4" />}
              </Button>
              {editColor && (
                <Button variant="outline" onClick={resetColorForm}>
                  Cancelar
                </Button>
              )}
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {colors.map((color) => (
                <div
                  key={color.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-secondary/50"
                >
                  <div className="flex items-center gap-2">
                    {color.hex_code && (
                      <div 
                        className="w-5 h-5 rounded-full border border-border" 
                        style={{ backgroundColor: color.hex_code }}
                      />
                    )}
                    <span className="text-sm font-medium">{color.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditColor(color)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDeleteColor(color)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              {colors.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma cor cadastrada
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManageOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
