import { useLanguage } from "@/contexts/LanguageContext";
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from "@/lib/localization";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();

  return (
    <Select value={language} onValueChange={(val) => setLanguage(val as typeof language)}>
      <SelectTrigger className="w-[140px] gap-2">
        <Globe className="h-4 w-4" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <SelectItem key={lang} value={lang}>
            {LANGUAGE_NAMES[lang]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
