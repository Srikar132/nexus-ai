"use client"

import { GripVerticalIcon } from "lucide-react"
import { Group, Panel, Separator } from "react-resizable-panels"
import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

type GroupProps = ComponentProps<typeof Group>
type ResizablePanelGroupProps = Omit<GroupProps, "orientation"> & {
  direction?: "horizontal" | "vertical"
}
type ResizablePanelProps = ComponentProps<typeof Panel>
type ResizableHandleProps = ComponentProps<typeof Separator> & {
  withHandle?: boolean
}

function ResizablePanelGroup({
  className,
  direction = "horizontal",
  ...props
}: ResizablePanelGroupProps) {
  return (
    <Group
      orientation={direction}
      className={cn("h-full w-full", className)}
      {...props}
    />
  )
}

function ResizablePanel({ className, ...props }: ResizablePanelProps) {
  return (
    <Panel
      className={cn("overflow-hidden", className)}
      {...props}
    />
  )
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: ResizableHandleProps) {
  return (
    <Separator
      className={cn(
        "relative flex w-2 items-center justify-center bg-border/50 transition-colors hover:bg-border data-[orientation=vertical]:h-2 data-[orientation=vertical]:w-full",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-6 w-1.5 items-center justify-center rounded-full bg-muted-foreground/30 transition-colors group-hover:bg-muted-foreground/50 data-[orientation=vertical]:h-1.5 data-[orientation=vertical]:w-6">
          <GripVerticalIcon className="h-3 w-3 text-muted-foreground" />
        </div>
      )}
    </Separator>
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
