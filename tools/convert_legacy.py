#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
旧版 FamilyTree 数据 → 最新版 Relationship 数据 转换工具

功能：
- XML：根节点 <familyTree> 重命名为 <relationship>，补全新版 displaySettings 字段
- JSON：补全缺失的 displaySettings / viewport 默认值，规范化节点多值字段

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
}

# 布尔类型的 displaySettings 字段
DISPLAY_BOOL_FIELDS = {
    "showNamePinyin", "showFormerName", "showRelationship", "showPopularName",
    "showAvatar", "showBirthDate", "showAge", "showEducation",
    "showPhone", "showQq", "showWechat", "showEmail", "showAddress", "showLicensePlate",
    "showBilibili", "showDiscord", "showReddit", "showThreads", "showWhatsapp",
    "showDouyin", "showTwitter", "showXiaohongshu",
    "showGrayOnDisconnect", "showEdgeRelationship", "persistToBrowser",
    "deathDateReplaceBirth", "showCanvasHint",
}

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

    # 2. displaySettings 补全新版字段
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

    # 3. viewport 缺失时补默认
    if root.find("viewport") is None:
        vp = ET.SubElement(root, "viewport")
        vp.set("x", "0")
        vp.set("y", "0")
        vp.set("zoom", "1")

    # 4. 节点数据规范化：多值字段从 | 分隔还原为数组语义（保持文本形式即可，
    #    新版导入会自动拆分；这里仅确保空项清理）
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
