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

  // Assistant Fee States
  const [assistantGapFeeInput, setAssistantGapFeeInput] = useState('');
  const [showAssistantFields, setShowAssistantFields] = useState(false);
  const [determinedAssistantItemCode, setDeterminedAssistantItemCode] = useState<string | null>(null);
  const [assistantItemDescription, setAssistantItemDescription] = useState<string | null>(null);
  const [isLoadingAssistantItem, setIsLoadingAssistantItem] = useState(false);
  const [errorAssistantItem, setErrorAssistantItem] = useState<string | null>(null);


  const resetAssistantStates = () => {
    setAssistantGapFeeInput('');
    setShowAssistantFields(false);
    setDeterminedAssistantItemCode(null);
    setAssistantItemDescription(null);
    setIsLoadingAssistantItem(false);
    setErrorAssistantItem(null);
  };

  const handleCalculateEstimate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMbsItemDetails(null);
    setMedicareRebate(null);
    setHealthFundRebate(null);
    setOutOfPocket(null);
    setHasCalculated(false);
    resetAssistantStates(); // Reset assistant states

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
      // Fetch Primary Item
      const primaryResponse = await fetch(`/api/search-mbs?query=${encodeURIComponent(itemNumberInput.trim())}`);
      if (!primaryResponse.ok) {
        const errorData = await primaryResponse.json();
        throw new Error(errorData.error || `Primary item API request failed: ${primaryResponse.statusText}`);
      }
      const primaryData: SearchResultItem[] = await primaryResponse.json();

      if (primaryData.length === 0) {
        setError(`MBS Item ${itemNumberInput.trim()} not found or is not current.`);
        setMbsItemDetails(null);
        setIsLoading(false);
        return;
      }
      
      const primaryItem = primaryData[0];
      setMbsItemDetails(primaryItem);

      const calculatedMedicareRebate = primaryItem.benefit_75_percent;
      const calculatedHealthFundRebate = primaryItem.schedule_fee - primaryItem.benefit_75_percent;
      const calculatedPrimaryOutOfPocket = chargedFee - calculatedMedicareRebate - calculatedHealthFundRebate;

      setMedicareRebate(calculatedMedicareRebate);
      setHealthFundRebate(calculatedHealthFundRebate);
      setOutOfPocket(calculatedPrimaryOutOfPocket);
      setHasCalculated(true);

      // Handle Assistant Item if applicable
      if (primaryItem.is_assist_eligible) {
        setShowAssistantFields(true);
        const assistantCode = primaryItem.schedule_fee < 636.05 ? "51300" : "51303";
        setDeterminedAssistantItemCode(assistantCode);
        setIsLoadingAssistantItem(true);
        setErrorAssistantItem(null);

        try {
          const assistantResponse = await fetch(`/api/search-mbs?query=${assistantCode}`);
          if (!assistantResponse.ok) {
            const errorData = await assistantResponse.json();
            throw new Error(errorData.error || `Assistant item ${assistantCode} API request failed: ${assistantResponse.statusText}`);
          }
          const assistantData: SearchResultItem[] = await assistantResponse.json();
          if (assistantData.length > 0) {
            setAssistantItemDescription(assistantData[0].description);
          } else {
            setErrorAssistantItem(`Details for assistant item ${assistantCode} not found.`);
            setAssistantItemDescription(null);
          }
        } catch (assistErr) {
          console.error('Assistant item fetch failed:', assistErr);
          setErrorAssistantItem(assistErr instanceof Error ? assistErr.message : `Failed to fetch assistant item ${assistantCode}.`);
          setAssistantItemDescription(null);
        } finally {
          setIsLoadingAssistantItem(false);
        }
      } else {
        resetAssistantStates(); // Ensure assistant fields are hidden and reset if not eligible
      }

    } catch (err) {
      console.error('Calculation failed:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during calculation.');
      setMbsItemDetails(null);
      resetAssistantStates();
    } finally {
      setIsLoading(false);
    }
  };
  
  const assistantGapFeeValue = assistantGapFeeInput && !isNaN(parseFloat(assistantGapFeeInput)) ? parseFloat(assistantGapFeeInput) : 0;
  const totalOutOfPocket = (outOfPocket || 0) + (showAssistantFields ? assistantGapFeeValue : 0);


  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-slate-100 sm:text-5xl md:text-6xl">
          Specialist Fee Estimate
        </h1>
        <p className="mt-3 max-w-md mx-auto text-base text-gray-500 dark:text-slate-300 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
          Estimate out-of-pocket expenses for specialist services based on MBS items.
        </p>
      </header>

      <div className="max-w-xl mx-auto bg-white dark:bg-slate-800 p-6 shadow-md rounded-lg">
        <form onSubmit={handleCalculateEstimate} className="space-y-6">
          <div>
            <label htmlFor="itemNumber" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
              MBS Item Number
            </label>
            <input
              type="text"
              name="itemNumber"
              id="itemNumber"
              value={itemNumberInput}
              onChange={(e) => setItemNumberInput(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              placeholder="e.g., 30175"
            />
          </div>

          <div>
            <label htmlFor="chargedFee" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
              Your Charged Fee ($)
            </label>
            <input
              type="number"
              name="chargedFee"
              id="chargedFee"
              value={chargedFeeInput}
              onChange={(e) => setChargedFeeInput(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              placeholder="e.g., 500.00"
              step="0.01"
              min="0"
            />
          </div>

          {showAssistantFields && (
            <div>
              <label htmlFor="assistantGapFee" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                Surgical Assistant Gap Fee ($)
              </label>
              <input
                type="number"
                name="assistantGapFee"
                id="assistantGapFee"
                value={assistantGapFeeInput}
                onChange={(e) => setAssistantGapFeeInput(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                placeholder="e.g., 100.00"
                step="0.01"
                min="0"
              />
              {isLoadingAssistantItem && <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Loading assistant details...</p>}
              {errorAssistantItem && <p className="text-sm text-red-500 dark:text-red-400 mt-1">{errorAssistantItem}</p>}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              {isLoading ? 'Calculating...' : 'Calculate Estimate'}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="mt-6 max-w-xl mx-auto p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-md">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {hasCalculated && mbsItemDetails && !error && (
        <div className="mt-8 max-w-xl mx-auto bg-white dark:bg-slate-800 p-6 shadow-md rounded-lg">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-4">Estimate Results</h2>
          <div className="space-y-3 text-slate-700 dark:text-slate-300">
            <p><strong>Item Number:</strong> {mbsItemDetails.item_code}</p>
            <p className="text-sm text-gray-600 dark:text-slate-400"><strong>Description:</strong> {mbsItemDetails.description}</p>
            <hr className="my-2 dark:border-slate-600"/>
            <p><strong>Your Charged Fee (Primary):</strong> {formatCurrency(parseFloat(chargedFeeInput))}</p>
            <p><strong>MBS Schedule Fee (Primary):</strong> {formatCurrency(mbsItemDetails.schedule_fee)}</p>
            <hr className="my-2 dark:border-slate-600"/>
            <p className="text-green-600 dark:text-green-400"><strong>Medicare Rebate (Primary):</strong> {formatCurrency(medicareRebate)}</p>
            <p className="text-blue-600 dark:text-blue-400"><strong>Health Fund Rebate (Primary):</strong> {formatCurrency(healthFundRebate)}</p>
            <p className="font-semibold">Primary Service Out-of-Pocket: {formatCurrency(outOfPocket)}</p>
            
            {showAssistantFields && determinedAssistantItemCode && (
              <>
                <hr className="my-3 border-dashed dark:border-slate-700"/>
                <h3 className="text-lg font-medium text-gray-800 dark:text-slate-200">Surgical Assistant</h3>
                {assistantItemDescription && (
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    <strong>Assistant Item:</strong> {determinedAssistantItemCode} - {assistantItemDescription}
                  </p>
                )}
                {!assistantItemDescription && determinedAssistantItemCode && !isLoadingAssistantItem && !errorAssistantItem && (
                   <p className="text-sm text-gray-500 dark:text-slate-500">Assistant item {determinedAssistantItemCode} description not available.</p>
                )}
                <p><strong>Surgical Assistant Fee (Gap):</strong> {formatCurrency(assistantGapFeeValue)}</p>
              </>
            )}
            
            <hr className="my-3 dark:border-slate-600"/>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">
              Total Patient Out-of-Pocket: {formatCurrency(totalOutOfPocket)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
