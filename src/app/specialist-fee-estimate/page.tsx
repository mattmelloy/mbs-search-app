'use client';

import { useState, FormEvent, useEffect } from 'react';
import { SearchResultItem } from '@/types'; // Assuming SearchResultItem is suitable

// Helper function to format currency (can be moved to a utils file later)
const formatCurrency = (amount: number | null | undefined) => {
  if (amount == null || isNaN(amount)) return 'N/A';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount);
};

interface PrimaryItemCalculatedData {
  item: SearchResultItem;
  originalIndex: number; // To keep track of which input field it came from
  effectiveScheduleFee: number;
  medicareRebate: number;
  healthFundRebate: number;
  itemOOP: number; // OOP based on effectiveScheduleFee - rebates for this item
}

export default function SpecialistFeeEstimatePage() {
  const [itemNumberInputs, setItemNumberInputs] = useState<string[]>(['', '', '']);
  const [totalSurgicalFeeInput, setTotalSurgicalFeeInput] = useState('');
  
  // Store details for each fetched primary item, plus their calculated/scaled values
  const [primaryItemsData, setPrimaryItemsData] = useState<PrimaryItemCalculatedData[]>([]);
  
  // Overall totals based on the sum of primary items and assistant
  const [overallTotalMedicareRebate, setOverallTotalMedicareRebate] = useState<number | null>(null);
  const [overallTotalHealthFundRebate, setOverallTotalHealthFundRebate] = useState<number | null>(null);
  const [overallTotalPatientOutOfPocket, setOverallTotalPatientOutOfPocket] = useState<number | null>(null);
  const [totalPrimaryItemsEffectiveScheduleFee, setTotalPrimaryItemsEffectiveScheduleFee] = useState<number | null>(null);


  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCalculated, setHasCalculated] = useState(false);

  // Assistant Fee States
  const [assistantAdditionalFeeInput, setAssistantAdditionalFeeInput] = useState('');
  const [showAssistantFields, setShowAssistantFields] = useState(false);
  const [determinedAssistantItemCode, setDeterminedAssistantItemCode] = useState<string | null>(null);
  const [assistantItemDetails, setAssistantItemDetails] = useState<SearchResultItem | null>(null); // For 51300
  const [assistantItemDescription, setAssistantItemDescription] = useState<string | null>(null); // For 51303 description or 51300
  const [calculatedAssistantRuleFee, setCalculatedAssistantRuleFee] = useState<number | null>(null);
  
  const [assistantChargedFeeToUse, setAssistantChargedFeeToUse] = useState<number | null>(null);
  const [assistantMedicareRebate, setAssistantMedicareRebate] = useState<number | null>(null);
  const [assistantHealthFundRebate, setAssistantHealthFundRebate] = useState<number | null>(null);
  const [assistantOutOfPocket, setAssistantOutOfPocket] = useState<number | null>(null);

  const [isLoadingAssistantItem, setIsLoadingAssistantItem] = useState(false);
  const [errorAssistantItem, setErrorAssistantItem] = useState<string | null>(null);
  const [prevHighestFeeItemCodeForAssist, setPrevHighestFeeItemCodeForAssist] = useState<string | null>(null);


  const resetAllCalculatedStates = () => {
    setPrimaryItemsData([]);
    setOverallTotalMedicareRebate(null);
    setOverallTotalHealthFundRebate(null);
    setOverallTotalPatientOutOfPocket(null);
    setTotalPrimaryItemsEffectiveScheduleFee(null);
    setHasCalculated(false);
    setError(null);

    // Reset assistant states (but NOT assistantAdditionalFeeInput here)
    setShowAssistantFields(false);
    setDeterminedAssistantItemCode(null);
    setAssistantItemDetails(null);
    setAssistantItemDescription(null);
    setCalculatedAssistantRuleFee(null);
    setAssistantChargedFeeToUse(null);
    setAssistantMedicareRebate(null);
    setAssistantHealthFundRebate(null);
    setAssistantOutOfPocket(null);
    setIsLoadingAssistantItem(false);
    setErrorAssistantItem(null);
  };

  const handleItemNumberChange = (index: number, value: string) => {
    const newItemNumberInputs = [...itemNumberInputs];
    newItemNumberInputs[index] = value;
    setItemNumberInputs(newItemNumberInputs);
  };

  const handleCalculateEstimate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    // Store current assistant gap before resetting other states
    const currentAssistantGap = assistantAdditionalFeeInput; 

    resetAllCalculatedStates(); 
    // After resetAllCalculatedStates, assistantAdditionalFeeInput is still preserved in its own state
    // We will decide later if it needs to be cleared based on primary item changes.

    const activeItemInputs = itemNumberInputs.filter(item => item.trim() !== '');
    if (activeItemInputs.length === 0) {
      setError('Please enter at least one MBS Item Number.');
      return;
    }
    if (!totalSurgicalFeeInput.trim()) {
      setError('Please enter the Total Surgical Fee Charged.');
      return;
    }

    const totalChargedFeeNum = parseFloat(totalSurgicalFeeInput);
    if (isNaN(totalChargedFeeNum) || totalChargedFeeNum < 0) {
      setError('Please enter a valid positive number for Total Surgical Fee Charged.');
      return;
    }

    setIsLoading(true);

    try {
      const fetchedItemsPromises = activeItemInputs.map((itemNo, index) =>
        fetch(`/api/search-mbs?query=${encodeURIComponent(itemNo.trim())}`)
          .then(res => {
            if (!res.ok) throw new Error(`Item ${itemNo} fetch failed: ${res.statusText}`);
            return res.json();
          })
          .then((data: SearchResultItem[]) => {
            if (data.length === 0) throw new Error(`Item ${itemNo} not found or not current.`);
            // Return an object that includes the original index to map back later if needed,
            // though for sorting by schedule_fee, original index might not be directly used in sorting.
            // We'll add originalIndex when creating PrimaryItemCalculatedData
            return data[0]; 
          })
      );

      const fetchedItemsResults = await Promise.allSettled(fetchedItemsPromises);
      
      const validFetchedItems: SearchResultItem[] = [];
      let fetchError = false;
      fetchedItemsResults.forEach(result => {
        if (result.status === 'fulfilled') {
          validFetchedItems.push(result.value);
        } else {
          setError((prevError) => (prevError ? `${prevError}\n${result.reason.message}` : result.reason.message));
          fetchError = true;
        }
      });

      if (fetchError || validFetchedItems.length === 0) {
        setIsLoading(false);
        return;
      }

      // Sort by original schedule fee descending for multiple operation rule
      const sortedPrimaryItems = [...validFetchedItems].sort((a, b) => b.schedule_fee - a.schedule_fee);

      let currentTotalPrimaryItemsEffectiveScheduleFee = 0;
      const calculatedPrimaryItemsData: PrimaryItemCalculatedData[] = sortedPrimaryItems.map((item, index) => {
        let scale = 1.0; // 100%
        if (index === 1) scale = 0.5; // 50%
        else if (index >= 2) scale = 0.25; // 25%

        const effectiveScheduleFee = item.schedule_fee * scale;
        const medicareRebateForItem = effectiveScheduleFee * 0.75;
        const healthFundRebateForItem = effectiveScheduleFee * 0.25; // Rebates sum to effective schedule fee
        const itemOOP = 0; // Placeholder: OOP per item is complex with a single total charged fee

        currentTotalPrimaryItemsEffectiveScheduleFee += effectiveScheduleFee;
        
        // Find original input index - this is a bit complex if inputs can be sparse
        // For now, let's assume we'll display them in the sorted order of calculation
        // Or, we can map back if we stored original indices with fetchedItems
        const originalInputItem = itemNumberInputs.findIndex(inputVal => inputVal.trim() === item.item_code);

        return {
          item,
          originalIndex: originalInputItem !== -1 ? originalInputItem : index, // Fallback to sorted index
          effectiveScheduleFee,
          medicareRebate: medicareRebateForItem,
          healthFundRebate: healthFundRebateForItem,
          itemOOP,
        };
      });
      
      setPrimaryItemsData(calculatedPrimaryItemsData);
      setTotalPrimaryItemsEffectiveScheduleFee(currentTotalPrimaryItemsEffectiveScheduleFee);
      setHasCalculated(true); // Mark that primary calculations are done

      // Assistant Logic (based on the highest schedule fee item from original list and total effective fee)
      const highestScheduleFeePrimaryItem = sortedPrimaryItems[0]; 

      if (highestScheduleFeePrimaryItem?.is_assist_eligible) {
        setShowAssistantFields(true);
        
        // Conditionally reset assistantAdditionalFeeInput
        if (highestScheduleFeePrimaryItem.item_code !== prevHighestFeeItemCodeForAssist) {
          setAssistantAdditionalFeeInput(''); // Clear gap if main assist item changed
        } else {
          setAssistantAdditionalFeeInput(currentAssistantGap); // Restore if context is same
        }
        setPrevHighestFeeItemCodeForAssist(highestScheduleFeePrimaryItem.item_code);

        setIsLoadingAssistantItem(true);
        setErrorAssistantItem(null);
        
        const assistantCodeRule = currentTotalPrimaryItemsEffectiveScheduleFee < 636.05 ? "51300" : "51303";
        setDeterminedAssistantItemCode(assistantCodeRule);

        try {
          const assistantResponse = await fetch(`/api/search-mbs?query=${assistantCodeRule}`);
          if (!assistantResponse.ok) {
            const errorData = await assistantResponse.json();
            throw new Error(errorData.error || `Assistant item ${assistantCodeRule} API request failed: ${assistantResponse.statusText}`);
          }
          const assistantData: SearchResultItem[] = await assistantResponse.json();

          if (assistantData.length > 0) {
            const fetchedAssistantItem = assistantData[0];
            setAssistantItemDescription(fetchedAssistantItem.description);
            if (assistantCodeRule === "51300") {
              setAssistantItemDetails(fetchedAssistantItem); // Store full details for 51300
              setCalculatedAssistantRuleFee(fetchedAssistantItem.schedule_fee);
            } else { // 51303
              setAssistantItemDetails(null); // No specific schedule fee from 51303 itself is used for rule fee
              // Use highestScheduleFeePrimaryItem here for the 20% calculation base
              setCalculatedAssistantRuleFee(highestScheduleFeePrimaryItem.schedule_fee * 0.20); 
            }
          } else {
            setErrorAssistantItem(`Details for assistant item ${assistantCodeRule} not found.`);
            setAssistantItemDescription(null);
            setAssistantItemDetails(null);
            setCalculatedAssistantRuleFee(null);
          }
        } catch (assistErr) {
          console.error('Assistant item fetch failed:', assistErr);
          setErrorAssistantItem(assistErr instanceof Error ? assistErr.message : `Failed to fetch assistant item ${assistantCodeRule}.`);
          setAssistantItemDescription(null);
          setAssistantItemDetails(null);
          setCalculatedAssistantRuleFee(null);
        } finally {
          setIsLoadingAssistantItem(false);
        }
      } else {
        resetAllCalculatedStates(); 
        setPrevHighestFeeItemCodeForAssist(null); // No assist context
        setAssistantAdditionalFeeInput(''); // Clear gap if no assist
      }

    } catch (err) {
      console.error('Calculation failed:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during calculation.');
      resetAllCalculatedStates(); 
    } finally {
      setIsLoading(false);
    }
  };
  
  // useEffect to calculate assistant fees when relevant states change
  useEffect(() => { 
    if (!showAssistantFields || calculatedAssistantRuleFee === null) {
      setAssistantChargedFeeToUse(null);
      setAssistantMedicareRebate(null);
      setAssistantHealthFundRebate(null);
      setAssistantOutOfPocket(null);
      return;
    }

    let actualAssistantChargedFee = calculatedAssistantRuleFee;
    const additionalFeeNum = parseFloat(assistantAdditionalFeeInput);
    if (!isNaN(additionalFeeNum) && assistantAdditionalFeeInput.trim() !== '') {
      actualAssistantChargedFee = calculatedAssistantRuleFee + additionalFeeNum;
    }
    setAssistantChargedFeeToUse(actualAssistantChargedFee);

    let assMedicareRebate = 0;
    let assHealthFundRebate = 0;

    if (determinedAssistantItemCode === "51300" && assistantItemDetails) { 
      assMedicareRebate = assistantItemDetails.benefit_75_percent;
      assHealthFundRebate = assistantItemDetails.schedule_fee - assistantItemDetails.benefit_75_percent;
    } else if (determinedAssistantItemCode === "51303" && calculatedAssistantRuleFee !== null) { 
      assMedicareRebate = calculatedAssistantRuleFee * 0.75;
      assHealthFundRebate = calculatedAssistantRuleFee * 0.25;
    }
    setAssistantMedicareRebate(assMedicareRebate);
    setAssistantHealthFundRebate(assHealthFundRebate);
    
    const assOOP = actualAssistantChargedFee - (assMedicareRebate + assHealthFundRebate);
    setAssistantOutOfPocket(assOOP);

  }, [showAssistantFields, calculatedAssistantRuleFee, assistantAdditionalFeeInput, assistantItemDetails, determinedAssistantItemCode]);
  
  useEffect(() => {
    if (!hasCalculated || primaryItemsData.length === 0) { // Check primaryItemsData length
      setOverallTotalMedicareRebate(null);
      setOverallTotalHealthFundRebate(null);
      setOverallTotalPatientOutOfPocket(null);
      return;
    }

    const sumPrimaryMedicare = primaryItemsData.reduce((sum, data) => sum + (data?.medicareRebate || 0), 0);
    const sumPrimaryHealthFund = primaryItemsData.reduce((sum, data) => sum + (data?.healthFundRebate || 0), 0);
    
    const finalTotalMedicare = sumPrimaryMedicare + (assistantMedicareRebate || 0);
    const finalTotalHealthFund = sumPrimaryHealthFund + (assistantHealthFundRebate || 0);
    
    setOverallTotalMedicareRebate(finalTotalMedicare);
    setOverallTotalHealthFundRebate(finalTotalHealthFund);

    const totalSurgicalFeeNum = parseFloat(totalSurgicalFeeInput); // Use totalSurgicalFeeInput
    const actualTotalChargedForAllServices = (isNaN(totalSurgicalFeeNum) ? 0 : totalSurgicalFeeNum) + (assistantChargedFeeToUse || 0);
    
    const finalTotalOOP = actualTotalChargedForAllServices - finalTotalMedicare - finalTotalHealthFund;
    setOverallTotalPatientOutOfPocket(finalTotalOOP);

  }, [hasCalculated, primaryItemsData, assistantMedicareRebate, assistantHealthFundRebate, totalSurgicalFeeInput, assistantChargedFeeToUse]);


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

      <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 p-6 shadow-md rounded-lg"> {/* Increased max-width for more inputs */}
        <form onSubmit={handleCalculateEstimate} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {itemNumberInputs.map((itemNo, index) => (
              <div key={index}>
                <label htmlFor={`itemNumber${index + 1}`} className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                  Item Number {index + 1}
                </label>
                <input
                  type="text"
                  name={`itemNumber${index + 1}`}
                  id={`itemNumber${index + 1}`}
                  value={itemNo}
                  onChange={(e) => handleItemNumberChange(index, e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                  placeholder="e.g., 30175"
                />
              </div>
            ))}
          </div>

          <div>
            <label htmlFor="totalSurgicalFee" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
              Total Surgical Fee Charged (for all items above) ($)
            </label>
            <input
              type="number"
              name="totalSurgicalFee"
              id="totalSurgicalFee"
              value={totalSurgicalFeeInput}
              onChange={(e) => setTotalSurgicalFeeInput(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
              placeholder="e.g., 1500.00"
              step="0.01"
              min="0"
            />
          </div>
          
          {showAssistantFields && (
            <div>
              {calculatedAssistantRuleFee !== null && (
                <p className="text-sm text-gray-600 dark:text-slate-400 mt-2 mb-1">
                  Calculated Assistant MBS Fee (Item {determinedAssistantItemCode}): {formatCurrency(calculatedAssistantRuleFee)}
                </p>
              )}
              <label htmlFor="assistantAdditionalFee" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                Additional Assistant Fee (Gap) ($)
              </label>
              <input
                type="number"
                name="assistantAdditionalFee"
                id="assistantAdditionalFee"
                value={assistantAdditionalFeeInput}
                onChange={(e) => setAssistantAdditionalFeeInput(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-slate-700 dark:text-slate-200 dark:placeholder-slate-400"
                placeholder="e.g. 100.00 (added to MBS fee)"
                step="0.01"
                min="0"
              />
              {isLoadingAssistantItem && <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Loading assistant item details...</p>}
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

      {hasCalculated && primaryItemsData.length > 0 && !error && (
        <div className="mt-8 max-w-4xl mx-auto bg-white dark:bg-slate-800 p-6 shadow-md rounded-lg"> {/* Increased max-width for table */}
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-6 text-center">
            Fee Estimate Invoice
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">Item No.</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">Description</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">Charged Fee</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">Medicare Rebate</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">Health Fund Rebate</th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">Est. OOP (Item)</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                {primaryItemsData.map((data, index) => {
                  if (!data) return null;
                  const isSinglePrimaryItem = primaryItemsData.filter(d => d !== null).length === 1;
                  const chargedFeeForThisItem = isSinglePrimaryItem ? parseFloat(totalSurgicalFeeInput) : null;
                  const oopForThisItem = isSinglePrimaryItem && chargedFeeForThisItem !== null && !isNaN(chargedFeeForThisItem)
                    ? chargedFeeForThisItem - data.medicareRebate - data.healthFundRebate
                    : data.itemOOP;
                  return (
                    <tr key={data.item.item_code + '-' + index}> {/* Ensure unique key */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-slate-200">{data.item.item_code}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-300 max-w-xs truncate" title={data.item.description}>{data.item.description}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-slate-300 text-right">
                        {isSinglePrimaryItem ? formatCurrency(chargedFeeForThisItem) : "N/A (Part of Total)"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600 dark:text-green-400 text-right">{formatCurrency(data.medicareRebate)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400 text-right">{formatCurrency(data.healthFundRebate)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600 dark:text-red-400 text-right font-semibold">
                        {formatCurrency(oopForThisItem)}
                      </td>
                    </tr>
                  );
                })}

                {/* Assistant Row (Conditional) */}
                {showAssistantFields && determinedAssistantItemCode && assistantChargedFeeToUse !== null && (
                  <tr>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-slate-200">{determinedAssistantItemCode}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-slate-300 max-w-xs truncate" title={assistantItemDescription || undefined}>{assistantItemDescription || 'Surgical Assistant'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-slate-300 text-right">{formatCurrency(assistantChargedFeeToUse)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600 dark:text-green-400 text-right">{formatCurrency(assistantMedicareRebate)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400 text-right">{formatCurrency(assistantHealthFundRebate)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600 dark:text-red-400 text-right font-semibold">{formatCurrency(assistantOutOfPocket)}</td>
                  </tr>
                )}
              </tbody>
              {/* Footer for Totals */}
              <tfoot className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-slate-200 uppercase">Totals:</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-700 dark:text-slate-200">{formatCurrency(parseFloat(totalSurgicalFeeInput) + (assistantChargedFeeToUse || 0) )}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-green-600 dark:text-green-400">{formatCurrency(overallTotalMedicareRebate)}</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-blue-600 dark:text-blue-400">{formatCurrency(overallTotalHealthFundRebate)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600 dark:text-red-400 text-right font-bold">{formatCurrency(overallTotalPatientOutOfPocket)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
