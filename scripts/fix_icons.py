#!/usr/bin/env python3
"""
fix_icons.py
Parses and fixes pixel-art SVG icons, then generates React TSX components.

For "broken" SVGs (matrix/fractional transforms):
  - Converts matrix(a 0 0 d e f) -> rect with x=round(e), y=round(f),
    width=round(w*a), height=round(h*d)
  - Converts translate(tx ty) -> rect with x=round(tx), y=round(ty)
  - Removes background rect (fill="#1a1a1a" / "#000" / "#000000" covering full viewBox)
  - Replaces white fills with currentColor
  - Fixes shape-rendering, strips animation attrs/style blocks

For "clean" SVGs:
  - Same background removal and currentColor substitution

Then generates TSX components for all 10 icons.
"""

import os
import re
import xml.etree.ElementTree as ET

ICONS_DIR = "/home/user/covers.cafe/new icons"
COMPONENTS_DIR = "/home/user/covers.cafe/src/components"

# Map filename -> component name
ICON_MAP = {
    "gallery.svg":                                                        "GalleryIcon",
    "artists.svg":                                                        "ArtistsIcon",
    "moon.svg":                                                           "MoonIcon",
    "sun.svg":                                                            "SunIcon",
    "upload-download.svg":                                                "UploadDownloadIcon",
    "trophy - claude, this needs an edit, lines are broken.svg":          "TrophyIcon",
    "gear - claude, this needs an edit, lines are broken.svg":            "GearIcon",
    "shield claude, this needs an edit, lines are broken.svg":            "ShieldIcon",
    "about claude, this needs an edit, lines are broken.svg":             "AboutIcon",
    "favourites star - claude, this needs an edit, lines are broken.svg": "FavoritesIcon",
}

WHITE_FILLS = {"#fff", "#FFF", "#ffffff", "#FFFFFF", "white"}
BG_FILLS    = {"#1a1a1a", "#000", "#000000"}

# Attrs to strip from root <svg>
STRIP_SVG_ATTRS = {"id", "project-id", "export-id", "cached", "xmlns:xlink",
                   "text-rendering"}

# SVG attribute -> React camelCase
ATTR_CAMEL = {
    "fill-rule":        "fillRule",
    "clip-rule":        "clipRule",
    "stroke-width":     "strokeWidth",
    "stroke-linecap":   "strokeLinecap",
    "stroke-linejoin":  "strokeLinejoin",
    "stroke-miterlimit":"strokeMiterlimit",
    "font-size":        "fontSize",
    "font-family":      "fontFamily",
    "text-anchor":      "textAnchor",
    "shape-rendering":  "shapeRendering",
    "text-rendering":   "textRendering",
}


# ---------------------------------------------------------------------------
# Transform helpers
# ---------------------------------------------------------------------------

def parse_matrix(transform_val):
    """Parse 'matrix(a b c d e f)' -> dict or None."""
    m = re.match(
        r'matrix\(\s*'
        r'([+-]?[\d.eE+-]+)\s+'
        r'([+-]?[\d.eE+-]+)\s+'
        r'([+-]?[\d.eE+-]+)\s+'
        r'([+-]?[\d.eE+-]+)\s+'
        r'([+-]?[\d.eE+-]+)\s+'
        r'([+-]?[\d.eE+-]+)\s*\)',
        transform_val.strip()
    )
    if not m:
        return None
    a, b, c, d, e, f = (float(m.group(i)) for i in range(1, 7))
    return dict(a=a, b=b, c=c, d=d, e=e, f=f)


def parse_translate(transform_val):
    """Parse 'translate(tx ty)' or 'translate(tx)' -> (tx, ty) or None."""
    m = re.match(
        r'translate\(\s*([+-]?[\d.eE+-]+)(?:\s+([+-]?[\d.eE+-]+))?\s*\)',
        transform_val.strip()
    )
    if not m:
        return None
    tx = float(m.group(1))
    ty = float(m.group(2)) if m.group(2) is not None else 0.0
    return tx, ty


def is_background_rect(attribs, vb_w, vb_h):
    """True if this rect is a full-canvas background fill."""
    fill = attribs.get("fill", "").strip().lower()
    # Allow slight tolerance for translate(0 0.5) etc.
    if fill not in {f.lower() for f in BG_FILLS}:
        return False

    # Check with x/y/width/height directly
    try:
        x = float(attribs.get("x", 0))
        y = float(attribs.get("y", 0))
        w = float(attribs.get("width",  0))
        h = float(attribs.get("height", 0))
        if w >= vb_w * 0.9 and h >= vb_h * 0.9 and x <= vb_w * 0.1 and y <= vb_h * 0.1:
            return True
    except ValueError:
        pass

    # Check with width="100%" or height="100%"
    w_pct = attribs.get("width",  "").strip()
    h_pct = attribs.get("height", "").strip()
    if w_pct in ("100%",) and h_pct in ("100%",):
        return True

    return False


def resolve_rect_transform(attribs):
    """
    Given a <rect> element's attribs dict, resolve transform into plain
    x/y/width/height (integers) and remove the transform key.
    Returns updated attribs dict (copy).
    """
    attribs = dict(attribs)
    transform = attribs.pop("transform", None)
    if transform is None:
        return attribs

    orig_w = float(attribs.get("width",  1))
    orig_h = float(attribs.get("height", 1))
    orig_x = float(attribs.get("x", 0))
    orig_y = float(attribs.get("y", 0))

    mat = parse_matrix(transform)
    if mat:
        a, b, c, d, e, f = mat["a"], mat["b"], mat["c"], mat["d"], mat["e"], mat["f"]
        new_x = round(e + orig_x * a)
        new_y = round(f + orig_y * d)
        new_w = round(orig_w * a)
        new_h = round(orig_h * d)
        attribs["x"]      = str(new_x)
        attribs["y"]      = str(new_y)
        attribs["width"]  = str(new_w)
        attribs["height"] = str(new_h)
        return attribs

    tr = parse_translate(transform)
    if tr:
        tx, ty = tr
        new_x = round(orig_x + tx)
        new_y = round(orig_y + ty)
        attribs["x"]      = str(new_x)
        attribs["y"]      = str(new_y)
        attribs["width"]  = str(round(orig_w))
        attribs["height"] = str(round(orig_h))
        return attribs

    # Unknown transform: leave as-is but warn
    print(f"  [WARN] Unknown transform: {transform!r}")
    attribs["transform"] = transform
    return attribs


# ---------------------------------------------------------------------------
# SVG processing
# ---------------------------------------------------------------------------

def process_svg(svg_text):
    """
    Full pipeline: fix transforms, remove background, replace white fills,
    clean up attrs. Returns clean SVG as a string.
    """
    # --- Pre-process: strip xmlns:xlink declaration (it's in the text, not
    #     parsed by ElementTree as an attribute) ---------------------------
    svg_text = re.sub(r'\s+xmlns:xlink="[^"]*"', '', svg_text)

    # Strip xlink:href -> href (not needed but safe)
    svg_text = svg_text.replace("xlink:href", "href")

    # Remove <style> blocks
    svg_text = re.sub(r'<style[^>]*>.*?</style>', '', svg_text, flags=re.DOTALL)

    # --- Parse XML ----------------------------------------------------------
    # Register default namespace to avoid ns0: prefixes
    ET.register_namespace("", "http://www.w3.org/2000/svg")

    try:
        root = ET.fromstring(svg_text)
    except ET.ParseError as exc:
        raise ValueError(f"XML parse error: {exc}")

    ns = {"svg": "http://www.w3.org/2000/svg"}

    # Get viewBox dimensions
    vb = root.get("viewBox", "0 0 120 120")
    vb_parts = vb.split()
    vb_w = float(vb_parts[2]) if len(vb_parts) >= 4 else 120.0
    vb_h = float(vb_parts[3]) if len(vb_parts) >= 4 else 120.0

    # --- Clean root <svg> attributes ----------------------------------------
    for attr in list(root.attrib.keys()):
        local = attr.split("}")[-1] if "}" in attr else attr
        if local in STRIP_SVG_ATTRS:
            del root.attrib[attr]

    # Fix shape-rendering
    if root.get("shape-rendering") == "geometricPrecision":
        root.set("shape-rendering", "crispEdges")
    # Ensure crispEdges is set
    if "shape-rendering" not in root.attrib:
        root.set("shape-rendering", "crispEdges")

    # Remove text-rendering
    root.attrib.pop("text-rendering", None)

    # Remove id on root svg
    root.attrib.pop("id", None)

    # --- Process child elements ---------------------------------------------
    elements_to_remove = []
    for elem in list(root.iter()):
        tag_local = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag

        if tag_local == "rect":
            fill = elem.get("fill", "").strip()

            # Check if background rect (before resolving transform)
            # We need to check with transform too
            test_attribs = dict(elem.attrib)
            transform = test_attribs.get("transform", "")
            # Quick background check: big size AND dark fill
            if fill.lower() in {f.lower() for f in BG_FILLS}:
                resolved = resolve_rect_transform(test_attribs)
                try:
                    rw = float(resolved.get("width", 0))
                    rh = float(resolved.get("height", 0))
                    rx = float(resolved.get("x", 0))
                    ry = float(resolved.get("y", 0))
                    if rw >= vb_w * 0.8 and rh >= vb_h * 0.8:
                        elements_to_remove.append(elem)
                        continue
                except (ValueError, TypeError):
                    pass
                # Also check width="100%"
                if elem.get("width", "") in ("100%",):
                    elements_to_remove.append(elem)
                    continue

            # Resolve transform
            new_attribs = resolve_rect_transform(dict(elem.attrib))
            elem.attrib.clear()
            elem.attrib.update(new_attribs)

            # Replace white fill with currentColor
            current_fill = elem.get("fill", "").strip()
            if current_fill in WHITE_FILLS:
                elem.set("fill", "currentColor")

            # Remove rx/ry if both are 0 (keep SVG clean)
            if elem.get("rx", "").strip() in ("0", "0.0"):
                elem.attrib.pop("rx", None)
            if elem.get("ry", "").strip() in ("0", "0.0"):
                elem.attrib.pop("ry", None)

        elif tag_local in ("style", "animate", "animateTransform",
                           "animateMotion", "set"):
            elements_to_remove.append(elem)

    # Remove flagged elements from their parents
    for elem in elements_to_remove:
        for parent in root.iter():
            if elem in list(parent):
                parent.remove(elem)

    # Also replace any remaining white fill on non-rect elements
    for elem in root.iter():
        fill = elem.get("fill", "").strip()
        if fill in WHITE_FILLS:
            elem.set("fill", "currentColor")

    # Serialise
    svg_out = ET.tostring(root, encoding="unicode", xml_declaration=False)

    return svg_out


# ---------------------------------------------------------------------------
# SVG attribute -> React JSX attribute
# ---------------------------------------------------------------------------

def svg_attrib_to_jsx(name, value):
    """Convert an SVG attribute name/value to JSX-safe name and formatted value."""
    jsx_name = ATTR_CAMEL.get(name, name)
    # className etc. are not in SVG normally; just return as-is
    return jsx_name, value


def elem_to_jsx(elem, indent=6):
    """Recursively convert an ElementTree element to JSX string."""
    tag_local = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag

    if tag_local == "svg":
        # Skip the root svg wrapper - we'll emit it from the component template
        children = []
        for child in elem:
            children.append(elem_to_jsx(child, indent))
        return "\n".join(children)

    pad = " " * indent
    attrs_str = ""
    for k, v in elem.attrib.items():
        jsx_k, jsx_v = svg_attrib_to_jsx(k, v)
        attrs_str += f'\n{pad}  {jsx_k}="{jsx_v}"'

    children_jsx = []
    for child in elem:
        children_jsx.append(elem_to_jsx(child, indent + 2))

    if not children_jsx and elem.text is None:
        return f"{pad}<{tag_local}{attrs_str}\n{pad}/>"
    else:
        inner = "\n".join(children_jsx)
        return f"{pad}<{tag_local}{attrs_str}\n{pad}>\n{inner}\n{pad}</{tag_local}>"


# ---------------------------------------------------------------------------
# TSX generation
# ---------------------------------------------------------------------------

def generate_tsx(component_name, svg_text):
    """
    Given a (already fixed) SVG string, generate a React TSX component.
    """
    ET.register_namespace("", "http://www.w3.org/2000/svg")
    root = ET.fromstring(svg_text)

    # Extract viewBox
    vb = root.get("viewBox", "0 0 120 120")
    vb_parts = vb.strip().split()
    vb_w = int(round(float(vb_parts[2]))) if len(vb_parts) >= 4 else 120
    vb_h = int(round(float(vb_parts[3]))) if len(vb_parts) >= 4 else 120

    # Build JSX for children
    children_lines = []
    for child in root:
        children_lines.append(elem_to_jsx(child, indent=6))

    children_jsx = "\n".join(children_lines)

    # Compute description comment
    icon_slug = component_name.replace("Icon", "").lower()

    tsx = f"""interface Props {{
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}}

// {component_name} — pixel-art icon, fill inherits currentColor for theme support.
// Original viewBox: {vb_w}×{vb_h}.
export default function {component_name}({{ size = 18, className, style }}: Props) {{
  const w = Math.round(size * ({vb_w} / {vb_h}));
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={{w}}
      height={{size}}
      viewBox="0 0 {vb_w} {vb_h}"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={{className}}
      style={{{{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}}}
    >
{children_jsx}
    </svg>
  );
}}
"""
    return tsx


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    os.makedirs(COMPONENTS_DIR, exist_ok=True)

    for filename, component_name in ICON_MAP.items():
        svg_path = os.path.join(ICONS_DIR, filename)
        tsx_path = os.path.join(COMPONENTS_DIR, f"{component_name}.tsx")

        print(f"\nProcessing: {filename}")
        print(f"  -> {component_name}.tsx")

        with open(svg_path, "r", encoding="utf-8") as f:
            raw_svg = f.read()

        try:
            fixed_svg = process_svg(raw_svg)
        except Exception as exc:
            print(f"  [ERROR] {exc}")
            continue

        # Count rects in output
        rect_count = fixed_svg.count("<rect")
        print(f"  Rects in output: {rect_count}")

        # Check for any remaining transforms (should be 0)
        remaining_transforms = len(re.findall(r'transform=', fixed_svg))
        if remaining_transforms:
            print(f"  [WARN] {remaining_transforms} transform= attributes remain!")

        tsx_content = generate_tsx(component_name, fixed_svg)

        with open(tsx_path, "w", encoding="utf-8") as f:
            f.write(tsx_content)

        print(f"  Written: {tsx_path}")

    print("\nDone. All TSX components generated.")


if __name__ == "__main__":
    main()
