"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Mail, Zap, Shield, BarChart3, Star, CheckCircle2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function LandingPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-transparent text-foreground overflow-hidden selection:bg-primary/30">
      
      {/* Floating Pill Navbar (Serpbays Style) */}
      <nav className="fixed w-full z-50 top-6 px-6 flex justify-center">
        <div className="w-full max-w-4xl bg-background/60 backdrop-blur-xl border border-border/60 rounded-full h-14 flex items-center justify-between px-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="flex items-center gap-2 font-extrabold text-lg tracking-tight">
            <div className="w-7 h-7 bg-gradient-to-tr from-[#FF4D00] to-[#F44336] rounded-full flex items-center justify-center shadow-lg shadow-[#FF4D00]/20">
              <Mail className="w-3.5 h-3.5 text-white" />
            </div>
            MailFlow
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-muted-foreground">
            <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
            <Link href="#pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="#faq" className="hover:text-foreground transition-colors">FAQ</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-bold text-foreground hover:text-primary transition-colors">
              Sign in
            </Link>
            <Link href="/login" className="bg-foreground text-background px-5 py-2 rounded-full text-sm font-bold hover:scale-105 transition-transform">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 lg:pt-56 lg:pb-32 px-6 flex flex-col items-center justify-center text-center">
        {/* Ambient background glow behind hero */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-[#FF4D00]/20 to-[#F44336]/20 blur-[120px] rounded-full pointer-events-none -z-10" />
        
        <div className="max-w-5xl mx-auto relative z-10 flex flex-col items-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background border border-border shadow-sm text-sm font-bold mb-8"
          >
            <span className="flex h-2.5 w-2.5 rounded-full bg-[#FF4D00] animate-pulse"></span>
            MailFlow 2.0 is officially live
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-6xl md:text-7xl lg:text-[84px] font-extrabold tracking-tighter mb-8 leading-[1.05]"
          >
            Scale your outreach. <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D00] to-[#F44336]">Dominate the inbox.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl font-medium"
          >
            Stop fighting with legacy tools. MailFlow is the fastest, most powerful engine to send cold emails, rotate domains, and book meetings on autopilot.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
          >
            <Link href="/login" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-[#FF4D00] to-[#F44336] text-white px-8 py-4 rounded-full text-lg font-bold transition-all shadow-[0_20px_50px_-12px_rgba(255,77,0,0.5)] hover:shadow-[0_20px_60px_-10px_rgba(255,77,0,0.7)] hover:scale-105 active:scale-95">
              Start your 14-day free trial
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/dashboard" className="w-full sm:w-auto flex items-center justify-center gap-2 bg-background text-foreground px-8 py-4 rounded-full text-lg font-bold transition-all border border-border shadow-sm hover:bg-muted active:scale-95">
              View Live Demo
            </Link>
          </motion.div>

          <motion.div
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ duration: 1, delay: 0.6 }}
             className="mt-12 flex items-center gap-4 text-sm font-semibold text-muted-foreground"
          >
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-[#FF4D00]" /> No credit card required
            </div>
            <div className="w-1 h-1 rounded-full bg-border" />
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-[#FF4D00]" /> Setup in 2 minutes
            </div>
          </motion.div>
        </div>
      </section>

      {/* Dashboard Preview / Floating Glass UI */}
      <section className="px-6 pb-32">
        <div className="max-w-6xl mx-auto relative">
          {/* Glassmorphism Dashboard Mockup */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="rounded-[2.5rem] bg-background/40 backdrop-blur-2xl border border-border/80 p-4 md:p-8 shadow-[0_30px_100px_-20px_rgba(0,0,0,0.1)] relative z-20"
          >
            <div className="bg-card rounded-3xl border border-border overflow-hidden h-[400px] md:h-[600px] relative flex flex-col shadow-inner">
               <div className="h-14 border-b border-border bg-background/50 flex items-center px-6 gap-4">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <div className="flex-1 flex justify-center">
                     <div className="px-32 py-1.5 rounded-md bg-background border border-border text-xs font-medium text-muted-foreground">mailflow.com/dashboard</div>
                  </div>
               </div>
               <div className="flex-1 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-repeat opacity-[0.03] absolute inset-0 pointer-events-none mix-blend-overlay"></div>
               <div className="p-8 relative z-10 flex flex-col gap-6 h-full">
                  <div className="flex justify-between items-center">
                    <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
                    <div className="h-10 w-32 bg-[#FF4D00]/20 rounded-full animate-pulse" />
                  </div>
                  <div className="grid grid-cols-4 gap-6">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="h-32 bg-background border border-border rounded-2xl p-5 shadow-sm">
                        <div className="h-10 w-10 bg-muted rounded-xl mb-4" />
                        <div className="h-6 w-24 bg-muted rounded-md" />
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 bg-background border border-border rounded-2xl mt-4" />
               </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid (Rounded-3xl Cards) */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">Built for ultimate performance.</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-medium">Everything you need to run high-volume cold email campaigns without landing in the spam folder.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: "Next-Gen Speed", desc: "Our infrastructure is built on Next.js and Redis. Navigate through thousands of leads with zero loading screens." },
              { icon: Shield, title: "Deliverability Engine", desc: "Automated inbox warmup, smart sender rotation, and spam-word detection keeps your domains safe." },
              { icon: BarChart3, title: "Deep Analytics", desc: "Track opens, clicks, and replies in real-time. Make data-driven decisions with statistical A/B testing." }
            ].map((feature, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                key={i} 
                className="p-10 rounded-[2rem] bg-card border border-border hover:border-[#FF4D00]/30 transition-colors group shadow-sm hover:shadow-lg"
              >
                <div className="w-14 h-14 rounded-full bg-[#FF4D00]/10 flex items-center justify-center mb-8 text-[#FF4D00] group-hover:scale-110 group-hover:bg-[#FF4D00] group-hover:text-white transition-all duration-300">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold mb-4 tracking-tight">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed font-medium">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Huge CTA */}
      <section className="py-32 px-6">
        <div className="max-w-5xl mx-auto bg-foreground text-background rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-[#FF4D00]/30 to-transparent rounded-full blur-[80px]" />
          <h2 className="text-4xl md:text-6xl font-extrabold tracking-tighter mb-8 relative z-10">Ready to scale your revenue?</h2>
          <p className="text-xl opacity-80 mb-10 max-w-2xl mx-auto font-medium relative z-10">Join 5,000+ top performing sales teams who use MailFlow to automate their outreach.</p>
          <Link href="/login" className="inline-flex items-center justify-center gap-2 bg-[#FF4D00] hover:bg-[#E64500] text-white px-10 py-5 rounded-full text-xl font-bold transition-all shadow-[0_20px_50px_-12px_rgba(255,77,0,0.6)] hover:scale-105 active:scale-95 relative z-10">
            Get Started for Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/50 text-center">
        <p className="text-muted-foreground font-semibold">© 2026 MailFlow Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
