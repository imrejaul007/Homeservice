from pathlib import Path

card = Path(__file__).resolve().parent.parent / "src/components/customer/ServiceCard.tsx"
new = (Path(__file__).resolve().parent / "new_badges_block.txt").read_text(encoding="utf-8")
s = card.read_text(encoding="utf-8")
start = s.index("        {/* Badges */}")
end = s.index("        <button\n          type=\"button\"", start)
card.write_text(s[:start] + new + s[end:], encoding="utf-8")
print("badges ok")
