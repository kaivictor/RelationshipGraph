#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
旧版 FamilyTree 数据 → 最新版 Relationship 数据 转换工具

功能：
- XML：根节点 <familyTree> 重命名为 <relationship>，补全新版 displaySettings 字段
- JSON：补全缺失的 displaySettings / viewport 默认值，规范化节点多值字段
- Y 坐标重算：旧版分段非线性间距 → 新版线性均匀（每年 10px × scale）
  · yOverridden=true 的节点保留原 Y（用户手动拖过的，不重算）
  · 其余节点按 birthDate 相邻差值用线性公式累加
- displaySettings 补全新增字段：showStatsBadge / showCoordinateSystem /
  allowVerticalMove / coordinateLineStep

用法：
    python tools/convert_legacy.py 输入文件 [输出文件]
    输入文件支持 .json / .xml（也可自动按内容检测）
    未指定输出文件时，自动生成 relationship-data.json / relationship-data.xml

转换后即可在 Relationship 应用中正常导入。
"""
from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

# 新版 DisplaySettings 默认值（对应 src/store/useRelationshipStore.ts 的 DEFAULT_DISPLAY_SETTINGS）
DEFAULT_DISPLAY_SETTINGS: dict = {
    "showNamePinyin": False,
    "showFormerName": False,
    "showRelationship": True,
    "showPopularName": False,
    "showAvatar": True,
    "showBirthDate": True,
    "showAge": True,
    "showEducation": False,
    "showPhone": False,
    "showQq": False,
    "showWechat": False,
    "showEmail": False,
    "showAddress": False,
    "showLicensePlate": False,
    "showBilibili": False,
    "showDiscord": False,
    "showReddit": False,
    "showThreads": False,
    "showWhatsapp": False,
    "showDouyin": False,
    "showTwitter": False,
    "showXiaohongshu": False,
    "fieldOrder": [
        "phone", "qq", "wechat", "email", "address", "licensePlate",
        "bilibili", "discord", "reddit", "threads", "whatsapp",
        "douyin", "twitter", "xiaohongshu",
    ],
    "customFields": [],
    "customFieldVisibility": {},
    "removedBuiltinFields": [],
    "verticalGapScale": 1,
    "showGrayOnDisconnect": True,
    "showEdgeRelationship": True,
    "persistToBrowser": True,
    "deathDateReplaceBirth": True,
    "showCanvasHint": True,
    "showStatsBadge": True,
    "showCoordinateSystem": False,
    "allowVerticalMove": False,
    "coordinateLineStep": 10,
}

# 布尔类型的 displaySettings 字段
DISPLAY_BOOL_FIELDS = {
    "showNamePinyin", "showFormerName", "showRelationship", "showPopularName",
    "showAvatar", "showBirthDate", "showAge", "showEducation",
    "showPhone", "showQq", "showWechat", "showEmail", "showAddress", "showLicensePlate",
    "showBilibili", "showDiscord", "showReddit", "showThreads", "showWhatsapp",
    "showDouyin", "showTwitter", "showXiaohongshu",
    "showGrayOnDisconnect", "showEdgeRelationship", "persistToBrowser",
    "deathDateReplaceBirth", "showCanvasHint", "showStatsBadge",
    "showCoordinateSystem", "allowVerticalMove",
}

# 整数类型的 displaySettings 字段
DISPLAY_INT_FIELDS = {"coordinateLineStep"}

# 人物节点多值字段（新版 store 的 MULTI_VALUE_FIELDS）
MULTI_VALUE_FIELDS = {
    "formerName", "popularName", "phone", "qq", "wechat", "email", "address",
    "licensePlate", "bilibili", "discord", "reddit", "threads", "whatsapp",
    "douyin", "twitter", "xiaohongshu",
}

# 布尔类型的人物数据字段（XML 中需还原为布尔值）
PERSON_BOOL_FIELDS = {"isSelf", "deceased", "relationshipOverridden"}


# ---------------- 工具函数 ----------------

def log(msg: str) -> None:
    print("[convert]", msg)


def split_multi_value(v) -> list:
    """将字符串（按 | 或逗号分隔）归一化为数组；已是数组则原样保留"""
    if v is None:
        return []
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x).strip() != ""]
    s = str(v).strip()
    if s == "":
        return []
    return [x.strip() for x in re.split(r"[|,，]", s) if x.strip() != ""]


def normalize_node_data(data: dict) -> dict:
    """规范化人物节点 data：多值字段转数组"""
    out = dict(data)
    for f in MULTI_VALUE_FIELDS:
        if f in out:
            arr = split_multi_value(out[f])
            out[f] = arr if arr else ""
    return out


# ---------------- Y 坐标重算（旧版分段非线性 → 新版线性均匀） ----------------

# 线性间距公式：每年固定像素值（与 src/store/useRelationshipStore.ts 的 getGapPixels 一致）
PX_PER_YEAR = 10


def _parse_birth_year(birth_date) -> float:
    """从 birthDate（YYYY-MM 或 YYYY-MM-DD）解析年份，无效返回 NaN"""
    if not birth_date or not isinstance(birth_date, str):
        return float("nan")
    parts = birth_date.split("-")
    try:
        return float(parts[0])
    except (ValueError, IndexError):
        return float("nan")


def _years_to_ms(years: float) -> float:
    return years * 365.25 * 24 * 3600 * 1000


def _date_to_year_float(birth_date: str) -> float:
    """
    birthDate (YYYY-MM / YYYY-MM-DD) → 年份浮点数（含月份小数）。
    与 store 中 new Date(birthDate).getTime() / MS_PER_YEAR 等价：
    JavaScript 的 new Date('YYYY-MM') 解析为 UTC 该年月1日0点。
    这里用 calendar 计算该年月1日相对该年1月1日的天数，再除以 365.25 转年。
    无效返回 NaN。
    """
    if not birth_date:
        return float("nan")
    parts = birth_date.split("-")
    try:
        year = int(parts[0])
    except (ValueError, IndexError):
        return float("nan")
    if len(parts) > 1:
        try:
            month = int(parts[1])
        except ValueError:
            month = 1
    else:
        month = 1
    if len(parts) > 2:
        try:
            day = int(parts[2])
        except ValueError:
            day = 1
    else:
        day = 1
    import calendar as _cal
    # 该年1月1日到该年月日1日的天数（与 JS new Date('YYYY-MM-DD').getTime() 在 UTC 下一致）
    # JS: Date(YYYY,MM-1,1) 但 'YYYY-MM' 字符串解析为 UTC
    days_from_jan1 = _cal.timegm((year, month, day, 0, 0, 0, 0, 0, 0)) - _cal.timegm((year, 1, 1, 0, 0, 0, 0, 0, 0))
    days_from_year_start = days_from_jan1 / 86400.0
    return year + days_from_year_start / 365.25


def recalculate_y_positions(nodes: list) -> list:
    """
    按"新版线性均匀公式"重算节点 Y 坐标。
    - yOverridden=true 的节点保留原 Y（用户手动拖过的，不重算）
    - 其余节点按 birthDate 排序，相邻差值用 years * 10 * scale 累加
    - scale = displaySettings.verticalGapScale（若可用）
    返回新的 nodes 列表（不修改原对象）。
    """
    if not nodes:
        return nodes

    # 读取 verticalGapScale（从 displaySettings，默认 1）
    # 此函数在 convert_json/convert_xml 中调用时，displaySettings 尚未合并完成，
    # 故优先从传入节点的"原始数据上下文"取——这里简化为默认 1，由后续导入时
    # 应用再次重算（applyRelativeYPositions 会用最终 scale 重算，但保留 yOverridden）。
    # 注：工具只做"清理旧版分段非线性 Y"，最终 scale 由应用处理。
    scale = 1

    # 收集需重算的节点（非 yOverridden）及其 birthDate
    to_calc = []  # [(index, birth_date, year_float)]
    for i, node in enumerate(nodes):
        if not isinstance(node, dict):
            continue
        data = node.get("data") or {}
        if data.get("yOverridden"):
            continue
        bd = data.get("birthDate") or ""
        yf = _date_to_year_float(bd)
        to_calc.append((i, bd, yf))

    if not to_calc:
        return nodes

    # 按 birthDate 年份排序（NaN 排最前，Y=0）
    to_calc.sort(key=lambda x: 0 if x[2] != x[2] else x[2])

    # 累加 Y
    date_to_y = {}
    current_y = 0.0
    prev_yf = to_calc[0][2]
    if prev_yf != prev_yf:  # NaN
        prev_yf = 0
    date_to_y[to_calc[0][1]] = current_y

    for idx in range(1, len(to_calc)):
        _, bd, yf = to_calc[idx]
        if yf != yf:  # NaN
            yf = prev_yf
        years_diff = yf - prev_yf
        current_y += years_diff * PX_PER_YEAR * scale
        date_to_y[bd] = current_y
        prev_yf = yf

    # 应用新 Y（保留 X，仅改 Y）
    new_nodes = []
    for i, node in enumerate(nodes):
        if not isinstance(node, dict):
            new_nodes.append(node)
            continue
        data = node.get("data") or {}
        if data.get("yOverridden"):
            new_nodes.append(node)
            continue
        bd = data.get("birthDate") or ""
        pos = node.get("position") or {"x": 0, "y": 0}
        new_y = date_to_y.get(bd, 0)
        new_node = dict(node)
        new_node["position"] = {"x": pos.get("x", 0), "y": new_y}
        new_nodes.append(new_node)
    return new_nodes


def _recalculate_xml_y(node_list):
    """
    XML 专用：就地重算节点 position 的 y 属性。
    node_list: [(node_el, birth_date, is_y_overridden), ...]
    """
    if not node_list:
        return

    # 筛选需重算的（非 yOverridden）
    to_calc = [(el, bd, _date_to_year_float(bd)) for (el, bd, yo) in node_list if not yo]
    if not to_calc:
        return

    # 排序（NaN 排最前）
    to_calc.sort(key=lambda x: 0 if x[2] != x[2] else x[2])

    date_to_y = {}
    current_y = 0.0
    prev_yf = to_calc[0][2]
    if prev_yf != prev_yf:  # NaN
        prev_yf = 0
    date_to_y[to_calc[0][1]] = current_y

    for idx in range(1, len(to_calc)):
        el, bd, yf = to_calc[idx]
        if yf != yf:
            yf = prev_yf
        years_diff = yf - prev_yf
        current_y += years_diff * PX_PER_YEAR
        date_to_y[bd] = current_y
        prev_yf = yf

    # 应用新 Y 到 position 元素的 y 属性
    for el, bd, yo in node_list:
        if yo:
            continue
        pos_el = el.find("position")
        if pos_el is None:
            continue
        new_y = date_to_y.get(bd, 0)
        # 整数化（避免浮点小数）：若为整数则用 int，否则保留一位小数
        if new_y == int(new_y):
            pos_el.set("y", str(int(new_y)))
        else:
            pos_el.set("y", f"{new_y:.1f}")


# ---------------- JSON 转换 ----------------

def convert_json(text: str) -> str:
    parsed = json.loads(text)
    if not isinstance(parsed, dict):
        raise ValueError("JSON 根节点必须是对象")

    nodes = parsed.get("nodes")
    edges = parsed.get("edges")
    if not isinstance(nodes, list) or not isinstance(edges, list):
        raise ValueError("JSON 缺少 nodes 或 edges 数组字段")

    # 节点数据规范化
    for node in nodes:
        if isinstance(node, dict):
            d = node.get("data")
            if isinstance(d, dict):
                node["data"] = normalize_node_data(d)

    # Y 坐标重算：旧版分段非线性 → 新版线性均匀（保留 yOverridden 节点）
    parsed["nodes"] = recalculate_y_positions(nodes)

    # displaySettings：与新版默认值合并，补全缺失字段
    ds = parsed.get("displaySettings")
    merged_ds = dict(DEFAULT_DISPLAY_SETTINGS)
    if isinstance(ds, dict):
        for k, v in ds.items():
            if k in DISPLAY_BOOL_FIELDS and not isinstance(v, bool):
                merged_ds[k] = str(v).strip().lower() in ("true", "1", "是", "yes")
            elif k == "verticalGapScale":
                try:
                    merged_ds[k] = float(v)
                except (TypeError, ValueError):
                    merged_ds[k] = 1
            elif k in DISPLAY_INT_FIELDS:
                try:
                    merged_ds[k] = int(v)
                except (TypeError, ValueError):
                    merged_ds[k] = DEFAULT_DISPLAY_SETTINGS[k]
            else:
                merged_ds[k] = v
        # fieldOrder 中缺失的内置字段自动加入末尾
        removed_set = set(merged_ds.get("removedBuiltinFields") or [])
        for k in DEFAULT_DISPLAY_SETTINGS["fieldOrder"]:
            if k not in merged_ds.get("fieldOrder", []) and k not in removed_set:
                merged_ds.setdefault("fieldOrder", []).append(k)

    parsed["displaySettings"] = merged_ds

    # viewport：缺失则用默认值
    vp = parsed.get("viewport")
    if not isinstance(vp, dict):
        parsed["viewport"] = {"x": 0, "y": 0, "zoom": 1}
    else:
        try:
            parsed["viewport"] = {
                "x": float(vp.get("x", 0)),
                "y": float(vp.get("y", 0)),
                "zoom": float(vp.get("zoom", 1)),
            }
        except (TypeError, ValueError):
            parsed["viewport"] = {"x": 0, "y": 0, "zoom": 1}

    return json.dumps(parsed, ensure_ascii=False, indent=2)


# ---------------- XML 转换 ----------------

def _bool_str(v) -> str:
    return "true" if v else "false"


def convert_xml(text: str) -> str:
    root = ET.fromstring(text)
    root_tag = root.tag
    if root_tag != "familyTree" and root_tag != "relationship":
        raise ValueError(f"XML 根节点必须是 <familyTree> 或 <relationship>，实际为 <{root_tag}>")

    # 1. 根节点重命名
    root.tag = "relationship"

    # 2. 节点：读取为列表用于 Y 重算，同时规范化多值字段
    nodes_el = root.find("nodes")
    node_list = []  # [(node_el, birth_date, is_y_overridden)]
    if nodes_el is not None:
        for node_el in nodes_el.findall("node"):
            d = node_el.find("data")
            birth_date = ""
            is_y_overridden = False
            if d is not None:
                bd_el = d.find("birthDate")
                if bd_el is not None and bd_el.text:
                    birth_date = bd_el.text
                yo_el = d.find("yOverridden")
                if yo_el is not None and yo_el.text and yo_el.text.strip().lower() in ("true", "1", "yes"):
                    is_y_overridden = True
                # 多值字段清理（空项移除）
                for f in MULTI_VALUE_FIELDS:
                    fe = d.find(f)
                    if fe is not None and (fe.text is None or fe.text.strip() == ""):
                        d.remove(fe)
            node_list.append((node_el, birth_date, is_y_overridden))

    # Y 坐标重算：旧版分段非线性 → 新版线性均匀（保留 yOverridden）
    _recalculate_xml_y(node_list)

    # 3. displaySettings 补全新版字段
    ds_el = root.find("displaySettings")
    if ds_el is None:
        ds_el = ET.SubElement(root, "displaySettings")

    # 收集已有字段
    existing = {child.tag for child in ds_el}
    for key, val in DEFAULT_DISPLAY_SETTINGS.items():
        if key in existing:
            continue
        if key in DISPLAY_BOOL_FIELDS:
            el = ET.SubElement(ds_el, key)
            el.text = _bool_str(val)
        elif key in DISPLAY_INT_FIELDS:
            el = ET.SubElement(ds_el, key)
            el.text = str(val)
        elif key in ("fieldOrder", "customFields", "removedBuiltinFields"):
            # 复合结构：缺失时补空结构，避免新版导入逻辑读不到
            container = ET.SubElement(ds_el, key)
            if key in ("fieldOrder", "removedBuiltinFields"):
                for item in val:
                    i = ET.SubElement(container, "item")
                    i.text = item
            # customFields 默认空
        elif key == "customFieldVisibility":
            ET.SubElement(ds_el, key)
        elif key == "verticalGapScale":
            el = ET.SubElement(ds_el, key)
            el.text = str(val)

    # fieldOrder 补全：旧版可能缺少新版内置字段，追加到末尾（与新版 store 导入逻辑一致）
    fo_el = ds_el.find("fieldOrder")
    rbf_el = ds_el.find("removedBuiltinFields")
    removed_set = {i.text for i in rbf_el} if rbf_el is not None else set()
    if fo_el is not None:
        existing_fo = [i.text for i in fo_el.findall("item") if i.text]
        for k in DEFAULT_DISPLAY_SETTINGS["fieldOrder"]:
            if k not in existing_fo and k not in removed_set:
                item = ET.SubElement(fo_el, "item")
                item.text = k

    # 4. viewport 缺失时补默认
    if root.find("viewport") is None:
        vp = ET.SubElement(root, "viewport")
        vp.set("x", "0")
        vp.set("y", "0")
        vp.set("zoom", "1")

    return ET.tostring(root, encoding="unicode", xml_declaration=False)


def pretty_xml(xml_str: str) -> str:
    """缩进格式化（ElementTree 不保留原缩进，重排使文件可读）"""
    try:
        import xml.dom.minidom as minidom

        return minidom.parseString(xml_str).toprettyxml(indent="  ")
    except Exception:
        return xml_str


# ---------------- 主入口 ----------------

def detect_format(path: Path) -> str:
    ext = path.suffix.lower()
    if ext == ".json":
        return "json"
    if ext == ".xml":
        return "xml"
    # 无扩展名时按内容嗅探
    head = path.read_text(encoding="utf-8", errors="replace")[:500].lstrip("\ufeff")
    if head.startswith("<"):
        return "xml"
    return "json"


def main() -> int:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 0

    in_path = Path(args[0])
    if not in_path.exists():
        print(f"[错误] 输入文件不存在: {in_path}")
        return 1

    fmt = detect_format(in_path)
    text = in_path.read_text(encoding="utf-8", errors="replace")

    if len(args) >= 2:
        out_path = Path(args[1])
    else:
        out_path = in_path.with_name(f"relationship-data.{fmt}")

    try:
        if fmt == "json":
            out_text = convert_json(text)
        else:
            out_text = pretty_xml(convert_xml(text))
    except Exception as e:
        print(f"[错误] 转换失败: {e}")
        return 1

    out_path.write_text(out_text, encoding="utf-8")
    log(f"转换完成: {fmt} 格式")
    log(f"输入:  {in_path}")
    log(f"输出:  {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
