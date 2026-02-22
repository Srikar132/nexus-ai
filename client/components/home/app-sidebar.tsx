"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  Home,
  Folder,
  Settings,
  User,
  PlusCircle,
  BarChart3,
  FileText,
  Bell,
  Search,
  Calendar,
  MessageSquare,
  Command,
} from "lucide-react"

// Menu items data
const data = {
  navigation: [
    {
      name: "Dashboard",
      url: "/home",
      icon: Home,
    },
    {
      name: "Projects", 
      url: "/home/projects",
      icon: Folder,
    },
  ],
  actions: [
    {
      name: "Create Project",
      url: "/home/project/new",
      icon: PlusCircle,
    },
    {
      name: "Search", 
      url: "/home/search",
      icon: Search,
    },
    {
      name: "Notifications",
      url: "/home/notifications",
      icon: Bell,
    },
  ],
  settings: [
    {
      name: "Settings",
      url: "/settings",
      icon: Settings,
    },  
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/home" className="flex items-center gap-2">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Command className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Nexus AI</span>
                  <span className="truncate text-xs">Enterprise</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.navigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton 
                    tooltip={item.name} 
                    isActive={pathname === item.url}
                    asChild
                  >
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.name}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Quick Actions */}
        <SidebarGroup>
          <SidebarGroupLabel>Quick Actions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.actions.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton 
                    tooltip={item.name} 
                    isActive={pathname === item.url}
                    asChild
                  >
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.name}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {data.settings.map((item) => (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton 
                tooltip={item.name} 
                isActive={pathname === item.url}
                asChild
              >
                <a href={item.url}>
                  <item.icon />
                  <span>{item.name}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
      
      {/* This rail enables the hover-to-expand and click-to-toggle functionality */}
      <SidebarRail />
    </Sidebar>
  )
}
