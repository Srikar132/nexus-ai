"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="prose prose-xs dark:prose-invert max-w-none *:my-1 *:first:mt-0 *:last:mb-0">
      <ReactMarkdown
        components={{
          // Code blocks
          code({ inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const codeContent = String(children).replace(/\n$/, "");

            return !inline && match ? (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                className="rounded-md my-1 text-xs!"
                {...props}
              >
                {codeContent}
              </SyntaxHighlighter>
            ) : (
              <code
                className="bg-muted px-1 py-0.5 rounded text-xs font-mono"
                {...props}
              >
                {children}
              </code>
            );
          },
          // Paragraphs
          p({ children }: any) {
            return <p className="leading-snug mb-1 last:mb-0 text-sm">{children}</p>;
          },
          // Lists
          ul({ children }: any) {
            return <ul className="list-disc list-inside space-y-0.5 my-1 text-sm">{children}</ul>;
          },
          ol({ children }: any) {
            return <ol className="list-decimal list-inside space-y-0.5 my-1 text-sm">{children}</ol>;
          },
          // Links
          a({ href, children }: any) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-sm"
              >
                {children}
              </a>
            );
          },
          // Headings
          h1({ children }: any) {
            return <h1 className="text-base font-semibold mt-2 mb-1">{children}</h1>;
          },
          h2({ children }: any) {
            return <h2 className="text-sm font-semibold mt-2 mb-1">{children}</h2>;
          },
          h3({ children }: any) {
            return <h3 className="text-sm font-medium mt-1 mb-0.5">{children}</h3>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
