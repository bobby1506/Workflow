"use client";

import { useCallback, useRef } from "react";
import { nanoid } from "nanoid";
import { useWorkflowEditorStore } from "../store/workflowEditorStore";
import { NON_DELETABLE_NODES } from "../constants";
import type { WorkflowNode } from "../types";

const PASTE_OFFSET = 40; // px offset for pasted nodes

export function useCopyPaste() {
  const clipboardRef = useRef<WorkflowNode[]>([]);
  const addNode = useWorkflowEditorStore((s) => s.addNode);
  const nodes = useWorkflowEditorStore((s) => s.nodes);

  const copy = useCallback(() => {
    const selected = nodes.filter(
      (n) => n.selected && !NON_DELETABLE_NODES.includes(n.id),
    );
    clipboardRef.current = selected;
  }, [nodes]);

  const paste = useCallback(() => {
    if (clipboardRef.current.length === 0) return;

    const idMap = new Map<string, string>();

    for (const node of clipboardRef.current) {
      const newId = nanoid(8);
      idMap.set(node.id, newId);

      const pasted: WorkflowNode = {
        ...node,
        id: newId,
        selected: false,
        position: {
          x: node.position.x + PASTE_OFFSET,
          y: node.position.y + PASTE_OFFSET,
        },
        data: { ...node.data },
      } as WorkflowNode;

      addNode(pasted);
    }
  }, [addNode]);

  const duplicate = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node || NON_DELETABLE_NODES.includes(nodeId)) return;

      const newId = nanoid(8);
      const duplicated: WorkflowNode = {
        ...node,
        id: newId,
        selected: false,
        position: {
          x: node.position.x + PASTE_OFFSET,
          y: node.position.y + PASTE_OFFSET,
        },
        data: { ...node.data },
      } as WorkflowNode;

      addNode(duplicated);
    },
    [nodes, addNode],
  );

  return { copy, paste, duplicate };
}
