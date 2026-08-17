import { Edge } from '@xyflow/react';
import { PersonNode } from '../store/useRelationshipStore';

type PathStep = {
  dir: 'up' | 'down' | 'spouse' | 'sibling' | 'custom';
  gender: string;
  age: number;
  id: string;
  customLabel?: string;
};

type AdjEntry = {
  to: string;
  dir: 'up' | 'down' | 'spouse' | 'sibling' | 'custom';
  customLabel?: string;
};

export function calculateRelationships(
  nodes: PersonNode[],
  edges: Edge[],
  existingOverrides?: Map<string, string>
): Map<string, string> {
  const selfNode = nodes.find(n => n.data.isSelf);
  if (!selfNode) return new Map<string, string>();

  // 构建邻接表
  const adj = new Map<string, AdjEntry[]>();
  nodes.forEach(n => adj.set(n.id, []));

  edges.forEach(e => {
    const type = e.data?.type as string;
    if (type === 'parent-child') {
      adj.get(e.source)?.push({ to: e.target, dir: 'down' });
      adj.get(e.target)?.push({ to: e.source, dir: 'up' });
    } else if (type === 'spouse') {
      adj.get(e.source)?.push({ to: e.target, dir: 'spouse' });
      adj.get(e.target)?.push({ to: e.source, dir: 'spouse' });
    } else if (type === 'sibling') {
      adj.get(e.source)?.push({ to: e.target, dir: 'sibling' });
      adj.get(e.target)?.push({ to: e.source, dir: 'sibling' });
    } else if (type === 'custom') {
      const label = (e.data as { customLabel?: string })?.customLabel;
      adj.get(e.source)?.push({ to: e.target, dir: 'custom', customLabel: label });
      adj.get(e.target)?.push({ to: e.source, dir: 'custom', customLabel: label });
    }
  });

  // BFS
  const queue: { id: string; path: PathStep[] }[] = [];
  const visited = new Set<string>();

  queue.push({ id: selfNode.id, path: [] });
  visited.add(selfNode.id);

  const relationships = new Map<string, string>();
  relationships.set(selfNode.id, '自己');

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;

    if (id !== selfNode.id) {
      // 如果该节点的称谓被用户手动覆盖，保留用户设置
      if (!existingOverrides?.has(id)) {
        const node = nodes.find(n => n.id === id)!;
        relationships.set(id, getTitle(path, node, selfNode, nodes));
      }
    }

    const neighbors = adj.get(id) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.to)) {
        visited.add(neighbor.to);
        const neighborNode = nodes.find(n => n.id === neighbor.to)!;
        // 自定义关系：直接设置称谓，不继续传递
        if (neighbor.dir === 'custom') {
          relationships.set(neighbor.to, neighbor.customLabel || '自定义');
          continue;
        }
        queue.push({
          id: neighbor.to,
          path: [
            ...path,
            {
              dir: neighbor.dir,
              gender: neighborNode.data.gender,
              age: getAge(neighborNode.data.birthDate),
              id: neighborNode.id,
            },
          ],
        });
      }
    }
  }

  return relationships;
}

function getAge(birthDate: string): number {
  if (!birthDate) return 0;
  const time = new Date(birthDate).getTime();
  return isNaN(time) ? 0 : time;
}

/**
 * 根据路径、目标节点、自己节点计算称谓
 *
 * 路径方向：up=父母, down=子女, spouse=爱人, sibling=兄弟姐妹
 * 路径步骤记录的是每一步「到达的节点」，因此：
 *   s0 = 第一步到达的节点（如 up 时为父母、spouse 时为爱人）
 *   s1 = 第二步到达的节点
 *   s2 = 第三步到达的节点
 * 计算规则：优先匹配长路径，从最具体的称谓开始判断
 */
function getTitle(
  path: PathStep[],
  targetNode: PersonNode,
  selfNode: PersonNode,
  allNodes: PersonNode[]
): string {
  const targetGender = targetNode.data.gender;
  const targetAge = getAge(targetNode.data.birthDate);
  const selfAge = getAge(selfNode.data.birthDate);

  // getAge 返回出生时间戳，数值越小=出生越早=年长
  const ageDiff = selfAge - targetAge;

  const dirs = path.map(p => p.dir).join('-');

  // targetIsOlder：目标比自己年长
  const targetIsOlder = ageDiff > 0;

  // 各步骤中间节点
  const s0 = path[0];
  const s1 = path[1];
  const s2 = path[2];
  const s3 = path[3];

  // ============ 基本关系 ============
  if (dirs === 'up') {
    if (targetGender === 'female') return '母亲';
    if (targetGender === 'male') return '父亲';
    return '父亲/母亲';
  }
  if (dirs === 'down') {
    if (targetGender === 'female') return '女儿';
    if (targetGender === 'male') return '儿子';
    return '儿子/女儿';
  }
  if (dirs === 'spouse') {
    if (targetGender === 'female') return '妻子';
    if (targetGender === 'male') return '丈夫';
    return '爱人';
  }
  if (dirs === 'sibling') {
    if (targetGender === 'male') return targetIsOlder ? '哥哥' : '弟弟';
    if (targetGender === 'female') return targetIsOlder ? '姐姐' : '妹妹';
    return targetIsOlder ? '兄/姐' : '弟/妹';
  }

  // ============ 祖辈 / 孙辈 ============
  // up-up: s0=父母, target=祖父母
  if (dirs === 'up-up') {
    const parentGender = s0.gender;
    if (parentGender === 'male') {
      if (targetGender === 'male') return '祖父';
      if (targetGender === 'female') return '祖母';
    } else {
      if (targetGender === 'male') return '外祖父';
      if (targetGender === 'female') return '外祖母';
    }
    return '祖父母';
  }
  // down-down: s0=子女, target=孙辈
  if (dirs === 'down-down') {
    const childGender = s0.gender;
    if (childGender === 'male') {
      if (targetGender === 'male') return '孙子';
      if (targetGender === 'female') return '孙女';
    } else {
      if (targetGender === 'male') return '外孙';
      if (targetGender === 'female') return '外孙女';
    }
    return '孙辈';
  }
  // up-up-up: s0=父母, s1=祖父母, target=曾祖辈
  // 曾/外曾 取决于是否纯父系（父→父→?）；祖父/祖母 取决于 target 性别
  if (dirs === 'up-up-up') {
    const parentGender = s0.gender;
    const grandparentGender = s1.gender;
    const isPurePatrilineal = parentGender === 'male' && grandparentGender === 'male';
    if (isPurePatrilineal) {
      return targetGender === 'male' ? '曾祖父' : '曾祖母';
    }
    return targetGender === 'male' ? '外曾祖父' : '外曾祖母';
  }
  // down-down-down: s0=子女, s1=孙辈, target=曾孙辈
  if (dirs === 'down-down-down') {
    const childGender = s0.gender;
    const grandchildGender = s1.gender;
    if (childGender === 'male') {
      if (grandchildGender === 'male') return '曾孙子';
      if (grandchildGender === 'female') return '曾孙女';
    } else {
      if (grandchildGender === 'male') return '外曾孙子';
      if (grandchildGender === 'female') return '外曾孙女';
    }
    return '曾孙辈';
  }

  // ============ 兄弟姐妹（通过共享父母） ============
  // up-down: s0=父母, target=兄弟姐妹
  if (dirs === 'up-down') {
    if (targetGender === 'male') return targetIsOlder ? '哥哥' : '弟弟';
    if (targetGender === 'female') return targetIsOlder ? '姐姐' : '妹妹';
    return targetIsOlder ? '兄/姐' : '弟/妹';
  }

  // ============ 继父母 ============
  // up-spouse: s0=父母, target=父母的爱人（继父/继母）
  if (dirs === 'up-spouse') {
    const parentGender = s0.gender;
    if (parentGender === 'male') {
      // 父亲的爱人（非母亲）= 继母
      return targetGender === 'female' ? '继母' : '长辈';
    } else {
      // 母亲的爱人（非父亲）= 继父
      return targetGender === 'male' ? '继父' : '长辈';
    }
  }

  // ============ 伯叔舅姨姑 ============
  // up-up-down: s0=父母, s1=祖父母, target=父母的兄弟姐妹
  if (dirs === 'up-up-down') {
    const parentGender = s0.gender;
    const parentAge = s0.age;
    const isOlderThanParent = targetAge < parentAge; // target 出生更早 = 比父母年长

    if (parentGender === 'male') {
      // 父方：父亲的兄弟 = 伯/叔，父亲的姐妹 = 姑
      if (targetGender === 'male') return isOlderThanParent ? '伯父' : '叔叔';
      if (targetGender === 'female') return '姑姑';
    } else if (parentGender === 'female') {
      // 母方：母亲的兄弟 = 舅，母亲的姐妹 = 姨
      if (targetGender === 'male') return '舅舅';
      if (targetGender === 'female') return '阿姨';
    }
    return '长辈';
  }

  // ============ 侄外甥 ============
  // up-down-down: s0=父母, s1=兄弟姐妹, target=兄弟姐妹的子女
  if (dirs === 'up-down-down') {
    const siblingGender = s1.gender;
    if (siblingGender === 'male') {
      // 兄弟的子女 = 侄
      if (targetGender === 'male') return '侄子';
      if (targetGender === 'female') return '侄女';
    } else {
      // 姐妹的子女 = 外甥/外甥女
      if (targetGender === 'male') return '外甥';
      if (targetGender === 'female') return '外甥女';
    }
    return '晚辈';
  }

  // ============ 公婆岳父母 ============
  // spouse-up: s0=爱人, target=爱人的父母
  if (dirs === 'spouse-up') {
    const spouseGender = s0.gender;
    if (spouseGender === 'female') {
      // 妻子的父母 = 岳父/岳母
      if (targetGender === 'male') return '岳父';
      if (targetGender === 'female') return '岳母';
    } else {
      // 丈夫的父母 = 公公/婆婆
      if (targetGender === 'male') return '公公';
      if (targetGender === 'female') return '婆婆';
    }
    return '爱人父母';
  }

  // ============ 继子女 ============
  // spouse-down: s0=爱人, target=爱人的子女（继子/继女）
  if (dirs === 'spouse-down') {
    if (targetGender === 'male') return '继子';
    if (targetGender === 'female') return '继女';
    return '继子女';
  }

  // ============ 儿媳女婿 ============
  // down-spouse: s0=子女, target=子女的爱人
  if (dirs === 'down-spouse') {
    const childGender = s0.gender;
    if (childGender === 'male') {
      // 儿子的妻子 = 儿媳
      return '儿媳';
    } else {
      // 女儿的丈夫 = 女婿
      return '女婿';
    }
  }

  // ============ 兄弟姐妹的爱人 ============
  // sibling-spouse: s0=兄弟姐妹, target=兄弟姐妹的爱人
  // up-down-spouse: s0=父母, s1=兄弟姐妹, target=兄弟姐妹的爱人
  if (dirs === 'sibling-spouse' || dirs === 'up-down-spouse') {
    const siblingStep = dirs === 'sibling-spouse' ? s0 : s1;
    const siblingGender = siblingStep.gender;
    const siblingAge = siblingStep.age;
    const siblingIsOlder = siblingAge < selfAge; // 兄弟姐妹出生更早 = 比自己大

    if (siblingGender === 'male') {
      // 兄弟的妻子
      return siblingIsOlder ? '嫂子' : '弟妹';
    } else {
      // 姐妹的丈夫
      return siblingIsOlder ? '姐夫' : '妹夫';
    }
  }

  // ============ 爱人的兄弟姐妹 ============
  // spouse-sibling: s0=爱人, s1=爱人的兄弟姐妹(target)
  // spouse-up-down: s0=爱人, s1=爱人的父母, s2=爱人的兄弟姐妹(target)
  if (dirs === 'spouse-sibling' || dirs === 'spouse-up-down') {
    const spouseGender = s0.gender;
    const spouseAge = s0.age;
    const siblingStep = dirs === 'spouse-sibling' ? s1 : s2;
    const siblingGender = siblingStep?.gender;
    const siblingAge = siblingStep?.age;
    // 相对于爱人判断长幼
    const siblingIsOlderThanSpouse = siblingAge !== undefined && siblingAge < spouseAge;

    if (spouseGender === 'female') {
      // 妻子的兄弟姐妹
      if (siblingGender === 'male') {
        return siblingIsOlderThanSpouse ? '内兄' : '内弟';
      } else {
        return siblingIsOlderThanSpouse ? '姨姐' : '姨妹';
      }
    } else {
      // 丈夫的兄弟姐妹
      if (siblingGender === 'male') {
        return siblingIsOlderThanSpouse ? '大伯子' : '小叔子';
      } else {
        return siblingIsOlderThanSpouse ? '大姑子' : '小姑子';
      }
    }
  }

  // ============ 堂表兄弟姐妹 ============
  // up-up-down-down: s0=父母, s1=祖父母, s2=伯叔舅姨姑, target=堂表兄弟姐妹
  if (dirs === 'up-up-down-down') {
    const parentGender = s0.gender;
    const uncleAuntGender = s2.gender;
    const isCousinOlder = targetAge < selfAge; // 堂表比自己年长

    if (parentGender === 'male') {
      // 父方
      if (uncleAuntGender === 'male') {
        // 伯父/叔叔的子女 = 堂
        if (targetGender === 'male') return isCousinOlder ? '堂哥' : '堂弟';
        if (targetGender === 'female') return isCousinOlder ? '堂姐' : '堂妹';
      } else {
        // 姑姑的子女 = 表
        if (targetGender === 'male') return isCousinOlder ? '表哥' : '表弟';
        if (targetGender === 'female') return isCousinOlder ? '表姐' : '表妹';
      }
    } else {
      // 母方：均为表
      if (targetGender === 'male') return isCousinOlder ? '表哥' : '表弟';
      if (targetGender === 'female') return isCousinOlder ? '表姐' : '表妹';
    }
  }

  // ============ 侄外甥的子女 ============
  // up-down-down-down: s0=父母, s1=兄弟姐妹, s2=侄/外甥, target=侄孙/外甥孙
  if (dirs === 'up-down-down-down') {
    const nephewGender = s2.gender;
    if (nephewGender === 'male') {
      if (targetGender === 'male') return '侄孙';
      if (targetGender === 'female') return '侄孙女';
    } else {
      if (targetGender === 'male') return '外甥孙';
      if (targetGender === 'female') return '外甥孙女';
    }
    return '晚辈';
  }

  // ============ 伯叔舅姨姑的爱人 ============
  // up-up-down-spouse: s0=父母, s1=祖父母, s2=伯叔舅姨姑, target=其爱人
  if (dirs === 'up-up-down-spouse') {
    const uncleAuntGender = s2.gender;
    const uncleAuntAge = s2.age;
    const parentGender = s0.gender;
    const parentAge = s0.age;
    // 伯/叔 的大小是相对于自己的父母判断
    const uncleIsOlderThanParent = uncleAuntAge < parentAge;

    if (parentGender === 'male') {
      // 父方
      if (uncleAuntGender === 'male') {
        // 伯父/叔叔的妻子
        return uncleIsOlderThanParent ? '伯母' : '婶婶';
      } else {
        // 姑姑的丈夫
        return '姑父';
      }
    } else {
      // 母方
      if (uncleAuntGender === 'male') {
        // 舅舅的妻子
        return '舅妈';
      } else {
        // 阿姨的丈夫
        return '姨夫';
      }
    }
  }

  // ============ 孙辈的爱人 ============
  // down-down-spouse: s0=子女, s1=孙辈, target=孙辈的爱人
  if (dirs === 'down-down-spouse') {
    const grandchildGender = s1.gender;
    if (grandchildGender === 'male') {
      return '孙媳';
    } else {
      return '孙女婿';
    }
  }

  // ============ 曾孙辈的爱人 ============
  // down-down-down-spouse: s0=子女, s1=孙辈, s2=曾孙辈, target=其爱人
  if (dirs === 'down-down-down-spouse') {
    const ggcGender = s2.gender;
    if (ggcGender === 'male') return '曾孙媳';
    return '曾孙女婿';
  }

  // ============ 爱人的祖辈 ============
  // spouse-up-up: s0=爱人, s1=爱人的父母, target=爱人的祖父母
  if (dirs === 'spouse-up-up') {
    const spouseGender = s0.gender;
    const parentGender = s1.gender;
    if (spouseGender === 'female') {
      // 妻子的祖父母
      if (parentGender === 'male') {
        if (targetGender === 'male') return '岳祖父';
        if (targetGender === 'female') return '岳祖母';
      } else {
        if (targetGender === 'male') return '外祖岳父';
        if (targetGender === 'female') return '外祖岳母';
      }
    } else {
      // 丈夫的祖父母
      if (parentGender === 'male') {
        if (targetGender === 'male') return '公公的父亲';
        if (targetGender === 'female') return '公公的母亲';
      } else {
        if (targetGender === 'male') return '婆婆的父亲';
        if (targetGender === 'female') return '婆婆的母亲';
      }
    }
    return '爱人祖辈';
  }

  // ============ 兄弟姐妹的孙辈 ============
  // up-down-down-down-down: 兄弟姐妹的孙辈
  if (dirs === 'up-down-down-down-down') {
    if (targetGender === 'male') return '侄曾孙';
    if (targetGender === 'female') return '侄曾孙女';
    return '晚辈';
  }

  // ============ 曾祖辈的子女（祖父的兄弟姐妹） ============
  // up-up-up-down: s0=父母, s1=祖父母, s2=曾祖父母, target=祖父母的兄弟姐妹
  // 父系祖父的兄弟=伯祖父/叔祖父，姐妹=姑祖母；母系外祖父的兄弟=舅祖父，姐妹=姨祖母
  if (dirs === 'up-up-up-down') {
    const parentGender = s0.gender;       // 自己父母性别（决定父系/母系）
    const grandparentGender = s1.gender;  // 祖父母性别（决定祖父/外祖父一支）
    const grandparentAge = s1.age;        // 祖父母出生时间，用于判断 target 比祖父母年长/年幼
    const isOlderThanGrandparent = targetAge < grandparentAge;

    if (parentGender === 'male' && grandparentGender === 'male') {
      // 纯父系：祖父的兄弟姐妹
      if (targetGender === 'male') return isOlderThanGrandparent ? '伯祖父' : '叔祖父';
      if (targetGender === 'female') return '姑祖母';
    } else if (parentGender === 'female' && grandparentGender === 'male') {
      // 母系：外祖父的兄弟姐妹
      if (targetGender === 'male') return '舅祖父';
      if (targetGender === 'female') return '姨祖母';
    } else if (grandparentGender === 'female') {
      // 祖母/外祖母的兄弟姐妹：依父系/母系统称表伯祖/表叔祖等较生僻，归为「未知」交由用户手动设置
      return '未知';
    }
    return '祖辈';
  }

  // ============ 曾祖辈子女的爱人 ============
  // up-up-up-down-spouse: 祖父兄弟姐妹的爱人（伯祖母/叔祖母/姑祖父/舅祖母/姨祖父）
  if (dirs === 'up-up-up-down-spouse') {
    const parentGender = s0.gender;
    const grandparentGender = s1.gender;
    const targetSpouseGender = targetGender; // 爱人本身性别
    if (parentGender === 'male' && grandparentGender === 'male') {
      // 祖父的兄弟姐妹的爱人
      if (targetSpouseGender === 'female') return '伯祖母'; // 伯祖父/叔祖父的妻子统称，简化
      if (targetSpouseGender === 'male') return '姑祖父';
    } else if (parentGender === 'female' && grandparentGender === 'male') {
      if (targetSpouseGender === 'female') return '舅祖母';
      if (targetSpouseGender === 'male') return '姨祖父';
    }
    return '未知';
  }

  // ============ 曾祖辈的孙辈（祖父兄弟姐妹的子女） ============
  // up-up-up-down-down: 祖父兄弟的子女 = 堂伯/堂叔（父系）或表伯/表叔
  if (dirs === 'up-up-up-down-down') {
    const parentGender = s0.gender;
    const grandparentGender = s1.gender;
    const greatUncleGender = s3?.gender; // 祖父的兄弟姐妹（s3=第四步到达的节点）
    const isOlderThanParent = targetAge < selfAge; // 相比自己判断长幼

    if (parentGender === 'male' && grandparentGender === 'male') {
      // 纯父系：祖父兄弟的子女 = 堂伯/堂叔；祖父姐妹的子女 = 表伯/表叔
      if (greatUncleGender === 'male') {
        if (targetGender === 'male') return isOlderThanParent ? '堂伯' : '堂叔';
        if (targetGender === 'female') return isOlderThanParent ? '堂姑' : '堂姑';
      } else {
        if (targetGender === 'male') return isOlderThanParent ? '表伯' : '表叔';
        if (targetGender === 'female') return isOlderThanParent ? '表姑' : '表姑';
      }
    } else {
      // 母系或混合：统称表
      if (targetGender === 'male') return isOlderThanParent ? '表伯' : '表叔';
      if (targetGender === 'female') return '表姑';
    }
    return '未知';
  }

  // ============ 曾祖辈的曾孙辈（祖父兄弟姐妹的孙辈） ============
  // up-up-up-down-down-down: 祖父兄弟的孙辈 = 堂兄弟姐妹的子女一代，简化为「再从」
  if (dirs === 'up-up-up-down-down-down') {
    const isOlder = targetAge < selfAge;
    if (targetGender === 'male') return isOlder ? '堂兄' : '堂弟'; // 简化：远房堂兄弟
    if (targetGender === 'female') return isOlder ? '堂姐' : '堂妹';
    return '未知';
  }

  // 兜底：超出已实现计算范围，返回「未知」由用户手动设置
  return '未知';
}
