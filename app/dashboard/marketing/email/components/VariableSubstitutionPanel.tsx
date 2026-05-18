'use client';

export default function VariableSubstitutionPanel({
  variables,
  values,
  onChange
}: {
  variables: string[],
  values: Record<string, string>,
  onChange: (key: string, val: string) => void
}) {
  if (!variables || variables.length === 0) return null;

  return (
    <div className="space-y-4 border-t border-black/10 dark:border-white/10 pt-4 mt-4">
      <h3 className="text-sm font-medium text-black dark:text-white">Variables</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {variables.map(v => (
          <div key={v}>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{v}</label>
            <input
              type="text"
              value={values[v] || ''}
              onChange={e => onChange(v, e.target.value)}
              placeholder={`Enter value for {{${v}}}`}
              className="w-full bg-black/[0.02] dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg p-2 text-black dark:text-white text-sm focus:border-black/30 dark:focus:border-white/30 outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
