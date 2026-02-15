import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Mail, Database, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BackupLog {
  id: string;
  backup_type: string;
  status: string;
  file_size_kb: number | null;
  users_count: number | null;
  error_message: string | null;
  created_at: string;
}

export function BackupSection() {
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    const { data, error } = await supabase
      .from("backup_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error && data) setLogs(data as BackupLog[]);
    setLoadingLogs(false);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-data?mode=download`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao gerar backup");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().split("T")[0];
      a.download = `backup_vendaprofit_${today}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Backup baixado com sucesso!");
      fetchLogs();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar backup");
    } finally {
      setDownloading(false);
    }
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-data?mode=email`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao enviar email");
      }

      toast.success("Email de backup enviado para os admins!");
      fetchLogs();
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar email");
    } finally {
      setSendingEmail(false);
    }
  };

  const lastScheduled = logs.find((l) => l.backup_type === "scheduled" && l.status === "success");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Backup de Dados
          </CardTitle>
          {lastScheduled && (
            <Badge variant="outline" className="text-xs">
              Último automático: {format(new Date(lastScheduled.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          O backup inclui todos os dados operacionais de todos os usuários (produtos, vendas, clientes, etc.) em formato JSON.
          Um backup automático é enviado diariamente por email às 00:00 (horário de Brasília).
        </p>

        <div className="flex flex-wrap gap-3">
          <Button onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloading ? "Gerando..." : "Baixar Backup Agora"}
          </Button>
          <Button variant="outline" onClick={handleSendEmail} disabled={sendingEmail}>
            {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {sendingEmail ? "Enviando..." : "Enviar por Email"}
          </Button>
        </div>

        <div>
          <h4 className="text-sm font-medium mb-2">Histórico de backups</h4>
          {loadingLogs ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum backup realizado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Tamanho</TableHead>
                  <TableHead className="text-right">Usuários</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {log.backup_type === "scheduled" ? "Automático" : "Manual"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={log.status === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                      >
                        {log.status === "success" ? "Sucesso" : "Falhou"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {log.file_size_kb ? `${log.file_size_kb} KB` : "-"}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {log.users_count ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
