import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { AssistantWidget } from "@/components/site/AssistantWidget";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
      <AssistantWidget />
    </div>
  );
}
