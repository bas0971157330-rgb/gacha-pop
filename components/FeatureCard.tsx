import type { LucideIcon } from "lucide-react";

type FeatureCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="feature-card">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-violet-700">
        <Icon size={25} strokeWidth={2.6} />
      </span>
      <div>
        <h3 className="text-base font-extrabold text-indigo-950">{title}</h3>
        <p className="text-sm font-medium text-violet-700">{description}</p>
      </div>
    </div>
  );
}
