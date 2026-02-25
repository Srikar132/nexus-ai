"use client";

import { X, Paperclip, Camera, Globe } from "lucide-react";
import { useRef } from "react";

const MENU_ITEMS = [
    { icon: Paperclip, label: "Add files or photos", action: "file" },
    { icon: Globe, label: "Web search", check: true },
];

export function AttachMenuDialog({ open, onOpenChange, anchorEl }: { open: boolean; onOpenChange: (v: boolean) => void; anchorEl?: HTMLElement | null }) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    function handleMenuClick(item: any) {
        if (item.action === "file") {
            fileInputRef.current?.click();
            return;
        }
        if (item.action === "screenshot") {
            alert("Screenshot functionality is not implemented in this demo.");
            onOpenChange(false);
            return;
        }
        onOpenChange(false);
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (files && files.length > 0) {
            // Handle file upload logic here
            alert(`Selected file: ${files[0].name}`);
        }
        onOpenChange(false);
    }

    return (
        open && (
            <div
                className="fixed z-50"
                style={anchorEl ? {
                    top: anchorEl.getBoundingClientRect().bottom + 8 + window.scrollY,
                    left: anchorEl.getBoundingClientRect().left + window.scrollX,
                } : {}}
            >
                <div className="w-64 p-0 bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in-0 slide-in-from-top-2 relative">
                    {/* X button */}
                    <button
                        className="absolute top-2 right-2 p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => onOpenChange(false)}
                        aria-label="Close"
                        tabIndex={0}
                    >
                        <X className="h-4 w-4" />
                    </button>
                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFileChange}
                        multiple={false}
                    />
                    <div className="py-2">
                        {MENU_ITEMS.map((item, i) =>
                            item.divider ? (
                                <div key={i} className="my-1 border-t border-border" />
                            ) : (
                                <button
                                    key={item.label}
                                    className={`
                    flex items-center w-full px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors
                    ${item.check ? "justify-between" : ""}
                  `}
                                    tabIndex={0}
                                    onClick={() => handleMenuClick(item)}
                                >
                                    <span className="flex items-center gap-2">
                                        <item.icon className="h-4 w-4" />
                                        {item.label}
                                    </span>
                                    {item.check && <span className="text-primary">✔</span>}
                                </button>
                            )
                        )}
                    </div>
                </div>
            </div>
        )
    );
}
