from pathlib import Path

def to_div(text: str) -> str:
    text = text.replace("<motion", "<__TAG_OPEN__").replace("</motion>", "<__TAG_CLOSE__>")
    return text.replace("<__TAG_OPEN__", "<motion").replace("<__TAG_CLOSE__", "</motion>")

# Correct implementation
def to_div_fixed(text: str) -> str:
    text = text.replace("<motion", "<__O__").replace("</motion>", "<__C__>")
    return text.replace("<__O__", "<div").replace("<__C__", "</div>")

card = Path(__file__).resolve().parent.parent / "src/components/customer/ServiceCard.tsx"
new = to_div_fixed(
    (Path(__file__).resolve().parent / "new_content_block.txt").read_text(encoding="utf-8")
)

s = card.read_text(encoding="utf-8")
start = s.index("        {/* Category Tag */}")
end = s.index("      </div>\n    </motion>\n  );".replace("motion", "div"), start)
card.write_text(s[:start] + new + s[end:], encoding="utf-8")
print("content ok")
