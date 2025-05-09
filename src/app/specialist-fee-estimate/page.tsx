'use client';

import { useState, FormEvent } from 'react';
import { SearchResultItem } from '@/types'; // Assuming SearchResultItem is suitable

// Helper function to format currency (can be moved to a utils file later)
const formatCurrency = (amount: number | null | undefined) => {
  if (amount == null || isNaN(amount)) return 'N/A';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
};

export default function SpecialistFeeEstimatePage() {
  const [itemNumberInput, setItemNumberInput] = useState('');
  const [chargedFeeInput, setChargedFeeInput] = useState('');
  
  const [mbsItemDetails, setMbsItemDetails] = useState<SearchResultItem | null>(null);
  const [medicareRebate, setMedicareRebate] = useState<number | null>(null);
  const [healthFundRebate, setHealthFundRebate] = useState<number | null>(null);
  const [outOfPocket, setOutOfPocket] = useState<number | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCalculated, setHasCalculated] = useState(false);

  const handleCalculateEstimate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMbsItemDetails(null);
    setMedicareRebate(null);
    setHealthFundRebate(null);
    setOutOfPocket(null);
    setHasCalculated(false);

    if (!itemNumberInput.trim() || !chargedFeeInput.trim()) {
      setError('Please enter both MBS Item Number and Your Charged Fee.');
      return;
    }

    const chargedFee = parseFloat(chargedFeeInput);
    if (isNaN(chargedFee) || chargedFee < 0) {
      setError('Please enter a valid positive number for Your Charged Fee.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/search-mbs?query=${encodeURIComponent(itemNumberInput.trim())}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed: ${response.statusText}`);
      }
      
      const data: SearchResultItem[] = await response.json();

      if (data.length === 0) {
        setError(`MBS Item ${itemNumberInput.trim()} not found or is not current.`);
        setMbsItemDetails(null);
      } else {
        const item = data[0]; // Assuming the first result is the correct one for a direct item number search
        setMbsItemDetails(item);

        const calculatedMedicareRebate = item.benefit_75_percent;
        const calculatedHealthFundRebate = item.schedule_fee - item.benefit_75_percent;
        const calculatedOutOfPocket = chargedFee - calculatedMedicareRebate - calculatedHealthFundRebate;

        setMedicareRebate(calculatedMedicareRebate);
        setHealthFundRebate(calculatedHealthFundRebate);
        setOutOfPocket(calculatedOutOfPocket);
        setHasCalculated(true);
      }
    } catch (err) {
      console.error('Calculation failed:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during calculation.');
      setMbsItemDetails(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
          Specialist Fee Estimate
        </h1>
        <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
          Estimate out-of-pocket expenses for specialist services based on MBS items.
        </p>
      </header>

      <div className="max-w-xl mx-auto bg-white p-6 shadow-md rounded-lg">
        <form onSubmit={handleCalculateEstimate} className="space-y-6">
          <div>
            <label htmlFor="itemNumber" className="block text-sm font-medium text-gray-700">
              MBS Item Number
            </label>
            <input
              type="text"
              name="itemNumber"
              id="itemNumber"
              value={itemNumberInput}
              onChange={(e) => setItemNumberInput(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="e.g., 30175"
            />
          </div>

          <div>
            <label htmlFor="chargedFee" className="block text-sm font-medium text-gray-700">
              Your Charged Fee ($)
            </label>
            <input
              type="number"
              name="chargedFee"
              id="chargedFee"
              value={chargedFeeInput}
              onChange={(e) => setChargedFeeInput(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="e.g., 500.00"
              step="0.01"
              min="0"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? 'Calculating...' : 'Calculate Estimate'}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="mt-6 max-w-xl mx-auto p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {hasCalculated && mbsItemDetails && !error && (
        <div className="mt-8 max-w-xl mx-auto bg-white p-6 shadow-md rounded-lg">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Estimate Results</h2>
          <div className="space-y-3">
            <p><strong>Item Number:</strong> {mbsItemDetails.item_code}</p>
            <p className="text-sm text-gray-600"><strong>Description:</strong> {mbsItemDetails.description}</p>
            <hr className="my-2"/>
            <p><strong>Your Charged Fee:</strong> {formatCurrency(parseFloat(chargedFeeInput))}</p>
            <p><strong>MBS Schedule Fee:</strong> {formatCurrency(mbsItemDetails.schedule_fee)}</p>
            <hr className="my-2"/>
            <p className="text-green-600"><strong>Medicare Rebate (75%):</strong> {formatCurrency(medicareRebate)}</p>
            <p className="text-blue-600"><strong>Health Fund Rebate (to schedule fee):</strong> {formatCurrency(healthFundRebate)}</p>
            <hr className="my-2"/>
            <p className="text-xl font-bold text-red-600">
              Patient Out-of-Pocket: {formatCurrency(outOfPocket)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
