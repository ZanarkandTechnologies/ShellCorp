import type { UiTab } from "./types";

const TAB_OPTIONS: Array<{ id: UiTab; label: string }> = [
  { id: "operations", label: "Operations" },
  { id: "memory", label: "Memory" },
  { id: "skills", label: "Skills" },
  { id: "office", label: "Office" },
];

type AppTabNavProps = {
  activeTab: UiTab;
  onSelect: (tab: UiTab) => void;
};

export function AppTabNav({ activeTab, onSelect }: AppTabNavProps): JSX.Element {
  return (
    <section className="panel tabsPanel">
      <div className="tabs">
        {TAB_OPTIONS.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "active" : ""}
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </section>
  );
}
