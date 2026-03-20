"use client";

const FIGHT_STYLES = [
  { value: "Patchwerk", label: "Patchwerk" },
  { value: "HecticAddCleave", label: "Hectic Add Cleave" },
  { value: "LightMovement", label: "Light Movement" },
];

interface FightStyleSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export default function FightStyleSelector({
  value,
  onChange,
}: FightStyleSelectorProps) {
  return (
    <div className="flex gap-1.5">
      {FIGHT_STYLES.map((fs) => {
        const active = value === fs.value;
        return (
          <button
            key={fs.value}
            type="button"
            onClick={() => onChange(fs.value)}
            className={`flex-1 py-2 px-2 rounded-lg text-[12px] font-medium transition-all border ${
              active
                ? "bg-white text-black border-white"
                : "bg-surface-2 text-gray-400 border-border hover:border-gray-500 hover:text-white"
            }`}
          >
            {fs.label}
          </button>
        );
      })}
    </div>
  );
}
