import { MainLayout } from "@/components/layout/MainLayout";
import { TutorialTab } from "@/components/admin/TutorialTab";

export default function Tutorial() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tutorial</h1>
          <p className="text-muted-foreground mt-1">
            Aprenda a usar todas as funcionalidades do sistema
          </p>
        </div>
        
        <TutorialTab />
      </div>
    </MainLayout>
  );
}
