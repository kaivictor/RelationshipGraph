import { Edge } from '@xyflow/react';
import { PersonNode } from '../store/useRelationshipStore';

export type Lang = 'zh' | 'en';

// 中文称谓 -> 英文映射（用于语言切换时的本土化）
const ZH2EN: Record<string, string> = {
  // 英文中真实存在的通用亲属词（细分的 Chinese-specific 称谓一律不翻译，英文回退 unknown）
  自己: 'myself', 父亲: 'father', 母亲: 'mother', '父亲/母亲': 'parent',
  女儿: 'daughter', 儿子: 'son', '儿子/女儿': 'child', 妻子: 'wife', 丈夫: 'husband',
  爱人: 'spouse', 哥哥: 'older brother', 弟弟: 'younger brother', 姐姐: 'older sister',
  妹妹: 'younger sister', '兄/姐': 'older sibling', '弟/妹': 'younger sibling',
  祖父: 'grandfather', 祖母: 'grandmother', 外祖父: 'grandfather', 外祖母: 'grandmother',
  祖父母: 'grandparents', 孙子: 'grandson', 孙女: 'granddaughter', 外孙: 'grandson', 外孙女: 'granddaughter',
  孙辈: 'grandchildren', 曾祖父: 'great-grandfather', 曾祖母: 'great-grandmother',
  外曾祖父: 'great-grandfather', 外曾祖母: 'great-grandmother',
  曾孙子: 'great-grandson', 曾孙女: 'great-granddaughter', 曾孙辈: 'great-grandchildren',
  伯父: 'uncle', 叔叔: 'uncle', 姑姑: 'aunt', 舅舅: 'uncle', 阿姨: 'aunt',
  侄子: 'nephew', 侄女: 'niece', 外甥: 'nephew', 外甥女: 'niece',
  长辈: 'elder', 晚辈: 'junior', 同辈: 'same generation',
  继父: 'stepfather', 继母: 'stepmother', 继子: 'stepson', 继女: 'stepdaughter', 继子女: 'stepchildren',
  岳父: 'father-in-law', 岳母: 'mother-in-law', 儿媳: 'daughter-in-law', 女婿: 'son-in-law',
  堂哥: 'cousin', 堂弟: 'cousin', 堂姐: 'cousin', 堂妹: 'cousin',
  表哥: 'cousin', 表弟: 'cousin', 表姐: 'cousin', 表妹: 'cousin',
  父母: 'parents', 子女: 'children',
  自定义: 'custom', 未知: 'unknown',
};

export function tr(zh: string, lang: Lang): string {
  if (lang === 'en') return ZH2EN[zh] ?? 'unknown';
  return zh;
}



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
  existingOverrides?: Map<string, string>,
  lang: Lang = 'zh'
): Map<string, string> {
  const r = (zh: string) => tr(zh, lang);
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
  relationships.set(selfNode.id, tr('自己', lang));

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;

    if (id !== selfNode.id) {
      // 如果该节点的称谓被用户手动覆盖，保留用户设置
      if (!existingOverrides?.has(id)) {
        const node = nodes.find(n => n.id === id)!;
        relationships.set(id, getTitle(path, node, selfNode, nodes, lang));
      }
    }

    const neighbors = adj.get(id) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.to)) {
        visited.add(neighbor.to);
        const neighborNode = nodes.find(n => n.id === neighbor.to)!;
        // 自定义关系：直接设置称谓，不继续传递
        if (neighbor.dir === 'custom') {
          relationships.set(neighbor.to, neighbor.customLabel || r('自定义'));
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
  allNodes: PersonNode[],
  lang: Lang = 'zh'
): string {
  const r = (zh: string) => tr(zh, lang);
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
    if (targetGender === 'female') return r('母亲');
    if (targetGender === 'male') return r('父亲');
    return r('父亲/母亲');
  }
  if (dirs === 'down') {
    if (targetGender === 'female') return r('女儿');
    if (targetGender === 'male') return r('儿子');
    return r('儿子/女儿');
  }
  if (dirs === 'spouse') {
    if (targetGender === 'female') return r('妻子');
    if (targetGender === 'male') return r('丈夫');
    return r('爱人');
  }
  if (dirs === 'sibling') {
    if (targetGender === 'male') return targetIsOlder ? r('哥哥') : r('弟弟');
    if (targetGender === 'female') return targetIsOlder ? r('姐姐') : r('妹妹');
    return targetIsOlder ? r('兄/姐') : r('弟/妹');
  }

  // ============ 祖辈 / 孙辈 ============
  // up-up: s0=父母, target=祖父母
  if (dirs === 'up-up') {
    const parentGender = s0.gender;
    if (parentGender === 'male') {
      if (targetGender === 'male') return r('祖父');
      if (targetGender === 'female') return r('祖母');
    } else {
      if (targetGender === 'male') return r('外祖父');
      if (targetGender === 'female') return r('外祖母');
    }
    return r('祖父母');
  }
  // down-down: s0=子女, target=孙辈
  if (dirs === 'down-down') {
    const childGender = s0.gender;
    if (childGender === 'male') {
      if (targetGender === 'male') return r('孙子');
      if (targetGender === 'female') return r('孙女');
    } else {
      if (targetGender === 'male') return r('外孙');
      if (targetGender === 'female') return r('外孙女');
    }
    return r('孙辈');
  }
  // up-up-up: s0=父母, s1=祖父母, target=曾祖辈
  // 曾/外曾 取决于是否纯父系（父→父→?）；祖父/祖母 取决于 target 性别
  if (dirs === 'up-up-up') {
    const parentGender = s0.gender;
    const grandparentGender = s1.gender;
    const isPurePatrilineal = parentGender === 'male' && grandparentGender === 'male';
    if (isPurePatrilineal) {
      return targetGender === 'male' ? r('曾祖父') : r('曾祖母');
    }
    return targetGender === 'male' ? r('外曾祖父') : r('外曾祖母');
  }
  // down-down-down: s0=子女, s1=孙辈, target=曾孙辈
  if (dirs === 'down-down-down') {
    const childGender = s0.gender;
    const grandchildGender = s1.gender;
    if (childGender === 'male') {
      if (grandchildGender === 'male') return r('曾孙子');
      if (grandchildGender === 'female') return r('曾孙女');
    } else {
      if (grandchildGender === 'male') return r('外曾孙子');
      if (grandchildGender === 'female') return r('外曾孙女');
    }
    return r('曾孙辈');
  }

  // ============ 兄弟姐妹（通过共享父母） ============
  // up-down: s0=父母, target=兄弟姐妹
  if (dirs === 'up-down') {
    if (targetGender === 'male') return targetIsOlder ? r('哥哥') : r('弟弟');
    if (targetGender === 'female') return targetIsOlder ? r('姐姐') : r('妹妹');
    return targetIsOlder ? r('兄/姐') : r('弟/妹');
  }

  // ============ 继父母 ============
  // up-spouse: s0=父母, target=父母的爱人（继父/继母）
  if (dirs === 'up-spouse') {
    const parentGender = s0.gender;
    if (parentGender === 'male') {
      // 父亲的爱人（非母亲）= 继母
      return targetGender === 'female' ? r('继母') : r('长辈');
    } else {
      // 母亲的爱人（非父亲）= 继父
      return targetGender === 'male' ? r('继父') : r('长辈');
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
      if (targetGender === 'male') return isOlderThanParent ? r('伯父') : r('叔叔');
      if (targetGender === 'female') return r('姑姑');
    } else if (parentGender === 'female') {
      // 母方：母亲的兄弟 = 舅，母亲的姐妹 = 姨
      if (targetGender === 'male') return r('舅舅');
      if (targetGender === 'female') return r('阿姨');
    }
    return r('长辈');
  }

  // ============ 侄外甥 ============
  // up-down-down: s0=父母, s1=兄弟姐妹, target=兄弟姐妹的子女
  if (dirs === 'up-down-down') {
    const siblingGender = s1.gender;
    if (siblingGender === 'male') {
      // 兄弟的子女 = 侄
      if (targetGender === 'male') return r('侄子');
      if (targetGender === 'female') return r('侄女');
    } else {
      // 姐妹的子女 = 外甥/外甥女
      if (targetGender === 'male') return r('外甥');
      if (targetGender === 'female') return r('外甥女');
    }
    return r('晚辈');
  }

  // ============ 公婆岳父母 ============
  // spouse-up: s0=爱人, target=爱人的父母
  if (dirs === 'spouse-up') {
    const spouseGender = s0.gender;
    if (spouseGender === 'female') {
      // 妻子的父母 = 岳父/岳母
      if (targetGender === 'male') return r('岳父');
      if (targetGender === 'female') return r('岳母');
    } else {
      // 丈夫的父母 = 公公/婆婆
      if (targetGender === 'male') return r('公公');
      if (targetGender === 'female') return r('婆婆');
    }
    return r('爱人父母');
  }

  // ============ 继子女 ============
  // spouse-down: s0=爱人, target=爱人的子女（继子/继女）
  if (dirs === 'spouse-down') {
    if (targetGender === 'male') return r('继子');
    if (targetGender === 'female') return r('继女');
    return r('继子女');
  }

  // ============ 儿媳女婿 ============
  // down-spouse: s0=子女, target=子女的爱人
  if (dirs === 'down-spouse') {
    const childGender = s0.gender;
    if (childGender === 'male') {
      // 儿子的妻子 = 儿媳
      return r('儿媳');
    } else {
      // 女儿的丈夫 = 女婿
      return r('女婿');
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
      return siblingIsOlder ? r('嫂子') : r('弟妹');
    } else {
      // 姐妹的丈夫
      return siblingIsOlder ? r('姐夫') : r('妹夫');
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
        return siblingIsOlderThanSpouse ? r('内兄') : r('内弟');
      } else {
        return siblingIsOlderThanSpouse ? r('姨姐') : r('姨妹');
      }
    } else {
      // 丈夫的兄弟姐妹
      if (siblingGender === 'male') {
        return siblingIsOlderThanSpouse ? r('大伯子') : r('小叔子');
      } else {
        return siblingIsOlderThanSpouse ? r('大姑子') : r('小姑子');
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
        if (targetGender === 'male') return isCousinOlder ? r('堂哥') : r('堂弟');
        if (targetGender === 'female') return isCousinOlder ? r('堂姐') : r('堂妹');
      } else {
        // 姑姑的子女 = 表
        if (targetGender === 'male') return isCousinOlder ? r('表哥') : r('表弟');
        if (targetGender === 'female') return isCousinOlder ? r('表姐') : r('表妹');
      }
    } else {
      // 母方：均为表
      if (targetGender === 'male') return isCousinOlder ? r('表哥') : r('表弟');
      if (targetGender === 'female') return isCousinOlder ? r('表姐') : r('表妹');
    }
  }

  // ============ 侄外甥的子女 ============
  // up-down-down-down: s0=父母, s1=兄弟姐妹, s2=侄/外甥, target=侄孙/外甥孙
  if (dirs === 'up-down-down-down') {
    const nephewGender = s2.gender;
    if (nephewGender === 'male') {
      if (targetGender === 'male') return r('侄孙');
      if (targetGender === 'female') return r('侄孙女');
    } else {
      if (targetGender === 'male') return r('外甥孙');
      if (targetGender === 'female') return r('外甥孙女');
    }
    return r('晚辈');
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
        return uncleIsOlderThanParent ? r('伯母') : r('婶婶');
      } else {
        // 姑姑的丈夫
        return r('姑父');
      }
    } else {
      // 母方
      if (uncleAuntGender === 'male') {
        // 舅舅的妻子
        return r('舅妈');
      } else {
        // 阿姨的丈夫
        return r('姨夫');
      }
    }
  }

  // ============ 孙辈的爱人 ============
  // down-down-spouse: s0=子女, s1=孙辈, target=孙辈的爱人
  if (dirs === 'down-down-spouse') {
    const grandchildGender = s1.gender;
    if (grandchildGender === 'male') {
      return r('孙媳');
    } else {
      return r('孙女婿');
    }
  }

  // ============ 曾孙辈的爱人 ============
  // down-down-down-spouse: s0=子女, s1=孙辈, s2=曾孙辈, target=其爱人
  if (dirs === 'down-down-down-spouse') {
    const ggcGender = s2.gender;
    if (ggcGender === 'male') return r('曾孙媳');
    return r('曾孙女婿');
  }

  // ============ 爱人的祖辈 ============
  // spouse-up-up: s0=爱人, s1=爱人的父母, target=爱人的祖父母
  if (dirs === 'spouse-up-up') {
    const spouseGender = s0.gender;
    const parentGender = s1.gender;
    if (spouseGender === 'female') {
      // 妻子的祖父母
      if (parentGender === 'male') {
        if (targetGender === 'male') return r('岳祖父');
        if (targetGender === 'female') return r('岳祖母');
      } else {
        if (targetGender === 'male') return r('外祖岳父');
        if (targetGender === 'female') return r('外祖岳母');
      }
    } else {
      // 丈夫的祖父母
      if (parentGender === 'male') {
        if (targetGender === 'male') return r('公公的父亲');
        if (targetGender === 'female') return r('公公的母亲');
      } else {
        if (targetGender === 'male') return r('婆婆的父亲');
        if (targetGender === 'female') return r('婆婆的母亲');
      }
    }
    return r('爱人祖辈');
  }

  // ============ 兄弟姐妹的孙辈 ============
  // up-down-down-down-down: 兄弟姐妹的孙辈
  if (dirs === 'up-down-down-down-down') {
    if (targetGender === 'male') return r('侄曾孙');
    if (targetGender === 'female') return r('侄曾孙女');
    return r('晚辈');
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
      if (targetGender === 'male') return isOlderThanGrandparent ? r('伯祖父') : r('叔祖父');
      if (targetGender === 'female') return r('姑祖母');
    } else if (parentGender === 'female' && grandparentGender === 'male') {
      // 母系：外祖父的兄弟姐妹
      if (targetGender === 'male') return r('舅祖父');
      if (targetGender === 'female') return r('姨祖母');
    } else if (grandparentGender === 'female') {
      // 祖母/外祖母的兄弟姐妹：依父系/母系统称表伯祖/表叔祖等较生僻，归为「未知」交由用户手动设置
      return r('未知');
    }
    return r('祖辈');
  }

  // ============ 曾祖辈子女的爱人 ============
  // up-up-up-down-spouse: 祖父兄弟姐妹的爱人（伯祖母/叔祖母/姑祖父/舅祖母/姨祖父）
  if (dirs === 'up-up-up-down-spouse') {
    const parentGender = s0.gender;
    const grandparentGender = s1.gender;
    const targetSpouseGender = targetGender; // 爱人本身性别
    if (parentGender === 'male' && grandparentGender === 'male') {
      // 祖父的兄弟姐妹的爱人
      if (targetSpouseGender === 'female') return r('伯祖母'); // 伯祖父/叔祖父的妻子统称，简化
      if (targetSpouseGender === 'male') return r('姑祖父');
    } else if (parentGender === 'female' && grandparentGender === 'male') {
      if (targetSpouseGender === 'female') return r('舅祖母');
      if (targetSpouseGender === 'male') return r('姨祖父');
    }
    return r('未知');
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
        if (targetGender === 'male') return isOlderThanParent ? r('堂伯') : r('堂叔');
        if (targetGender === 'female') return isOlderThanParent ? r('堂姑') : r('堂姑');
      } else {
        if (targetGender === 'male') return isOlderThanParent ? r('表伯') : r('表叔');
        if (targetGender === 'female') return isOlderThanParent ? r('表姑') : r('表姑');
      }
    } else {
      // 母系或混合：统称表
      if (targetGender === 'male') return isOlderThanParent ? r('表伯') : r('表叔');
      if (targetGender === 'female') return r('表姑');
    }
    return r('未知');
  }

  // ============ 曾祖辈的曾孙辈（祖父兄弟姐妹的孙辈） ============
  // up-up-up-down-down-down: 祖父兄弟的孙辈 = 堂兄弟姐妹的子女一代，简化为「再从」
  if (dirs === 'up-up-up-down-down-down') {
    const isOlder = targetAge < selfAge;
    if (targetGender === 'male') return isOlder ? r('堂兄') : r('堂弟'); // 简化：远房堂兄弟
    if (targetGender === 'female') return isOlder ? r('堂姐') : r('堂妹');
    return r('未知');
  }

  // 兜底：超出已实现计算范围，返回「未知」由用户手动设置
  return r('未知');
}
