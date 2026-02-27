"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OnMount, BeforeMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

// Dynamically import Monaco Editor to avoid SSR issues
const MonacoEditor = dynamic(
    () => import("@monaco-editor/react").then((mod) => mod.default),
    {
        ssr: false,
        loading: () => <EditorLoadingState />,
    }
);

// Loading state component
function EditorLoadingState() {
    return (
        <div className="flex flex-col items-center justify-center h-full bg-[#1e1e1e]">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <span className="text-sm text-muted-foreground">
                Initializing editor...
            </span>
        </div>
    );
}

// Monaco editor wrapper props
interface MonacoEditorWrapperProps {
    content: string;
    language: string;
    fileName?: string;
    onChange?: (value: string | undefined) => void;
    readOnly?: boolean;
    className?: string;
}

// Disable Monaco validation markers (red underlines) for preview mode
const disableValidation: BeforeMount = (monaco) => {
    // Disable TypeScript/JavaScript validation
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
        noSuggestionDiagnostics: true,
    });
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
        noSuggestionDiagnostics: true,
    });

    // Disable JSON validation
    monaco.languages.json?.jsonDefaults?.setDiagnosticsOptions?.({
        validate: false,
    });
};

// Custom VS Code dark theme configuration
const defineCustomTheme: BeforeMount = (monaco) => {
    // First disable all validation to remove red underlines
    disableValidation(monaco);

    monaco.editor.defineTheme("nexus-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [
            { token: "comment", foreground: "6A9955", fontStyle: "italic" },
            { token: "keyword", foreground: "569CD6" },
            { token: "string", foreground: "CE9178" },
            { token: "number", foreground: "B5CEA8" },
            { token: "type", foreground: "4EC9B0" },
            { token: "class", foreground: "4EC9B0" },
            { token: "function", foreground: "DCDCAA" },
            { token: "variable", foreground: "9CDCFE" },
            { token: "constant", foreground: "4FC1FF" },
            { token: "parameter", foreground: "9CDCFE" },
            { token: "property", foreground: "9CDCFE" },
            { token: "punctuation", foreground: "D4D4D4" },
            { token: "operator", foreground: "D4D4D4" },
            { token: "tag", foreground: "569CD6" },
            { token: "attribute.name", foreground: "9CDCFE" },
            { token: "attribute.value", foreground: "CE9178" },
        ],
        colors: {
            "editor.background": "#131314",
            "editor.foreground": "#D4D4D4",
            "editor.lineHighlightBackground": "#1e1e21",
            "editor.selectionBackground": "#264F78",
            "editor.inactiveSelectionBackground": "#3A3D41",
            "editorLineNumber.foreground": "#5A5A5A",
            "editorLineNumber.activeForeground": "#C6C6C6",
            "editorCursor.foreground": "#8AB4F8",
            "editor.selectionHighlightBackground": "#ADD6FF26",
            "editorIndentGuide.background": "#404040",
            "editorIndentGuide.activeBackground": "#707070",
            "editorBracketMatch.background": "#0D3A58",
            "editorBracketMatch.border": "#888888",
            "scrollbarSlider.background": "#79797966",
            "scrollbarSlider.hoverBackground": "#646464B3",
            "scrollbarSlider.activeBackground": "#BFBFBF66",
            "editorGutter.background": "#131314",
            "editorWidget.background": "#1e1e21",
            "editorWidget.border": "#3a3a3d",
            "editorSuggestWidget.background": "#1e1e21",
            "editorSuggestWidget.border": "#3a3a3d",
            "editorSuggestWidget.selectedBackground": "#2a2d33",
            "editorHoverWidget.background": "#1e1e21",
            "editorHoverWidget.border": "#3a3a3d",
        },
    });
};

// Monaco Editor Wrapper Component
export function MonacoEditorWrapper({
    content,
    language,
    fileName,
    onChange,
    readOnly = true, // Default to read-only for preview mode
    className,
}: MonacoEditorWrapperProps) {
    const [isEditorReady, setIsEditorReady] = useState(false);
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

    // Handle editor mount
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleEditorMount: OnMount = useCallback((editor, _monaco) => {
        editorRef.current = editor;
        setIsEditorReady(true);

        // Configure editor options
        editor.updateOptions({
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            fontLigatures: true,
            lineHeight: 20,
            letterSpacing: 0.3,
            padding: { top: 16, bottom: 16 },
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            renderWhitespace: "selection",
            bracketPairColorization: { enabled: true },
            guides: {
                bracketPairs: true,
                indentation: true,
            },
        });

        // Focus editor
        editor.focus();
    }, []);

    // Handle content change
    const handleChange = useCallback(
        (value: string | undefined) => {
            onChange?.(value);
        },
        [onChange]
    );

    return (
        <div className={cn("relative h-full w-full", className)}>
            <MonacoEditor
                height="100%"
                language={language}
                value={content}
                theme="nexus-dark"
                beforeMount={defineCustomTheme}
                onMount={handleEditorMount}
                onChange={handleChange}
                options={{
                    readOnly,
                    domReadOnly: readOnly, // Prevent any DOM-level editing
                    minimap: {
                        enabled: true,
                        scale: 1,
                        showSlider: "mouseover",
                    },
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    automaticLayout: true,
                    tabSize: 2,
                    insertSpaces: true,
                    formatOnPaste: false,
                    formatOnType: false,
                    folding: true,
                    foldingHighlight: true,
                    showFoldingControls: "mouseover",
                    lineNumbers: "on",
                    glyphMargin: false,
                    renderLineHighlight: "line",
                    renderLineHighlightOnlyWhenFocus: false,
                    scrollbar: {
                        vertical: "visible",
                        horizontal: "visible",
                        verticalScrollbarSize: 10,
                        horizontalScrollbarSize: 10,
                        useShadows: false,
                    },
                    overviewRulerBorder: false,
                    hideCursorInOverviewRuler: true,
                    contextmenu: !readOnly, // Only show context menu if editable
                    mouseWheelZoom: true,
                    // Disable all editing suggestions in read-only mode
                    quickSuggestions: !readOnly,
                    suggestOnTriggerCharacters: !readOnly,
                    acceptSuggestionOnEnter: readOnly ? "off" : "on",
                    tabCompletion: readOnly ? "off" : "on",
                    parameterHints: { enabled: !readOnly },
                    hover: { enabled: true, delay: 300 },
                    // Disable validation decorations (red underlines)
                    renderValidationDecorations: "off",
                }}
                loading={<EditorLoadingState />}
            />

            {/* File name indicator */}
            {fileName && isEditorReady && (
                <div className="absolute top-2 right-4 px-2 py-1 rounded bg-background/80 backdrop-blur-sm border border-border/50 text-xs text-muted-foreground">
                    {fileName}
                </div>
            )}
        </div>
    );
}
