import { useState, useEffect } from "react";
import { 
  Plus, Search, Edit, Trash2, Users, 
  ArrowRightLeft, Check, X, Clock, Upload, Package
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { StockImportDialog } from "@/components/stock/StockImportDialog";
import { ProductFormDialog } from "@/components/stock/ProductFormDialog";

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
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  supplier_id: string | null;
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

  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);

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
      const unsubscribe = subscribeToRequests();
      return unsubscribe;
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
    const { data: myReqs } = await supabase
      .from("stock_requests")
      .select(`
        *,
        products:product_id (name, sku)
      `)
      .eq("requester_id", user?.id)
      .order("created_at", { ascending: false });
    
    setMyRequests(myReqs || []);

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

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Tem certeza que deseja excluir este produto?")) return;
    
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
    setProductDialogOpen(true);
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

    const { data: group, error: findError } = await supabase
      .from("groups")
      .select("id")
      .eq("invite_code", inviteCode.trim())
      .maybeSingle();

    if (findError || !group) {
      toast.error("Código de convite inválido");
      return;
    }

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Estoque</h1>
          <p className="text-muted-foreground text-sm">Gerencie seu estoque e requisições de parceiros</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          
          <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Users className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Entrar em Grupo</span>
                <span className="sm:hidden">Grupo</span>
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
              <Button variant="outline" size="sm">
                <Users className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Criar Grupo</span>
                <span className="sm:hidden">Novo</span>
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

          <Button size="sm" onClick={() => {
            setEditingProduct(null);
            setProductDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Novo Produto</span>
            <span className="sm:hidden">Novo</span>
          </Button>
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
        <TabsList className="w-full sm:w-auto overflow-x-auto">
          <TabsTrigger value="my-stock" className="text-xs sm:text-sm">Meu Estoque</TabsTrigger>
          <TabsTrigger value="partner-stock" className="text-xs sm:text-sm">Parceiros</TabsTrigger>
          <TabsTrigger value="my-requests" className="text-xs sm:text-sm">Requisições</TabsTrigger>
          <TabsTrigger value="incoming-requests" className="text-xs sm:text-sm">
            Recebidas
            {incomingRequests.filter(r => r.status === 'pending').length > 0 && (
              <Badge variant="destructive" className="ml-1 sm:ml-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {incomingRequests.filter(r => r.status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* My Stock Tab */}
        <TabsContent value="my-stock">
          <div className="rounded-xl bg-card shadow-soft overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="hidden sm:table-cell">Tam/Cor</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum produto encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => {
                    const status = getStockStatus(product.stock_quantity, product.min_stock_level);
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-2 sm:gap-3">
                            {product.image_url ? (
                              <img 
                                src={product.image_url} 
                                alt={product.name}
                                className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-secondary flex-shrink-0">
                                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="font-medium block truncate max-w-[120px] sm:max-w-none">{product.name}</span>
                              {product.sku && (
                                <span className="text-xs text-muted-foreground">{product.sku}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">{product.category}</TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">
                          {product.size || "-"} / {product.color || "-"}
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          R$ {product.price.toFixed(2).replace(".", ",")}
                        </TableCell>
                        <TableCell>{product.stock_quantity}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditProduct(product)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDeleteProduct(product.id)}
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

        {/* Partner Stock Tab */}
        <TabsContent value="partner-stock">
          <div className="rounded-xl bg-card shadow-soft overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="hidden md:table-cell">Categoria</TableHead>
                  <TableHead className="hidden sm:table-cell">Tam/Cor</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredPartnerProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum produto de parceiro disponível
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPartnerProducts.map((product) => {
                    const status = getStockStatus(product.stock_quantity, product.min_stock_level);
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-2 sm:gap-3">
                            {product.image_url ? (
                              <img 
                                src={product.image_url} 
                                alt={product.name}
                                className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-secondary flex-shrink-0">
                                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="font-medium block truncate max-w-[120px] sm:max-w-none">{product.name}</span>
                              {product.sku && (
                                <span className="text-xs text-muted-foreground">{product.sku}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">{product.category}</TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">
                          {product.size || "-"} / {product.color || "-"}
                        </TableCell>
                        <TableCell>{product.stock_quantity}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedProduct(product);
                              setRequestDialogOpen(true);
                            }}
                          >
                            <ArrowRightLeft className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Requisitar</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* My Requests Tab */}
        <TabsContent value="my-requests">
          <div className="rounded-xl bg-card shadow-soft overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead className="hidden sm:table-cell">Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhuma requisição feita
                    </TableCell>
                  </TableRow>
                ) : (
                  myRequests.map((request) => {
                    const status = getRequestStatus(request.status);
                    const StatusIcon = status.icon;
                    return (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          <span className="truncate max-w-[120px] sm:max-w-none block">
                            {request.products?.name || "Produto removido"}
                          </span>
                        </TableCell>
                        <TableCell>{request.quantity}</TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">
                          {new Date(request.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            <span className="hidden sm:inline">{status.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate hidden md:table-cell">
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

        {/* Incoming Requests Tab */}
        <TabsContent value="incoming-requests">
          <div className="rounded-xl bg-card shadow-soft overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead className="hidden sm:table-cell">Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Notas</TableHead>
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
                          <span className="truncate max-w-[120px] sm:max-w-none block">
                            {request.products?.name || "Produto removido"}
                          </span>
                        </TableCell>
                        <TableCell>{request.quantity}</TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">
                          {new Date(request.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            <span className="hidden sm:inline">{status.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate hidden md:table-cell">
                          {request.notes || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {request.status === 'pending' && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleUpdateRequest(request.id, 'approved')}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleUpdateRequest(request.id, 'rejected')}
                              >
                                <X className="h-4 w-4" />
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

      {/* Product Form Dialog */}
      <ProductFormDialog
        open={productDialogOpen}
        onOpenChange={(open) => {
          setProductDialogOpen(open);
          if (!open) setEditingProduct(null);
        }}
        editingProduct={editingProduct}
        groups={groups}
        onSuccess={fetchProducts}
      />

      {/* Request Product Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Requisitar Produto</DialogTitle>
            <DialogDescription>
              Solicite estoque do parceiro: {selectedProduct?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                value={requestQuantity}
                onChange={(e) => setRequestQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                placeholder="Alguma observação para o parceiro..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleRequestProduct}>Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <StockImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={fetchProducts}
      />
    </MainLayout>
  );
}
