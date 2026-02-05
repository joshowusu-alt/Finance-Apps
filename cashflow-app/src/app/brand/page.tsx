import { BrandPreview } from "@/components/BrandPreview";
import ThemeToggle from "@/components/ThemeToggle";

export default function BrandPage() {
  return (
    <div>
      <div style={{ position: "fixed", top: 20, right: 20, zIndex: 1000 }}>
        <ThemeToggle />
      </div>
      <BrandPreview />
    </div>
  );
}
