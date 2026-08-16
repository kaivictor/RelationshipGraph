import { Edge } from '@xyflow/react';
import { PersonNode } from '../store/useFamilyStore';

export function calculateRelationships(nodes: PersonNode[], edges: Edge[]) {
  const selfNode = nodes.find(n => n.data.isSelf);
  if (!selfNode) return new Map<string, string>();

  // Build adjacency list
  const adj = new Map<string, { to: string, type: 'up' | 'down' | 'spouse' | 'sibling' }[]>();
  nodes.forEach(n => adj.set(n.id, []));

  edges.forEach(e => {
    const type = e.data?.type as string;
    if (type === 'parent-child') {
      adj.get(e.source)?.push({ to: e.target, type: 'down' });
      adj.get(e.target)?.push({ to: e.source, type: 'up' });
    } else if (type === 'spouse') {
      adj.get(e.source)?.push({ to: e.target, type: 'spouse' });
      adj.get(e.target)?.push({ to: e.source, type: 'spouse' });
    } else if (type === 'sibling') {
      adj.get(e.source)?.push({ to: e.target, type: 'sibling' });
      adj.get(e.target)?.push({ to: e.source, type: 'sibling' });
    }
  });

  // BFS
  const queue: { id: string, path: { dir: string, gender: string, age: number, id: string }[] }[] = [];
  const visited = new Set<string>();

  queue.push({ id: selfNode.id, path: [] });
  visited.add(selfNode.id);

  const relationships = new Map<string, string>();
  relationships.set(selfNode.id, '自己');

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    const node = nodes.find(n => n.id === id)!;
    
    if (id !== selfNode.id) {
      relationships.set(id, getTitle(path, node, selfNode));
    }

    const neighbors = adj.get(id) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.to)) {
        visited.add(neighbor.to);
        const neighborNode = nodes.find(n => n.id === neighbor.to)!;
        queue.push({
          id: neighbor.to,
          path: [...path, { 
            dir: neighbor.type, 
            gender: neighborNode.data.gender, 
            age: getAge(neighborNode.data.birthDate),
            id: neighborNode.id
          }]
        });
      }
    }
  }

  return relationships;
}

function getAge(birthDate: string) {
  if (!birthDate) return 0;
  const time = new Date(birthDate).getTime();
  return isNaN(time) ? 0 : time;
}

function getTitle(path: any[], targetNode: PersonNode, selfNode: PersonNode) {
  // Simplify path by removing redundant up-down if they point to the same person (shouldn't happen in BFS tree but just in case)
  const dirs = path.map(p => p.dir).join('-');
  const targetGender = targetNode.data.gender;
  const targetAge = getAge(targetNode.data.birthDate);
  const selfAge = getAge(selfNode.data.birthDate);
  const isOlder = targetAge < selfAge; // smaller timestamp = born earlier = older

  if (dirs === 'up') return targetGender === 'female' ? '母亲' : '父亲';
  if (dirs === 'down') return targetGender === 'female' ? '女儿' : '儿子';
  if (dirs === 'spouse') return targetGender === 'female' ? '妻子' : '丈夫';
  if (dirs === 'sibling') {
    if (targetGender === 'male') return isOlder ? '哥哥' : '弟弟';
    if (targetGender === 'female') return isOlder ? '姐姐' : '妹妹';
    return isOlder ? '兄/姐' : '弟/妹';
  }
  
  if (dirs === 'up-up') {
    const parentGender = path[0].gender;
    if (parentGender === 'male') return targetGender === 'female' ? '祖母' : '祖父';
    if (parentGender === 'female') return targetGender === 'female' ? '外祖母' : '外祖父';
    return targetGender === 'female' ? '祖母/外祖母' : '祖父/外祖父';
  }

  if (dirs === 'up-down') {
    if (targetGender === 'male') return isOlder ? '哥哥' : '弟弟';
    if (targetGender === 'female') return isOlder ? '姐姐' : '妹妹';
    return isOlder ? '兄/姐' : '弟/妹';
  }

  if (dirs === 'up-up-down') {
    const parentGender = path[0].gender;
    const parentAge = path[0].age;
    const isOlderThanParent = targetAge < parentAge;
    
    if (parentGender === 'male') {
      if (targetGender === 'male') return isOlderThanParent ? '伯父' : '叔叔';
      if (targetGender === 'female') return '姑姑';
    }
    if (parentGender === 'female') {
      if (targetGender === 'male') return '舅舅';
      if (targetGender === 'female') return '阿姨';
    }
    return '长辈';
  }

  if (dirs === 'up-down-down') {
    const siblingGender = path[1].gender;
    if (siblingGender === 'male') return targetGender === 'female' ? '侄女' : '侄子';
    if (siblingGender === 'female') return targetGender === 'female' ? '外甥女' : '外甥';
    return '晚辈';
  }

  if (dirs === 'down-down') {
    const childGender = path[0].gender;
    if (childGender === 'male') return targetGender === 'female' ? '孙女' : '孙子';
    if (childGender === 'female') return targetGender === 'female' ? '外孙女' : '外孙';
    return '孙辈';
  }

  if (dirs === 'up-up-up') {
    const parentGender = path[0].gender;
    if (parentGender === 'male') return targetGender === 'female' ? '曾祖母' : '曾祖父';
    if (parentGender === 'female') return targetGender === 'female' ? '外曾祖母' : '外曾祖父';
    return '曾祖辈';
  }

  if (dirs === 'down-down-down') {
    const childGender = path[0].gender;
    if (childGender === 'male') return targetGender === 'female' ? '曾孙女' : '曾孙子';
    if (childGender === 'female') return targetGender === 'female' ? '外曾孙女' : '外曾孙子';
    return '曾孙辈';
  }

  return '未知';
}
