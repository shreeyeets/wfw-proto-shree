export interface WysaTool {
  name: string;
  triggers: string[];
  url: string;
}

export interface ChatMessage {
  id: number;
  from: 'user' | 'wysa';
  text: string;
  visible: boolean;
  card?: boolean;
  widget?: WysaTool;
}

export interface QuickReply {
  type?: string;
  label?: string;
  action?: () => void;
}
