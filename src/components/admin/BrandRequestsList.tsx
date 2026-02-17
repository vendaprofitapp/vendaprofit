import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BrandRequest {
  id: string;
  brand_name: string;
  b2c_url: string | null;
  b2b_url: string | null;
  status: string;
  created_at: string;
  user_id: string;
}

export function BrandRequestsList() {
  const [requests, setRequests] = useState<BrandRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("brand_requests" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }
    setRequests((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("brand_requests" as any)
      .update({ status } as any)
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar solicitação");
      return;
    }
    toast.success(status === "approved" ? "Marca aprovada!" : "Marca rejeitada");
    fetchRequests();
  };

  const pending = requests.filter((r) => r.status === "pending");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Solicitações de Marcas
          {pending.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {pending.length} pendente(s)
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma solicitação de marca.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marca</TableHead>
                <TableHead>Site B2C</TableHead>
                <TableHead>Site B2B</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.brand_name}</TableCell>
                  <TableCell className="text-sm">
                    {r.b2c_url ? (
                      <a href={r.b2c_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                        {new URL(r.b2c_url).hostname}
                      </a>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.b2b_url ? (
                      <a href={r.b2b_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                        {new URL(r.b2b_url).hostname}
                      </a>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.status === "approved" ? "default" :
                        r.status === "rejected" ? "destructive" : "secondary"
                      }
                    >
                      {r.status === "pending" ? "Pendente" :
                       r.status === "approved" ? "Aprovada" : "Rejeitada"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "pending" && (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(r.id, "approved")}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(r.id, "rejected")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
