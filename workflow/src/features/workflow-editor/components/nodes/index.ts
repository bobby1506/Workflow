import { RequestInputsNode } from "./RequestInputsNode";
import { ResponseNode } from "./ResponseNode";
import { GeminiNode } from "./GeminiNode";
import { CropImageNode } from "./CropImageNode";
import type { NodeTypes } from "@xyflow/react";

export const nodeTypes: NodeTypes = {
  "request-inputs": RequestInputsNode,
  response: ResponseNode,
  gemini: GeminiNode,
  "crop-image": CropImageNode,
};

export { RequestInputsNode, ResponseNode, GeminiNode, CropImageNode };
