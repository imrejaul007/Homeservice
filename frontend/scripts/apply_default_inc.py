from pathlib import Path

root = Path(__file__).resolve().parent.parent
card = root / "src/components/customer/ServiceCard.tsx"
inc = Path(__file__).resolve().parent / "default_variant.inc"
s = card.read_text(encoding="utf-8")
if "Sparkles" not in s:
    s = s.replace(
        "import { Star, Clock, MapPin, TrendingUp, ChevronRight, Heart } from 'lucide-react';",
        "import { Star, Clock, MapPin, TrendingUp, ChevronRight, Heart, Sparkles } from 'lucide-react';",
    )
start = s.index("  // Default variant")
end = s.index("\n};\n\nexport default ServiceCard")
card.write_text(s[:start] + inc.read_text(encoding="utf-8") + s[end:], encoding="utf-8")
print("applied")
