"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Home, 
  Megaphone, 
  Users, 
  BarChart3, 
  Inbox, 
  Settings,
  LogOut,
  Mail,
  Target,
  FolderOpen,
  MessageSquare,
  Plus
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/Toast";
import { InputModal } from "@/components/InputModal";
import { useState, useEffect } from "react";
import api from "@/lib/api";

const navItems = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Campaigns", href: "/campaigns", icon: Megaphone },
  { name: "Inbox", href: "/inbox", icon: Inbox },
  { name: "Leads", href: "/leads", icon: Users },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Files", href: "/files", icon: FolderOpen },
];

type Workspace = {
  id: number;
  name: string;
  plan: string;
  role: string;
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const showSettings = user?.role === "owner" || user?.role === "admin";
  const showAdmin = user?.is_admin === true;

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const fetchSidebarData = async () => {
    if (!user) return;
    try {
      // Fetch dynamic stats for inbox count
      const statsRes = await api.get("/auth/stats");
      setUnreadCount(statsRes.data.unreadInboxCount || 0);

      // Fetch dynamic workspaces/projects
      const wsRes = await api.get("/workspaces");
      const list = wsRes.data.workspaces || [];
      setWorkspaces(list);
      
      if (list.length > 0) {
        const activeId = localStorage.getItem("active_workspace_id");
        if (!activeId || !list.some((w: any) => w.id.toString() === activeId)) {
          localStorage.setItem("active_workspace_id", list[0].id.toString());
        }
      }
    } catch (err) {
      console.error("Failed to load sidebar dynamic telemetry", err);
    }
  };

  useEffect(() => {
    fetchSidebarData();
    // Poll every 10 seconds for real-time inbox badge counts
    const interval = setInterval(fetchSidebarData, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const validateWorkspaceName = (value: string) => {
    if (!value.trim()) {
      return "Workspace name is required.";
    }

    if (value.length > 50) {
      return "Workspace name must be 50 characters or less.";
    }

    if (!/^[a-zA-Z0-9 _-]+$/.test(value)) {
      return "Workspace name may only include letters, numbers, spaces, hyphens, and underscores.";
    }

    return null;
  };

  const handleCreateProject = async (name: string) => {
    setIsCreating(true);
    try {
      const res = await api.post("/workspaces", { name: name.trim() });
      if (res.data.success) {
        addToast(`Project "${name}" created successfully!`, "success");
        await fetchSidebarData();
        setIsModalOpen(false);
      }
    } catch (err) {
      addToast("Failed to create workspace project", "error");
    } finally {
      setIsCreating(false);
    }
  };

  const getProjectColor = (id: number) => {
    const colors = [
      "bg-blue-500",
      "bg-yellow-500",
      "bg-emerald-500",
      "bg-purple-500",
      "bg-rose-500",
      "bg-orange-500"
    ];
    return colors[id % colors.length];
  };

  return (
    <div className="w-[260px] h-screen bg-card border-r border-border/50 flex flex-col justify-between hidden md:flex sticky top-0 transition-colors">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Brand */}
        <div className="h-20 flex items-center px-6">
          <div className="flex items-center gap-3 font-extrabold text-xl tracking-tight text-foreground">
            <div className="w-6 h-6 rounded-full flex items-center justify-center bg-blue-500 ring-4 ring-blue-500/20">
              <div className="w-2 h-2 bg-white rounded-full"></div>
            </div>
            mailflow
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-6 mb-8">
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mb-2">
            <div className="h-full bg-foreground w-1/3 rounded-full"></div>
          </div>
          <div className="flex justify-between items-center text-xs text-muted-foreground font-medium">
            <span>Tasks left for today</span>
            <span>{unreadCount > 0 ? "Inbox Active" : "Up to Date"}</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="px-3 space-y-8">
          <div>
            <div className="px-3 mb-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-between">
              MAIN MENU
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                const isInbox = item.name === "Inbox";
                return (
                  <Link key={item.name} href={item.href}>
                    <span className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-300 group relative ${isActive ? 'text-foreground bg-muted' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:-translate-y-0.5 hover:shadow-sm'}`}>
                      {isActive && (
                        <motion.div 
                          layoutId="sidebar-active"
                          className="absolute inset-0 border border-primary/30 bg-primary/10 rounded-xl"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      <div className="flex items-center gap-3 relative z-10">
                        <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'group-hover:text-primary transition-colors'}`} />
                        <span className="font-medium text-sm">{item.name}</span>
                      </div>
                      {isInbox && unreadCount > 0 && (
                        <span className="relative z-10 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                          {unreadCount}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Dynamic Projects */}
          <div>
            <div className="px-3 mb-3 mt-6 text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center justify-between">
              PROJECTS
              <button 
                onClick={() => setIsModalOpen(true)}
                className="w-5 h-5 flex items-center justify-center opacity-70 hover:opacity-100 hover:bg-muted rounded text-sm transition-all"
                title="Add New Project"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <nav className="space-y-1">
              {workspaces.map((item) => {
                const activeId = typeof window !== 'undefined' ? localStorage.getItem("active_workspace_id") : null;
                const isActive = activeId === item.id.toString();
                return (
                  <button 
                    key={item.id} 
                    onClick={() => {
                      localStorage.setItem("active_workspace_id", item.id.toString());
                      router.push("/dashboard");
                    }}
                    className="w-full text-left focus:outline-none"
                  >
                    <span className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group relative ${isActive ? 'text-foreground bg-muted/50 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30 hover:-translate-y-0.5 hover:shadow-sm'}`}>
                      <div className={`w-2 h-2 rounded-sm ${getProjectColor(item.id)}`}></div>
                      <span className="font-medium text-sm relative z-10 truncate">{item.name}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div>
             <nav className="space-y-1 mt-6">
                  <Link href="/email-accounts">
                    <span className="flex items-center justify-between px-3 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all text-sm font-medium uppercase tracking-widest group hover:-translate-y-0.5 hover:shadow-sm">
                      EMAIL ACCOUNTS
                      <span className="text-lg opacity-50 group-hover:translate-x-1 transition-transform">{'>'}</span>
                    </span>
                  </Link>
                  {showSettings && (
                    <Link href="/settings">
                      <span className="flex items-center justify-between px-3 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all text-sm font-medium uppercase tracking-widest group hover:-translate-y-0.5 hover:shadow-sm">
                        SETTINGS
                        <span className="text-lg opacity-50 group-hover:translate-x-1 transition-transform">{'>'}</span>
                      </span>
                    </Link>
                  )}
                  {showAdmin && (
                    <Link href="/admin">
                      <span className="flex items-center justify-between px-3 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all text-sm font-medium uppercase tracking-widest group hover:-translate-y-0.5 hover:shadow-sm">
                        ADMIN
                        <span className="text-lg opacity-50 group-hover:translate-x-1 transition-transform">{'>'}</span>
                      </span>
                    </Link>
                  )}
             </nav>
          </div>
        </div>
      </div>

       <div className="p-4 border-t border-border/50 space-y-2">
         <div className="flex items-center gap-3 w-full p-2 rounded-xl bg-muted/30 text-left">
           <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-foreground font-bold text-sm uppercase">
             {user?.name?.charAt(0) || user?.email?.charAt(0) || "U"}
           </div>
           <div className="flex-1 overflow-hidden">
             <div className="text-sm font-bold text-foreground/80 truncate">
               {user?.name || user?.email || "User"}
             </div>
             <div className="text-[10px] text-muted-foreground truncate uppercase font-bold tracking-wider">
               {user?.role || "Member"} {user?.is_admin ? "(Admin)" : ""}
             </div>
           </div>
         </div>
         <button 
           onClick={logout}
           title="Click to logout"
           className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-red-500/10 hover:text-red-500 transition-colors text-left group font-medium text-sm"
         >
           <LogOut className="w-4 h-4" />
           <span>Logout</span>
         </button>
       </div>

      <InputModal
        isOpen={isModalOpen}
        title="Create New Project/Workspace"
        placeholder="Enter project name..."
        onConfirm={handleCreateProject}
        onCancel={() => setIsModalOpen(false)}
        isLoading={isCreating}
        validate={validateWorkspaceName}
      />
    </div>
  );
}
