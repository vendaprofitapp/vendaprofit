import { useState, useEffect } from "react";
import { Smartphone, Mail, Loader2, Check, Shield, QrCode, Copy, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

interface TwoFactorSectionProps {
  userId: string;
  userEmail: string;
}

interface MFAFactor {
  id: string;
  friendly_name: string;
  factor_type: string;
  status: string;
}

export function TwoFactorSection({ userId, userEmail }: TwoFactorSectionProps) {
  const [mfaFactors, setMfaFactors] = useState<MFAFactor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // TOTP Setup State
  const [isTotpDialogOpen, setIsTotpDialogOpen] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [totpQrCode, setTotpQrCode] = useState("");
  const [totpFactorId, setTotpFactorId] = useState("");
  const [totpVerifyCode, setTotpVerifyCode] = useState("");
  const [isEnrollingTotp, setIsEnrollingTotp] = useState(false);
  const [isVerifyingTotp, setIsVerifyingTotp] = useState(false);
  
  // Unenroll State
  const [unenrollFactorId, setUnenrollFactorId] = useState<string | null>(null);
  const [isUnenrolling, setIsUnenrolling] = useState(false);

  useEffect(() => {
    fetchMfaFactors();
  }, []);

  const fetchMfaFactors = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      
      const verifiedFactors = (data?.totp || []).filter(f => f.status === 'verified');
      setMfaFactors(verifiedFactors as MFAFactor[]);
    } catch (error: any) {
      console.error("Error fetching MFA factors:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const hasTotpEnabled = mfaFactors.some(f => f.factor_type === 'totp');

  const startTotpEnrollment = async () => {
    setIsEnrollingTotp(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App',
      });

      if (error) throw error;

      if (data?.totp) {
        setTotpSecret(data.totp.secret);
        setTotpQrCode(data.totp.qr_code);
        setTotpFactorId(data.id);
        setIsTotpDialogOpen(true);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao iniciar configuração",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsEnrollingTotp(false);
    }
  };

  const verifyTotpEnrollment = async () => {
    if (totpVerifyCode.length !== 6) {
      toast({
        title: "Código inválido",
        description: "Digite o código de 6 dígitos",
        variant: "destructive",
      });
      return;
    }

    setIsVerifyingTotp(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactorId,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactorId,
        challengeId: challengeData.id,
        code: totpVerifyCode,
      });

      if (verifyError) throw verifyError;

      toast({ title: "Autenticação de dois fatores ativada!" });
      setIsTotpDialogOpen(false);
      resetTotpForm();
      fetchMfaFactors();
    } catch (error: any) {
      toast({
        title: "Erro ao verificar código",
        description: error.message === "Invalid TOTP code entered" 
          ? "Código incorreto. Verifique e tente novamente."
          : error.message,
        variant: "destructive",
      });
    } finally {
      setIsVerifyingTotp(false);
    }
  };

  const unenrollFactor = async () => {
    if (!unenrollFactorId) return;

    setIsUnenrolling(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: unenrollFactorId,
      });

      if (error) throw error;

      toast({ title: "Autenticação de dois fatores desativada!" });
      setUnenrollFactorId(null);
      fetchMfaFactors();
    } catch (error: any) {
      toast({
        title: "Erro ao desativar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUnenrolling(false);
    }
  };

  const resetTotpForm = () => {
    setTotpSecret("");
    setTotpQrCode("");
    setTotpFactorId("");
    setTotpVerifyCode("");
  };

  const copySecret = () => {
    navigator.clipboard.writeText(totpSecret);
    toast({ title: "Código copiado!" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="h-5 w-5 text-muted-foreground" />
        <h4 className="font-medium">Autenticação de Dois Fatores (2FA)</h4>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Adicione uma camada extra de segurança à sua conta exigindo um código além da senha.
      </p>

      {/* TOTP Option */}
      <div className="flex items-center justify-between p-4 rounded-lg border bg-background">
        <div className="flex items-center gap-3">
          <Smartphone className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">Aplicativo Autenticador</p>
              {hasTotpEnabled && (
                <Badge variant="default" className="text-xs bg-success">
                  <Check className="h-3 w-3 mr-1" />
                  Ativo
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Google Authenticator, Authy, Microsoft Authenticator
            </p>
          </div>
        </div>
        {hasTotpEnabled ? (
          <Button
            variant="outline"
            onClick={() => {
              const factor = mfaFactors.find(f => f.factor_type === 'totp');
              if (factor) setUnenrollFactorId(factor.id);
            }}
          >
            Desativar
          </Button>
        ) : (
          <Button onClick={startTotpEnrollment} disabled={isEnrollingTotp}>
            {isEnrollingTotp && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Configurar
          </Button>
        )}
      </div>

      {/* Email 2FA Info */}
      <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">Verificação por Email</p>
              <Badge variant="secondary" className="text-xs">
                Disponível
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Código enviado para {userEmail}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Usado em redefinição de senha
        </p>
      </div>

      {/* TOTP Setup Dialog */}
      <Dialog open={isTotpDialogOpen} onOpenChange={(open) => {
        setIsTotpDialogOpen(open);
        if (!open) resetTotpForm();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Configurar Aplicativo Autenticador
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR code com seu aplicativo autenticador ou digite o código manualmente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* QR Code */}
            {totpQrCode && (
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img src={totpQrCode} alt="QR Code" className="w-48 h-48" />
              </div>
            )}

            {/* Manual Code */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Ou digite este código manualmente:
              </Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
                  {totpSecret}
                </code>
                <Button variant="outline" size="icon" onClick={copySecret}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Verification */}
            <div className="space-y-3 pt-4 border-t">
              <Label>Digite o código de 6 dígitos do seu app:</Label>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={totpVerifyCode}
                  onChange={(value) => setTotpVerifyCode(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTotpDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={verifyTotpEnrollment}
              disabled={isVerifyingTotp || totpVerifyCode.length !== 6}
            >
              {isVerifyingTotp && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Verificar e Ativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unenroll Confirmation */}
      <AlertDialog open={!!unenrollFactorId} onOpenChange={() => setUnenrollFactorId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Desativar Autenticação de Dois Fatores?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Isso tornará sua conta menos segura. Você precisará apenas da senha para fazer login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={unenrollFactor}
              disabled={isUnenrolling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUnenrolling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
