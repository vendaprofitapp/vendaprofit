import { useState, useEffect } from "react";
import { 
  Plus, Search, Package, Edit, Trash2, Users, 
  ArrowRightLeft, Check, X, Clock, Filter 
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  cost_price: number | null;
  sku: string | null;
  size: string | null;
  color: string | null;
  stock_quantity: number;
  min_stock_level: number;
  group_id: string | null;
  owner_id: string;
  is_active: boolean;
}

interface StockRequest {
  id: string;
  product_id: string;
  requester_id: string;
  owner_id: string;
  quantity: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  notes: string | null;
  response_notes: string | null;
  created_at: string;
  products?: { name: string; sku: string | null };
  requester?: { full_name: string; store_name: string | null };
}

interface Group {
  id: string;
  name: string;
  invite_code: string;
}

const categories = [
  "Calças", "Tops", "Shorts", "Conjuntos", "Bodies", "Regatas", "Bermudas", "Acessórios"
];

const sizes = ["PP", "P", "M", "G", "GG", "XG", "XXG"];

export default function StockControl() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [partnerProducts, setPartnerProducts] = useState<Product[]>([]);
  const [myRequests, setMyRequests] = useState<StockRequest[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<StockRequest[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Product form state
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    cost_price: "",
    sku: "",
    size: "",
    color: "",
    stock_quantity: "",
    min_stock_level: "5",
    group_id: ""
  });

  // Request form state
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [requestQuantity, setRequestQuantity] = useState("1");
  const [requestNotes, setRequestNotes] = useState("");

  // Group form state
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  useEffect(() => {
    if (user) {
      fetchData();
      subscribeToRequests();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    
    await Promise.all([
      fetchProducts(),
      fetchPartnerProducts(),
      fetchRequests(),
      fetchGroups()
    ]);
    
    setLoading(false);
  };

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("owner_id", user?.id)
      .order("created_at", { ascending: false });
    
    if (error) {
      toast.error("Erro ao carregar produtos");
    } else {
      setProducts(data || []);
    }
  };

  const fetchPartnerProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .neq("owner_id", user?.id)
      .not("group_id", "is", null)
      .order("created_at", { ascending: false });
    
    if (!error) {
      setPartnerProducts(data || []);
    }
  };

  const fetchRequests = async () => {
    // My requests (where I'm the requester)
    const { data: myReqs } = await supabase
      .from("stock_requests")
      .select(`
        *,
        products:product_id (name, sku)
      `)
      .eq("requester_id", user?.id)
      .order("created_at", { ascending: false });
    
    setMyRequests(myReqs || []);

    // Incoming requests (where I'm the owner)
    const { data: incomingReqs } = await supabase
      .from("stock_requests")
      .select(`
        *,
        products:product_id (name, sku)
      `)
      .eq("owner_id", user?.id)
      .order("created_at", { ascending: false });
    
    setIncomingRequests(incomingReqs || []);
  };

  const fetchGroups = async () => {
    const { data } = await supabase
      .from("groups")
      .select("id, name, invite_code");
    
    setGroups(data || []);
  };

  const subscribeToRequests = () => {
    const channel = supabase
      .channel("stock_requests_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stock_requests" },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSaveProduct = async () => {
    if (!user) return;

    const productData = {
      name: productForm.name,
      description: productForm.description || null,
      category: productForm.category,
      price: parseFloat(productForm.price) || 0,
      cost_price: productForm.cost_price ? parseFloat(productForm.cost_price) : null,
      sku: productForm.sku || null,
      size: productForm.size || null,
      color: productForm.color || null,
      stock_quantity: parseInt(productForm.stock_quantity) || 0,
      min_stock_level: parseInt(productForm.min_stock_level) || 5,
      group_id: productForm.group_id || null,
      owner_id: user.id
    };

    if (editingProduct) {
      const { error } = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingProduct.id);

      if (error) {
        toast.error("Erro ao atualizar produto");
      } else {
        toast.success("Produto atualizado!");
        setProductDialogOpen(false);
        fetchProducts();
      }
    } else {
      const { error } = await supabase
        .from("products")
        .insert(productData);

      if (error) {
        toast.error("Erro ao criar produto");
      } else {
        toast.success("Produto criado!");
        setProductDialogOpen(false);
        fetchProducts();
      }
    }

    resetProductForm();
  };

  const handleDeleteProduct = async (productId: string) => {
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) {
      toast.error("Erro ao excluir produto");
    } else {
      toast.success("Produto excluído!");
      fetchProducts();
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || "",
      category: product.category,
      price: product.price.toString(),
      cost_price: product.cost_price?.toString() || "",
      sku: product.sku || "",
      size: product.size || "",
      color: product.color || "",
      stock_quantity: product.stock_quantity.toString(),
      min_stock_level: product.min_stock_level.toString(),
      group_id: product.group_id || ""
    });
    setProductDialogOpen(true);
  };

  const resetProductForm = () => {
    setEditingProduct(null);
    setProductForm({
      name: "",
      description: "",
      category: "",
      price: "",
      cost_price: "",
      sku: "",
      size: "",
      color: "",
      stock_quantity: "",
      min_stock_level: "5",
      group_id: ""
    });
  };

  const handleRequestProduct = async () => {
    if (!user || !selectedProduct) return;

    const { error } = await supabase
      .from("stock_requests")
      .insert({
        product_id: selectedProduct.id,
        requester_id: user.id,
        owner_id: selectedProduct.owner_id,
        quantity: parseInt(requestQuantity) || 1,
        notes: requestNotes || null
      });

    if (error) {
      toast.error("Erro ao criar requisição");
    } else {
      toast.success("Requisição enviada!");
      setRequestDialogOpen(false);
      setSelectedProduct(null);
      setRequestQuantity("1");
      setRequestNotes("");
      fetchRequests();
    }
  };

  const handleUpdateRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from("stock_requests")
      .update({ 
        status, 
        responded_at: new Date().toISOString() 
      })
      .eq("id", requestId);

    if (error) {
      toast.error("Erro ao atualizar requisição");
    } else {
      toast.success(status === 'approved' ? "Requisição aprovada!" : "Requisição rejeitada");
      fetchRequests();
    }
  };

  const handleCreateGroup = async () => {
    if (!user || !newGroupName.trim()) return;

    const { error } = await supabase
      .from("groups")
      .insert({
        name: newGroupName,
        created_by: user.id
      });

    if (error) {
      toast.error("Erro ao criar grupo");
    } else {
      toast.success("Grupo criado!");
      setGroupDialogOpen(false);
      setNewGroupName("");
      fetchGroups();
    }
  };

  const handleJoinGroup = async () => {
    if (!user || !inviteCode.trim()) return;

    // Find group by invite code
    const { data: group, error: findError } = await supabase
      .from("groups")
      .select("id")
      .eq("invite_code", inviteCode.trim())
      .maybeSingle();

    if (findError || !group) {
      toast.error("Código de convite inválido");
      return;
    }

    // Join group
    const { error } = await supabase
      .from("group_members")
      .insert({
        group_id: group.id,
        user_id: user.id,
        role: "member"
      });

    if (error) {
      if (error.code === "23505") {
        toast.error("Você já faz parte deste grupo");
      } else {
        toast.error("Erro ao entrar no grupo");
      }
    } else {
      toast.success("Você entrou no grupo!");
      setJoinDialogOpen(false);
      setInviteCode("");
      fetchGroups();
      fetchPartnerProducts();
    }
  };

  const getStockStatus = (quantity: number, minLevel: number) => {
    if (quantity === 0) return { label: "Esgotado", variant: "destructive" as const };
    if (quantity <= minLevel) return { label: "Baixo", variant: "secondary" as const };
    return { label: "OK", variant: "default" as const };
  };

  const getRequestStatus = (status: string) => {
    switch (status) {
      case 'pending': return { label: "Pendente", variant: "secondary" as const, icon: Clock };
      case 'approved': return { label: "Aprovado", variant: "default" as const, icon: Check };
      case 'rejected': return { label: "Rejeitado", variant: "destructive" as const, icon: X };
      default: return { label: status, variant: "secondary" as const, icon: Clock };
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPartnerProducts = partnerProducts.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Controle de Estoque</h1>
          <p className="text-muted-foreground">Gerencie seu estoque e requisições de parceiros</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Users className="h-4 w-4 mr-2" />
                Entrar em Grupo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Entrar em um Grupo</DialogTitle>
                <DialogDescription>
                  Insira o código de convite do grupo para participar
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Código de Convite</Label>
                  <Input
                    placeholder="Ex: abc12345"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setJoinDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleJoinGroup}>Entrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Users className="h-4 w-4 mr-2" />
                Criar Grupo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Grupo</DialogTitle>
                <DialogDescription>
                  Crie um grupo para compartilhar estoque com parceiros
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome do Grupo</Label>
                  <Input
                    placeholder="Ex: Loja Centro"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateGroup}>Criar Grupo</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={productDialogOpen} onOpenChange={(open) => {
            setProductDialogOpen(open);
            if (!open) resetProductForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
                <DialogDescription>
                  Preencha os dados do produto
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="col-span-2 space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                    placeholder="Nome do produto"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={productForm.description}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                    placeholder="Descrição do produto"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoria *</Label>
                  <Select
                    value={productForm.category}
                    onValueChange={(value) => setProductForm({ ...productForm, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    placeholder="Código do produto"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço de Venda *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço de Custo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={productForm.cost_price}
                    onChange={(e) => setProductForm({ ...productForm, cost_price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tamanho</Label>
                  <Select
                    value={productForm.size}
                    onValueChange={(value) => setProductForm({ ...productForm, size: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {sizes.map((size) => (
                        <SelectItem key={size} value={size}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <Input
                    value={productForm.color}
                    onChange={(e) => setProductForm({ ...productForm, color: e.target.value })}
                    placeholder="Ex: Preto"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantidade em Estoque *</Label>
                  <Input
                    type="number"
                    value={productForm.stock_quantity}
                    onChange={(e) => setProductForm({ ...productForm, stock_quantity: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estoque Mínimo</Label>
                  <Input
                    type="number"
                    value={productForm.min_stock_level}
                    onChange={(e) => setProductForm({ ...productForm, min_stock_level: e.target.value })}
                    placeholder="5"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Compartilhar com Grupo</Label>
                  <Select
                    value={productForm.group_id || "none"}
                    onValueChange={(value) => setProductForm({ ...productForm, group_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhum (privado)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum (privado)</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setProductDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveProduct}>
                  {editingProduct ? "Salvar" : "Criar Produto"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar produtos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs defaultValue="my-stock" className="space-y-6">
        <TabsList>
          <TabsTrigger value="my-stock">Meu Estoque</TabsTrigger>
          <TabsTrigger value="partner-stock">Estoque Parceiros</TabsTrigger>
          <TabsTrigger value="my-requests">
            Minhas Requisições
            {myRequests.filter(r => r.status === 'pending').length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {myRequests.filter(r => r.status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="incoming-requests">
            Requisições Recebidas
            {incomingRequests.filter(r => r.status === 'pending').length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {incomingRequests.filter(r => r.status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-stock">
          <div className="rounded-xl bg-card shadow-soft overflow-hidden animate-fade-in">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Produto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhum produto encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => {
                    const status = getStockStatus(product.stock_quantity, product.min_stock_level);
                    const group = groups.find(g => g.id === product.group_id);
                    return (
                      <TableRow key={product.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                              <Package className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <span className="font-medium">{product.name}</span>
                              {product.color && (
                                <p className="text-xs text-muted-foreground">{product.color}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{product.sku || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{product.category}</TableCell>
                        <TableCell>{product.size || "-"}</TableCell>
                        <TableCell className="font-medium">
                          R$ {product.price.toFixed(2).replace(".", ",")}
                        </TableCell>
                        <TableCell>{product.stock_quantity} un.</TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {group?.name || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEditProduct(product)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => {
                                if (window.confirm(`Tem certeza que deseja excluir "${product.name}"?`)) {
                                  handleDeleteProduct(product.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="partner-stock">
          <div className="rounded-xl bg-card shadow-soft overflow-hidden animate-fade-in">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Produto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Disponível</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPartnerProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum produto de parceiro disponível. Entre em um grupo para ver produtos compartilhados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPartnerProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <span className="font-medium">{product.name}</span>
                            {product.color && (
                              <p className="text-xs text-muted-foreground">{product.color}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{product.sku || "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{product.category}</TableCell>
                      <TableCell>{product.size || "-"}</TableCell>
                      <TableCell className="font-medium">
                        R$ {product.price.toFixed(2).replace(".", ",")}
                      </TableCell>
                      <TableCell>{product.stock_quantity} un.</TableCell>
                      <TableCell className="text-right">
                        <Dialog open={requestDialogOpen && selectedProduct?.id === product.id} onOpenChange={(open) => {
                          setRequestDialogOpen(open);
                          if (!open) {
                            setSelectedProduct(null);
                            setRequestQuantity("1");
                            setRequestNotes("");
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedProduct(product)}
                              disabled={product.stock_quantity === 0}
                            >
                              <ArrowRightLeft className="h-4 w-4 mr-2" />
                              Requisitar
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Requisitar Produto</DialogTitle>
                              <DialogDescription>
                                Solicitar "{product.name}" do parceiro
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>Quantidade (máx: {product.stock_quantity})</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  max={product.stock_quantity}
                                  value={requestQuantity}
                                  onChange={(e) => setRequestQuantity(e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Observação</Label>
                                <Textarea
                                  placeholder="Motivo ou detalhes da requisição..."
                                  value={requestNotes}
                                  onChange={(e) => setRequestNotes(e.target.value)}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>Cancelar</Button>
                              <Button onClick={handleRequestProduct}>Enviar Requisição</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="my-requests">
          <div className="rounded-xl bg-card shadow-soft overflow-hidden animate-fade-in">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Produto</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhuma requisição enviada
                    </TableCell>
                  </TableRow>
                ) : (
                  myRequests.map((request) => {
                    const status = getRequestStatus(request.status);
                    const StatusIcon = status.icon;
                    return (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          {request.products?.name || "Produto removido"}
                        </TableCell>
                        <TableCell>{request.quantity} un.</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(request.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="flex items-center gap-1 w-fit">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {request.notes || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="incoming-requests">
          <div className="rounded-xl bg-card shadow-soft overflow-hidden animate-fade-in">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Produto</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incomingRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma requisição recebida
                    </TableCell>
                  </TableRow>
                ) : (
                  incomingRequests.map((request) => {
                    const status = getRequestStatus(request.status);
                    const StatusIcon = status.icon;
                    return (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          {request.products?.name || "Produto removido"}
                        </TableCell>
                        <TableCell>{request.quantity} un.</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(request.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="flex items-center gap-1 w-fit">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {request.notes || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {request.status === 'pending' && (
                            <div className="flex items-center justify-end gap-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleUpdateRequest(request.id, 'approved')}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Aprovar
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleUpdateRequest(request.id, 'rejected')}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Rejeitar
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Groups Info */}
      {groups.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Seus Grupos</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <div key={group.id} className="bg-card rounded-lg p-4 shadow-soft">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="font-medium">{group.name}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Código de convite: <code className="bg-secondary px-2 py-1 rounded">{group.invite_code}</code>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </MainLayout>
  );
}
