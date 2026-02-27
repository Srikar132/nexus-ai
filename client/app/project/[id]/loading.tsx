"use client";

import { motion } from "framer-motion";
import { Loader2, Code, Zap, Sparkles } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      {/* Background gradient animation */}
      <motion.div
        className="absolute inset-0 opacity-30"
        animate={{
          background: [
            "radial-gradient(circle at 20% 50%, oklch(0.61 0.225 280/10%) 0%, transparent 50%)",
            "radial-gradient(circle at 80% 50%, oklch(0.61 0.225 280/10%) 0%, transparent 50%)",
            "radial-gradient(circle at 40% 80%, oklch(0.61 0.225 280/10%) 0%, transparent 50%)",
          ],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "linear",
        }}
      />

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-primary/20 rounded-full"
          animate={{
            x: [0, 100, 0, -100, 0],
            y: [0, -100, 0, 100, 0],
            opacity: [0, 1, 0.5, 1, 0],
          }}
          transition={{
            duration: 6 + i,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.5,
          }}
          style={{
            left: `${20 + i * 15}%`,
            top: `${30 + i * 8}%`,
          }}
        />
      ))}

      {/* Main loading content */}
      <div className="relative z-10 flex flex-col items-center space-y-8 max-w-md mx-auto px-6">
        {/* Logo/Icon area with pulse effect */}
        <motion.div
          className="relative"
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {/* Pulsing ring */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-primary/30"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
          
          {/* Inner content */}
          <div className="relative w-20 h-20 rounded-full bg-card border border-border flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              <Code className="w-8 h-8 text-primary" />
            </motion.div>
          </div>
        </motion.div>

        {/* Loading text with typewriter effect */}
        <div className="text-center space-y-3">
          <motion.h1
            className="text-2xl font-semibold text-foreground"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Setting up your workspace
          </motion.h1>
          
          <motion.p
            className="text-muted-foreground text-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Preparing your project environment...
          </motion.p>
        </div>

        {/* Loading stages with stagger animation */}
        <div className="w-full space-y-3">
          {[
            { icon: Zap, text: "Initializing project", delay: 0 },
            { icon: Code, text: "Setting up development environment", delay: 0.8 },
            { icon: Sparkles, text: "Configuring workspace", delay: 1.6 },
          ].map((stage, index) => (
            <motion.div
              key={index}
              className="flex items-center space-x-3 p-3 rounded-xl bg-card/50 border border-border/50"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ 
                duration: 0.5, 
                delay: stage.delay,
                ease: "easeOut" 
              }}
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: stage.delay,
                }}
              >
                <stage.icon className="w-5 h-5 text-primary" />
              </motion.div>
              
              <span className="text-sm text-foreground font-medium">
                {stage.text}
              </span>
              
              <motion.div
                className="ml-auto"
                animate={{ rotate: 360 }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "linear",
                  delay: stage.delay,
                }}
              >
                <Loader2 className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </motion.div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="w-full">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Progress</span>
            <motion.span
              key="percentage"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              Loading...
            </motion.span>
          </div>
          
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full relative"
              initial={{ width: "0%" }}
              animate={{ width: ["0%", "60%", "85%", "60%"] }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {/* Shimmer effect */}
              <motion.div
                className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -skew-x-12"
                animate={{ x: ["-100%", "200%"] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "linear",
                  repeatDelay: 1,
                }}
              />
            </motion.div>
          </div>
        </div>

        {/* Tip text */}
        <motion.div
          className="text-center p-4 rounded-xl bg-muted/30 border border-border/30"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 2 }}
        >
          <p className="text-xs text-muted-foreground">
            💡 <strong>Tip:</strong> Your workspace will include all the tools and configurations needed to start building immediately.
          </p>
        </motion.div>
      </div>

      {/* Corner sparkles */}
      {[
        { top: "10%", left: "10%" },
        { top: "20%", right: "15%" },
        { bottom: "15%", left: "15%" },
        { bottom: "25%", right: "10%" },
      ].map((position, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={position}
          animate={{
            scale: [0, 1, 0],
            opacity: [0, 1, 0],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.7,
          }}
        >
          <Sparkles className="w-4 h-4 text-primary/40" />
        </motion.div>
      ))}
    </div>
  );
}