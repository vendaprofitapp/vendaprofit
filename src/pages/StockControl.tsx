import { useState, useEffect, useRef } from "react";
import { 
  Plus, Search, Package, Edit, Trash2, Users, 
  ArrowRightLeft, Check, X, Clock, Filter, Upload, Image as ImageIcon 
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
import { StockImportDialog } from "@/components/stock/StockImportDialog";
import { SupplierSelect } from "@/components/stock/SupplierSelect";

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

const categories = [
  "Calças", "Tops", "Shorts", "Conjuntos", "Bodies", "Regatas", "Bermudas", "Acessórios"
];

const sizes = ["PP", "P", "M", "G", "GG", "XG", "XXG"];

export default function StockControl() {
  const { user } = useAuth();
  const imageInputRef = useRef<HTMLInputElement>(null);
  
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
    group_id: "",
    supplier_id: ""
  });
  
  // Product images state
  const [productImages, setProductImages] = useState<File[]>([]);
  const [productImageUrls, setProductImageUrls] = useState<string[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);

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

  const handleImageUpload = (files: FileList | null) => {
    if (!files) return;
    
    const totalImages = productImages.length + existingImageUrls.length;
    const newImages = Array.from(files).slice(0, 3 - totalImages);
    const newUrls = newImages.map(file => URL.createObjectURL(file));
    
    setProductImages(prev => [...prev, ...newImages].slice(0, 3 - existingImageUrls.length));
    setProductImageUrls(prev => [...prev, ...newUrls].slice(0, 3 - existingImageUrls.length));
  };

  const removeImage = (index: number, isExisting: boolean) => {
    if (isExisting) {
      setExistingImageUrls(prev => prev.filter((_, i) => i !== index));
    } else {
      URL.revokeObjectURL(productImageUrls[index]);
      setProductImages(prev => prev.filter((_, i) => i !== index));
      setProductImageUrls(prev => prev.filter((_, i) => i !== index));
    }
  };

  const uploadProductImages = async (productId: string): Promise<string[]> => {
    if (!user || productImages.length === 0) return [];
    
    const urls: string[] = [];
    
    for (let i = 0; i < productImages.length; i++) {
      const file = productImages[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${productId}/${Date.now()}_${i + 1}.${fileExt}`;
      
      const { error } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { upsert: true });
      
      if (!error) {
        const { data } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        urls.push(data.publicUrl);
      }
    }
    
    return urls;
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
      supplier_id: productForm.supplier_id && productForm.supplier_id !== "none" ? productForm.supplier_id : null,
      owner_id: user.id
    };

    if (editingProduct) {
      // Handle existing + new images
      const allUrls = [...existingImageUrls];
      
      if (productImages.length > 0) {
        const newUrls = await uploadProductImages(editingProduct.id);
        allUrls.push(...newUrls);
      }

      const { error } = await supabase
        .from("products")
        .update({
          ...productData,
          image_url: allUrls[0] || null,
          image_url_2: allUrls[1] || null,
          image_url_3: allUrls[2] || null,
        })
        .eq("id", editingProduct.id);

      if (error) {
        toast.error("Erro ao atualizar produto");
      } else {
        toast.success("Produto atualizado!");
        setProductDialogOpen(false);
        fetchProducts();
      }
    } else {
      // Insert new product first to get ID
      const { data: newProduct, error } = await supabase
        .from("products")
        .insert(productData)
        .select("id")
        .single();

      if (error || !newProduct) {
        toast.error("Erro ao criar produto");
      } else {
        // Upload images if any
        if (productImages.length > 0) {
          const urls = await uploadProductImages(newProduct.id);
          if (urls.length > 0) {
            await supabase
              .from("products")
              .update({
                image_url: urls[0] || null,
                image_url_2: urls[1] || null,
                image_url_3: urls[2] || null,
              })
              .eq("id", newProduct.id);
          }
        }
        
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
      group_id: product.group_id || "",
      supplier_id: product.supplier_id || ""
    });
    
    // Set existing images
    const existing: string[] = [];
    if (product.image_url) existing.push(product.image_url);
    if (product.image_url_2) existing.push(product.image_url_2);
    if (product.image_url_3) existing.push(product.image_url_3);
    setExistingImageUrls(existing);
    
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
      group_id: "",
      supplier_id: ""
    });
    // Clear images
    productImageUrls.forEach(url => URL.revokeObjectURL(url));
    setProductImages([]);
    setProductImageUrls([]);
    setExistingImageUrls([]);
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

  const totalImages = productImages.length + existingImageUrls.length;

  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Controle de Estoque</h1>
          <p className="text-muted-foreground">Gerencie seu estoque e requisições de parceiros</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
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
                
                {/* Image Upload Section */}
                <div className="col-span-2 space-y-2">
                  <Label>Fotos do Produto (máx. 3)</Label>
                  <div className="flex gap-3 items-center flex-wrap">
                    {/* Existing images */}
                    {existingImageUrls.map((url, idx) => (
                      <div key={`existing-${idx}`} className="relative w-20 h-20">
                        <img 
                          src={url} 
                          alt={`Foto ${idx + 1}`} 
                          className="w-full h-full object-cover rounded-lg border"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(idx, true)}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    
                    {/* New images */}
                    {productImageUrls.map((url, idx) => (
                      <div key={`new-${idx}`} className="relative w-20 h-20">
                        <img 
                          src={url} 
                          alt={`Nova foto ${idx + 1}`} 
                          className="w-full h-full object-cover rounded-lg border"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(idx, false)}
                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    
                    {/* Upload button */}
                    {totalImages < 3 && (
                      <>
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleImageUpload(e.target.files)}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => imageInputRef.current?.click()}
                          className="w-20 h-20 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                        >
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground mt-1">Adicionar</span>
                        </button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {totalImages}/3 fotos adicionadas
                  </p>
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
                <div className="col-span-2">
                  <SupplierSelect 
                    value={productForm.supplier_id} 
                    onChange={(value) => setProductForm({ ...productForm, supplier_id: value })} 
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
          <TabsTrigger value="my-requests">Minhas Requisições</TabsTrigger>
          <TabsTrigger value="incoming-requests">
            Requisições Recebidas
            {incomingRequests.filter(r => r.status === 'pending').length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {incomingRequests.filter(r => r.status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* My Stock Tab */}
        <TabsContent value="my-stock">
          <div className="rounded-xl bg-card shadow-soft overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tamanho/Cor</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Status</TableHead>
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
                          <div className="flex items-center gap-3">
                            {product.image_url ? (
                              <img 
                                src={product.image_url} 
                                alt={product.name}
                                className="h-10 w-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <span className="font-medium block">{product.name}</span>
                              {product.sku && (
                                <span className="text-xs text-muted-foreground">{product.sku}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{product.category}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {product.size || "-"} / {product.color || "-"}
                        </TableCell>
                        <TableCell className="font-medium">
                          R$ {product.price.toFixed(2).replace(".", ",")}
                        </TableCell>
                        <TableCell>{product.stock_quantity} un.</TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditProduct(product)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
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
          <div className="rounded-xl bg-card shadow-soft overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tamanho/Cor</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Status</TableHead>
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
                          <div className="flex items-center gap-3">
                            {product.image_url ? (
                              <img 
                                src={product.image_url} 
                                alt={product.name}
                                className="h-10 w-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <span className="font-medium block">{product.name}</span>
                              {product.sku && (
                                <span className="text-xs text-muted-foreground">{product.sku}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{product.category}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {product.size || "-"} / {product.color || "-"}
                        </TableCell>
                        <TableCell>{product.stock_quantity} un.</TableCell>
                        <TableCell>
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
                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                            Requisitar
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
          <div className="rounded-xl bg-card shadow-soft overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhuma requisição realizada
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
                          {request.products?.sku && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({request.products.sku})
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{request.quantity} un.</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(request.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
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
          <div className="rounded-xl bg-card shadow-soft overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notas</TableHead>
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
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {request.notes || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {request.status === 'pending' && (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUpdateRequest(request.id, 'approved')}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Aprovar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
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
            <Button onClick={handleRequestProduct}>Enviar Requisição</Button>
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
