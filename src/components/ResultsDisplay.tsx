import { SearchResultItem } from '@/types';

interface ResultsDisplayProps {
  results: SearchResultItem[];
  isLoading: boolean;
  error: string | null;
}

const formatCurrency = (amount: number | null | undefined) => {
  if (amount == null) return 'N/A';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
};

export default function ResultsDisplay({ results, isLoading, error }: ResultsDisplayProps) {
  if (isLoading) {
    return <div className="mt-8 text-center dark:text-slate-300">Loading...</div>;
  }

  if (error) {
    return <div className="mt-8 text-center text-red-500 dark:text-red-400">Error: {error}</div>;
  }

  if (results.length === 0 && !isLoading) {
    return <div className="mt-8 text-center text-gray-500 dark:text-slate-400">No items found.</div>;
  }

  return (
    <div className="mt-8 flow-root">
      <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 dark:ring-slate-700 sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-800">
                <tr><th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-slate-200 sm:pl-6">Item Code</th><th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-slate-200">Description</th><th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-slate-200">Schedule Fee</th><th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-slate-200">75% Benefit</th><th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-slate-200">85% Benefit</th><th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-slate-200">Anaes.</th><th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-slate-200">Assist.</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700 bg-white dark:bg-slate-800/50">
                {results.map((item) => (
                  <tr key={item.item_code} className="dark:even:bg-slate-800"><td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-slate-200 sm:pl-6">{item.item_code}</td><td className="px-3 py-4 text-sm text-gray-700 dark:text-slate-300 max-w-md truncate hover:whitespace-normal">{item.description}</td><td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700 dark:text-slate-300">{formatCurrency(item.schedule_fee)}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700 dark:text-slate-300">{formatCurrency(item.benefit_75_percent)}</td><td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700 dark:text-slate-300">{formatCurrency(item.benefit_85_percent)}</td><td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700 dark:text-slate-300">{item.is_anaes_eligible ? 'Yes' : 'No'}</td><td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700 dark:text-slate-300">{item.is_assist_eligible ? 'Yes' : 'No'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
