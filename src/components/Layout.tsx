import { Outlet } from "react-router-dom";
import { Header } from "@/components/Header";
import { MainNav } from "@/components/MainNav";
import { CompareBar } from "@/components/units/CompareBar";

export default function Layout() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <MainNav />
        <Outlet />
      </main>
      <CompareBar />
    </div>
  );
}
