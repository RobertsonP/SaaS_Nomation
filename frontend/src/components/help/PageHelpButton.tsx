import { Info } from 'lucide-react';
import { usePageHelp } from '../../contexts/PageHelpContext';

interface PageHelpButtonProps {
  helpKey: string;
  label?: string;
}

export function PageHelpButton({ helpKey, label = 'Help' }: PageHelpButtonProps) {
  const { open } = usePageHelp();
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      title={`${label} — what does this page do?`}
      aria-label={label}
      onClick={() => open(helpKey)}
    >
      <Info size={15} />
    </button>
  );
}
