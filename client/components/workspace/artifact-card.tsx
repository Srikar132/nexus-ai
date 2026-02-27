"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileCode } from "lucide-react";

interface ArtifactCardProps {
  artifactType: string;
  title: string;
  content: unknown;
}

export function ArtifactCard({ artifactType, title, content }: ArtifactCardProps) {
  // Generic artifact display — pipeline v2 has no plan artifacts
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="size-4 text-primary" />
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {artifactType}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
          {JSON.stringify(content, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}
