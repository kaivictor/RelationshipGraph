import { create } from 'zustand';
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import dagre from 'dagre';
import { calculateRelationships } from '../utils/relationship';

export type Gender = 'male' | 'female' | 'unknown';

export type PersonData = {
  name: string;
  namePinyin?: string;
  formerName?: string;
  relationship: string;
  popularName?: string;
  avatar: string;
  birthDate: string;
  gender: Gender;
  education?: string;
  phone?: string;
  qq?: string;
  wechat?: string;
  email?: string;
  address?: string;
  licensePlate?: string;
  customFieldValues?: Record<string, string>;
  isSelf?: boolean;
  customAttributes?: { key: string; value: string }[];
};

export type PersonNode = Node<PersonData>;

export type CustomFieldDef = { id: string; label: string };

export type DisplaySettings = {
  showNamePinyin: boolean;
  showFormerName: boolean;
  showRelationship: boolean;
  showPopularName: boolean;
  showAvatar: boolean;
  showBirthDate: boolean;
  showAge: boolean;
  showEducation: boolean;
  showPhone: boolean;
  showQq: boolean;
  showWechat: boolean;
  showEmail: boolean;
  showAddress: boolean;
  showLicensePlate: boolean;
  fieldOrder: string[];
  customFields: CustomFieldDef[];
  customFieldVisibility: Record<string, boolean>;
  verticalGapScale: number;
};

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  showNamePinyin: false,
  showFormerName: false,
  showRelationship: true,
  showPopularName: false,
  showAvatar: true,
  showBirthDate: true,
  showAge: true,
  showEducation: false,
  showPhone: false,
  showQq: false,
  showWechat: false,
  showEmail: false,
  showAddress: false,
  showLicensePlate: false,
  fieldOrder: ['phone', 'qq', 'wechat', 'email', 'address', 'licensePlate'],
  customFields: [],
  customFieldVisibility: {},
  verticalGapScale: 1,
};

interface FamilyState {
  nodes: PersonNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  displaySettings: DisplaySettings;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addPerson: (data: PersonData, position: { x: number; y: number }) => string;
  updatePerson: (id: string, data: Partial<PersonData>) => void;
  deletePerson: (id: string) => void;
  addRelative: (sourceId: string, type: 'father' | 'mother' | 'son' | 'daughter' | 'spouse', data: PersonData) => void;
  setSelectedNodeId: (id: string | null) => void;
  updateDisplaySettings: (patch: Partial<DisplaySettings>) => void;
  layoutGraph: () => void;
  recalculateRelationships: () => void;
  exportData: () => string;
  importData: (jsonString: string) => void;
}

const initialNodes: PersonNode[] = [
  { id: 'n1', type: 'person', position: { x: 0, y: 0 }, data: { name: '曾祖父', avatar: '', relationship: '曾祖父', birthDate: '1930-01', gender: 'male' } },
  { id: 'n2', type: 'person', position: { x: 0, y: 0 }, data: { name: '曾祖母', avatar: '', relationship: '曾祖母', birthDate: '1932-05', gender: 'female' } },
  { id: 'n3', type: 'person', position: { x: 0, y: 0 }, data: { name: '爷爷', avatar: '', relationship: '爷爷', birthDate: '1955-03', gender: 'male' } },
  { id: 'n4', type: 'person', position: { x: 0, y: 0 }, data: { name: '奶奶', avatar: '', relationship: '奶奶', birthDate: '1958-07', gender: 'female' } },
  { id: 'n5', type: 'person', position: { x: 0, y: 0 }, data: { name: '爸爸', namePinyin: 'Zhang Wei', avatar: '', relationship: '爸爸', birthDate: '1980-02', gender: 'male', education: '硕士', phone: '13900139000', qq: '12345678' } },
  { id: 'n6', type: 'person', position: { x: 0, y: 0 }, data: { name: '妈妈', avatar: '', relationship: '妈妈', birthDate: '1982-09', gender: 'female' } },
  { id: 'n7', type: 'person', position: { x: 0, y: 0 }, data: { name: '叔叔', avatar: '', relationship: '叔叔', birthDate: '1985-11', gender: 'male' } },
  { id: 'self', type: 'person', position: { x: 0, y: 0 }, data: { name: '自己', namePinyin: 'Zhang San', formerName: '张小三', avatar: '', relationship: '自己', popularName: '小三', birthDate: '2005-06', gender: 'male', education: '本科', phone: '13800138000', wechat: 'zhangsan_wx', email: 'zhangsan@example.com', address: '北京市朝阳区', licensePlate: '京A88888', isSelf: true } },
  { id: 'n9', type: 'person', position: { x: 0, y: 0 }, data: { name: '妹妹', avatar: '', relationship: '妹妹', birthDate: '2008-08', gender: 'female' } },
  { id: 'n10', type: 'person', position: { x: 0, y: 0 }, data: { name: '爱人', avatar: '', relationship: '爱人', birthDate: '2006-04', gender: 'female' } },
  { id: 'n11', type: 'person', position: { x: 0, y: 0 }, data: { name: '儿子', avatar: '', relationship: '儿子', birthDate: '2030-01', gender: 'male' } },
  { id: 'n12', type: 'person', position: { x: 0, y: 0 }, data: { name: '女儿', avatar: '', relationship: '女儿', birthDate: '2032-03', gender: 'female' } },
];

const initialEdges: Edge[] = [
  { id: 'e-n1-n2', source: 'n1', target: 'n2', data: { type: 'spouse' }, type: 'spouse' },
  { id: 'e-n1-n3', source: 'n1', target: 'n3', data: { type: 'parent-child' }, type: 'straight' },
  { id: 'e-n2-n3', source: 'n2', target: 'n3', data: { type: 'parent-child' }, type: 'straight' },
  { id: 'e-n3-n4', source: 'n3', target: 'n4', data: { type: 'spouse' }, type: 'spouse' },
  { id: 'e-n3-n5', source: 'n3', target: 'n5', data: { type: 'parent-child' }, type: 'straight' },
  { id: 'e-n4-n5', source: 'n4', target: 'n5', data: { type: 'parent-child' }, type: 'straight' },
  { id: 'e-n3-n7', source: 'n3', target: 'n7', data: { type: 'parent-child' }, type: 'straight' },
  { id: 'e-n4-n7', source: 'n4', target: 'n7', data: { type: 'parent-child' }, type: 'straight' },
  { id: 'e-n5-n6', source: 'n5', target: 'n6', data: { type: 'spouse' }, type: 'spouse' },
  { id: 'e-n5-self', source: 'n5', target: 'self', data: { type: 'parent-child' }, type: 'straight' },
  { id: 'e-n6-self', source: 'n6', target: 'self', data: { type: 'parent-child' }, type: 'straight' },
  { id: 'e-n5-n9', source: 'n5', target: 'n9', data: { type: 'parent-child' }, type: 'straight' },
  { id: 'e-n6-n9', source: 'n6', target: 'n9', data: { type: 'parent-child' }, type: 'straight' },
  { id: 'e-self-n10', source: 'self', target: 'n10', data: { type: 'spouse' }, type: 'spouse' },
  { id: 'e-self-n11', source: 'self', target: 'n11', data: { type: 'parent-child' }, type: 'straight' },
  { id: 'e-n10-n11', source: 'n10', target: 'n11', data: { type: 'parent-child' }, type: 'straight' },
  { id: 'e-self-n12', source: 'self', target: 'n12', data: { type: 'parent-child' }, type: 'straight' },
  { id: 'e-n10-n12', source: 'n10', target: 'n12', data: { type: 'parent-child' }, type: 'straight' },
];

function resolveOverlaps(nodes: PersonNode[]): PersonNode[] {
  const NODE_WIDTH = 200; // 160 width + 40 gap
  const NODE_HEIGHT = 220; // accommodates name/gender + relationship + avatar + info + attrs
  
  let hasOverlap = true;
  let iterations = 0;
  const result = nodes.map(n => ({ ...n, position: { ...n.position } }));

  while (hasOverlap && iterations < 100) {
    hasOverlap = false;
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const n1 = result[i];
        const n2 = result[j];
        const dx = n1.position.x - n2.position.x;
        const dy = n1.position.y - n2.position.y;

        if (Math.abs(dx) < NODE_WIDTH && Math.abs(dy) < NODE_HEIGHT) {
          hasOverlap = true;
          const pushDist = (NODE_WIDTH - Math.abs(dx)) / 2 + 5;
          if (n1.position.x >= n2.position.x) {
            n1.position.x += pushDist;
            n2.position.x -= pushDist;
          } else {
            n1.position.x -= pushDist;
            n2.position.x += pushDist;
          }
        }
      }
    }
    iterations++;
  }
  return result;
}

function applyRelativeYPositions(nodes: PersonNode[], gapScale: number = 1): PersonNode[] {
  if (nodes.length === 0) return nodes;

  const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;
  const scale = gapScale > 0 ? gapScale : 1;

  function getGapPixels(years: number) {
    if (years <= 0) return 0;
    if (years <= 3) return years * 20 * scale; // 0-3 years: up to 60px
    if (years <= 10) return (60 + (years - 3) * 10) * scale; // 3-10 years: up to 130px
    if (years <= 20) return (130 + (years - 10) * 8) * scale; // 10-20 years: up to 210px
    return (210 + (years - 20) * 4) * scale; // >20 years: 4px per year
  }

  // Group nodes by birthDate to ensure people with EXACT same birthDate have EXACT same Y
  const uniqueDates = Array.from(new Set(nodes.map(n => n.data.birthDate || '1990-01'))).sort((a, b) => {
    const timeA = new Date(a).getTime();
    const timeB = new Date(b).getTime();
    return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
  });

  const dateToY = new Map<string, number>();
  let currentY = 0;
  let previousTime = new Date(uniqueDates[0]).getTime();
  if (isNaN(previousTime)) previousTime = 0;

  dateToY.set(uniqueDates[0], currentY);

  for (let i = 1; i < uniqueDates.length; i++) {
    let currentTime = new Date(uniqueDates[i]).getTime();
    if (isNaN(currentTime)) currentTime = previousTime;

    const yearsDiff = (currentTime - previousTime) / MS_PER_YEAR;
    currentY += getGapPixels(yearsDiff);
    
    dateToY.set(uniqueDates[i], currentY);
    previousTime = currentTime;
  }

  const nodesWithY = nodes.map(node => ({
    ...node,
    position: {
      ...node.position,
      y: dateToY.get(node.data.birthDate || '1990-01') || 0
    }
  }));

  return resolveOverlaps(nodesWithY);
}

export const useFamilyStore = create<FamilyState>((set, get) => ({
  nodes: applyRelativeYPositions(initialNodes),
  edges: initialEdges,
  selectedNodeId: null,
  displaySettings: DEFAULT_DISPLAY_SETTINGS,

  onNodesChange: (changes) => {
    const currentNodes = get().nodes;
    const modifiedChanges = changes.map(change => {
      if (change.type === 'position' && change.position) {
        const node = currentNodes.find(n => n.id === change.id);
        if (node) {
          // Keep the original Y position to restrict dragging to X-axis only
          return {
            ...change,
            position: { x: change.position.x, y: node.position.y },
            positionAbsolute: change.positionAbsolute ? { x: change.positionAbsolute.x, y: node.position.y } : undefined
          };
        }
      }
      return change;
    });
    set({
      nodes: applyNodeChanges(modifiedChanges, currentNodes) as PersonNode[],
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
    });
  },

  addPerson: (data, position) => {
    const id = uuidv4();
    const newNode: PersonNode = {
      id,
      type: 'person',
      position,
      data,
    };
    set({ nodes: applyRelativeYPositions([...get().nodes, newNode], get().displaySettings.verticalGapScale) });
    return id;
  },

  updatePerson: (id, data) => {
    const updatedNodes = get().nodes.map((node) => {
      if (node.id === id) {
        return { ...node, data: { ...node.data, ...data } };
      }
      return node;
    });
    set({ nodes: applyRelativeYPositions(updatedNodes, get().displaySettings.verticalGapScale) });
    get().recalculateRelationships();
  },

  deletePerson: (id) => {
    if (id === 'self') return; // Cannot delete self
    const filteredNodes = get().nodes.filter((node) => node.id !== id);
    set({
      nodes: applyRelativeYPositions(filteredNodes, get().displaySettings.verticalGapScale),
      edges: get().edges.filter((edge) => edge.source !== id && edge.target !== id),
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
    });
    get().recalculateRelationships();
  },

  addRelative: (sourceId, type, data) => {
    const newId = uuidv4();
    const sourceNode = get().nodes.find((n) => n.id === sourceId);
    if (!sourceNode) return;

    const isParent = type === 'father' || type === 'mother';
    const isChild = type === 'son' || type === 'daughter';
    const isSpouse = type === 'spouse';

    // Calculate position: Y is strictly based on birthDate, X is relative to source
    const position = {
      x: sourceNode.position.x + (isSpouse ? 220 : (Math.random() * 100 - 50)),
      y: 0, // Will be updated by applyRelativeYPositions
    };

    const newNode: PersonNode = {
      id: newId,
      type: 'person',
      position,
      data,
    };

    let newEdges: Edge[] = [];

    if (isParent) {
      newEdges.push({ id: `e-${newId}-${sourceId}`, source: newId, target: sourceId, data: { type: 'parent-child' }, type: 'straight' });
      
      // If source already has a parent, link the new parent to the existing parent as spouse
      const existingParentEdges = get().edges.filter(e => e.target === sourceId && e.data?.type === 'parent-child');
      existingParentEdges.forEach(e => {
        newEdges.push({
          id: `e-spouse-${newId}-${e.source}`,
          source: newId,
          target: e.source,
          data: { type: 'spouse' },
          type: 'spouse',
        });
      });

    } else if (isChild) {
      newEdges.push({ id: `e-${sourceId}-${newId}`, source: sourceId, target: newId, data: { type: 'parent-child' }, type: 'straight' });
      
      // If source has spouses, link them to the new child too
      const spouseEdges = get().edges.filter(e => e.data?.type === 'spouse' && (e.source === sourceId || e.target === sourceId));
      spouseEdges.forEach(e => {
        const spouseId = e.source === sourceId ? e.target : e.source;
        newEdges.push({
          id: `e-${spouseId}-${newId}`,
          source: spouseId,
          target: newId,
          data: { type: 'parent-child' },
          type: 'straight'
        });
      });

    } else if (isSpouse) {
      newEdges.push({ id: `e-spouse-${sourceId}-${newId}`, source: sourceId, target: newId, data: { type: 'spouse' }, type: 'spouse' });
      
      // If source has children, link the new spouse to the children
      const childEdges = get().edges.filter(e => e.source === sourceId && e.data?.type === 'parent-child');
      childEdges.forEach(e => {
        newEdges.push({
          id: `e-${newId}-${e.target}`,
          source: newId,
          target: e.target,
          data: { type: 'parent-child' },
          type: 'straight'
        });
      });
    }

    set({
      nodes: applyRelativeYPositions([...get().nodes, newNode], get().displaySettings.verticalGapScale),
      edges: [...get().edges, ...newEdges],
    });

    get().recalculateRelationships();
  },

  recalculateRelationships: () => {
    const { nodes, edges } = get();
    const relationships = calculateRelationships(nodes, edges);
    
    const newNodes = nodes.map(node => {
      const rel = relationships.get(node.id);
      if (rel && rel !== node.data.relationship) {
        return { ...node, data: { ...node.data, relationship: rel } };
      }
      return node;
    });

    set({ nodes: newNodes });
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  updateDisplaySettings: (patch) => {
    const oldSettings = get().displaySettings;
    const newSettings = { ...oldSettings, ...patch };
    set({ displaySettings: newSettings });
    // 垂直间距比例变化时重新应用 Y 布局
    if (patch.verticalGapScale !== undefined && patch.verticalGapScale !== oldSettings.verticalGapScale) {
      set({ nodes: applyRelativeYPositions(get().nodes, newSettings.verticalGapScale) });
    }
  },

  layoutGraph: () => {
    const { nodes, edges } = get();
    if (nodes.length === 0) return;

    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 120 });

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: 160, height: 120 });
    });

    edges.forEach((edge) => {
      if (edge.data?.type === 'spouse') {
        dagreGraph.setEdge(edge.source, edge.target, { minlen: 0, weight: 10 });
      } else {
        dagreGraph.setEdge(edge.source, edge.target, { minlen: 1, weight: 1 });
      }
    });

    dagre.layout(dagreGraph);

    const newNodes = nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      return {
        ...node,
        position: {
          ...node.position,
          x: nodeWithPosition.x - 80,
        },
      };
    });

    set({ nodes: applyRelativeYPositions(newNodes, get().displaySettings.verticalGapScale) });
  },

  exportData: () => {
    const { nodes, edges, displaySettings } = get();
    return JSON.stringify({ nodes, edges, displaySettings }, null, 2);
  },

  importData: (jsonString) => {
    try {
      const data = JSON.parse(jsonString);
      if (data.nodes && data.edges) {
        set({
          nodes: data.nodes,
          edges: data.edges,
          selectedNodeId: null,
          displaySettings: { ...DEFAULT_DISPLAY_SETTINGS, ...(data.displaySettings || {}) },
        });
        get().recalculateRelationships();
      }
    } catch (e) {
      console.error('Failed to import data', e);
      alert('导入失败，请检查文件格式是否正确。');
    }
  },
}));
