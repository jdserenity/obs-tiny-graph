import { TFile } from 'obsidian';

export interface GraphOptions {
  mode?: 'filtered' | 'manual';
  target?: string;
  exclude?: string[];
  nodes?: string[];
  error?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  file: TFile | null;
  /** The note this graph is "about" (host note, or filtered target). */
  isCenter?: boolean;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
