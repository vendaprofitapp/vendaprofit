import { MainLayout } from "@/components/layout/MainLayout";
import { DirectPartnerships } from "@/components/partnerships/DirectPartnerships";

export default function PartnershipsSociedade() {
  return (
    <MainLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sociedades 1-1</h1>
          <p className="text-muted-foreground">Gerencie suas sociedades diretas com parceiras</p>
        </div>
      </div>
      <DirectPartnerships />
    </MainLayout>
  );
}
