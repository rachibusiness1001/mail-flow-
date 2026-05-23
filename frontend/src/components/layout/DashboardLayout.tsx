import Sidebar from "./Sidebar";
import { Search, SlidersHorizontal } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground transition-colors duration-300">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Topbar Search */}
        <header className="h-20 border-b border-border/50 flex items-center px-8 shrink-0 bg-card/30 backdrop-blur-md relative z-20">
          <div className="w-full max-w-4xl bg-background border border-border rounded-xl flex items-center px-4 py-2.5 shadow-sm transition-all focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20">
            <Search className="w-5 h-5 text-muted-foreground mr-3" />
            <input 
              type="text" 
              placeholder="Search anything and everything" 
              className="flex-1 bg-transparent border-none outline-none text-sm font-medium placeholder:text-muted-foreground/70"
            />
            <button className="p-1 bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-8 relative z-10">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
