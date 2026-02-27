"use client";

import { useRef } from "react";
import { Paperclip, Globe, Plus } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface AttachMenuProps {
    onFileSelect?: (files: FileList) => void;
    webSearchEnabled?: boolean;
    onWebSearchToggle?: (enabled: boolean) => void;
}

export function AttachMenu({
    onFileSelect,
    webSearchEnabled = true,
    onWebSearchToggle,
}: AttachMenuProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    function handleFileClick() {
        fileInputRef.current?.click();
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (files && files.length > 0) {
            onFileSelect?.(files);
        }
        // Reset input so same file can be selected again
        e.target.value = "";
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl"
                    aria-label="Open attach menu"
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.txt,.md"
                />

                <DropdownMenuItem onClick={handleFileClick}>
                    <Paperclip className="h-4 w-4" />
                    <span>Add files or photos</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuCheckboxItem
                    checked={webSearchEnabled}
                    onCheckedChange={onWebSearchToggle}
                >
                    <Globe className="h-4 w-4" />
                    <span>Web search</span>
                </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
