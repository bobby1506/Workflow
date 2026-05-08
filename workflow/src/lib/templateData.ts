/**
 * The canonical demo workflow template.
 * This is the pre-built 7-node DAG matching the project spec.
 * Stored once in DB as isTemplate=true, isReadonly=true.
 */

export const TEMPLATE_WORKFLOW_NAME = "LLM Marketing Pipeline";

export const TEMPLATE_NODES = [
  {
    id: "request-inputs",
    type: "request-inputs",
    position: { x: 60, y: 300 },
    data: {
      fields: [
        {
          id: "text_field",
          type: "text_field",
          label: "text_field",
          value:
            "Product: Wireless Bluetooth Headphones. Features: Noise cancellation, 30-hour battery, foldable design.",
        },
        {
          id: "image_field",
          type: "image_field",
          label: "image_field",
          value: null,
        },
      ],
    },
    deletable: false,
  },
  {
    id: "crop-image-1",
    type: "crop-image",
    position: { x: 480, y: 100 },
    data: {
      label: "Crop Image #1",
      x: 20,
      y: 20,
      width: 60,
      height: 60,
    },
  },
  {
    id: "crop-image-2",
    type: "crop-image",
    position: { x: 480, y: 340 },
    data: {
      label: "Crop Image #2",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    },
  },
  {
    id: "gemini-1",
    type: "gemini",
    position: { x: 480, y: 580 },
    data: {
      label: "Gemini #1",
      model: "gemini-2.5-flash",
      systemPrompt:
        "You are a marketing copywriter. Write a one-paragraph product description.",
    },
  },
  {
    id: "gemini-2",
    type: "gemini",
    position: { x: 900, y: 580 },
    data: {
      label: "Gemini #2",
      model: "gemini-2.5-flash",
      systemPrompt:
        "Condense the following product description into a tweet-length hook (under 240 characters).",
    },
  },
  {
    id: "gemini-final",
    type: "gemini",
    position: { x: 1320, y: 340 },
    data: {
      label: "Final Gemini",
      model: "gemini-2.5-flash",
      systemPrompt:
        "You are a social media manager. Combine the tweet hook and the two product crops into a final marketing post.",
    },
  },
  {
    id: "response",
    type: "response",
    position: { x: 1740, y: 340 },
    data: {},
    deletable: false,
  },
];

export const TEMPLATE_EDGES = [
  // image_field → both crop nodes
  {
    id: "e-img-crop1",
    source: "request-inputs",
    sourceHandle: "image_field",
    target: "crop-image-1",
    targetHandle: "input-image",
    type: "default",
    animated: true,
  },
  {
    id: "e-img-crop2",
    source: "request-inputs",
    sourceHandle: "image_field",
    target: "crop-image-2",
    targetHandle: "input-image",
    type: "default",
    animated: true,
  },
  // text_field → gemini-1 prompt
  {
    id: "e-text-g1",
    source: "request-inputs",
    sourceHandle: "text_field",
    target: "gemini-1",
    targetHandle: "prompt",
    type: "default",
    animated: true,
  },
  // gemini-1 response → gemini-2 prompt
  {
    id: "e-g1-g2",
    source: "gemini-1",
    sourceHandle: "response",
    target: "gemini-2",
    targetHandle: "prompt",
    type: "default",
    animated: true,
  },
  // crop-1 output → final gemini vision
  {
    id: "e-crop1-gf",
    source: "crop-image-1",
    sourceHandle: "output-image",
    target: "gemini-final",
    targetHandle: "image-vision",
    type: "default",
    animated: true,
  },
  // crop-2 output → final gemini vision
  {
    id: "e-crop2-gf",
    source: "crop-image-2",
    sourceHandle: "output-image",
    target: "gemini-final",
    targetHandle: "image-vision",
    type: "default",
    animated: true,
  },
  // gemini-2 response → final gemini prompt
  {
    id: "e-g2-gf",
    source: "gemini-2",
    sourceHandle: "response",
    target: "gemini-final",
    targetHandle: "prompt",
    type: "default",
    animated: true,
  },
  // final gemini → response node
  {
    id: "e-gf-resp",
    source: "gemini-final",
    sourceHandle: "response",
    target: "response",
    targetHandle: "result",
    type: "default",
    animated: true,
  },
];

export const TEMPLATE_VIEWPORT = { x: 0, y: 0, zoom: 0.75 };
