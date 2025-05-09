'use client'; // This page is a Client Component because it uses hooks for state and effects

import { useState, FormEvent } from 'react';
import { SearchResultItem } from '@/types';
import ResultsDisplay from '@/components/ResultsDisplay'; // Correct path for components

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false); // To show "No results" only after a search

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!searchQuery.trim()) {
      setError('Please enter a search query.');
      setResults([]);
      setHasSearched(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await fetch(`/api/search-mbs?query=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }
      const data: SearchResultItem[] = await response.json();
      setResults(data);
    } catch (err) {
      console.error('Search failed:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
          MBS Item Search
        </h1>
        <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
          Find Australian Medicare Benefits Schedule items by item number or keywords.
        </p>
      </header>

      <div className="max-w-2xl mx-auto bg-white p-6 shadow-md rounded-lg">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label htmlFor="searchQuery" className="block text-sm font-medium text-gray-700">
              Search MBS Items (e.g., 30175 or knee surgery)
            </label>
            <div className="mt-1 flex rounded-md shadow-sm">
              <input
                type="text"
                name="searchQuery"
                id="searchQuery"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="focus:ring-indigo-500 focus:border-indigo-500 flex-1 block w-full rounded-none rounded-l-md sm:text-sm border-gray-300 px-3 py-2"
                placeholder="Enter item code or keywords"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isLoading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {hasSearched && (
        <ResultsDisplay results={results} isLoading={isLoading} error={error} />
      )}
    </div>
  );
}
