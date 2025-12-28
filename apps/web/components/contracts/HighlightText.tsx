'use client';

import React from 'react';

interface HighlightTextProps {
  text: string;
  query: string;
  className?: string;
}

/**
 * Highlights matching text in search results
 * Supports multiple words and case-insensitive matching
 */
export function HighlightText({ text, query, className = '' }: HighlightTextProps) {
  if (!query || !text) {
    return <span className={className}>{text}</span>;
  }

  // Split query into individual words and escape regex special chars
  const searchTerms = query
    .trim()
    .split(/\s+/)
    .filter(term => term.length > 0)
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (searchTerms.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // Create regex pattern for all search terms
  const pattern = new RegExp(`(${searchTerms.join('|')})`, 'gi');
  const parts = text.split(pattern);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        // Check if this part matches any search term
        const isMatch = searchTerms.some(term => 
          new RegExp(`^${term}$`, 'i').test(part)
        );

        if (isMatch) {
          return (
            <mark
              key={index}
              className="bg-yellow-200 text-yellow-900 font-semibold px-0.5 rounded"
            >
              {part}
            </mark>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}

/**
 * Highlights matching text with a custom highlight style
 */
export function HighlightTextCustom({ 
  text, 
  query, 
  className = '',
  highlightClassName = 'bg-indigo-100 text-indigo-900 font-semibold px-0.5 rounded'
}: HighlightTextProps & { highlightClassName?: string }) {
  if (!query || !text) {
    return <span className={className}>{text}</span>;
  }

  const searchTerms = query
    .trim()
    .split(/\s+/)
    .filter(term => term.length > 0)
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (searchTerms.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const pattern = new RegExp(`(${searchTerms.join('|')})`, 'gi');
  const parts = text.split(pattern);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        const isMatch = searchTerms.some(term => 
          new RegExp(`^${term}$`, 'i').test(part)
        );

        if (isMatch) {
          return (
            <mark key={index} className={highlightClassName}>
              {part}
            </mark>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}

/**
 * Utility function to check if text contains search query
 */
export function textContainsQuery(text: string, query: string): boolean {
  if (!query || !text) return false;
  
  const searchTerms = query.trim().toLowerCase().split(/\s+/);
  const lowerText = text.toLowerCase();
  
  return searchTerms.every(term => lowerText.includes(term));
}

/**
 * Utility function to get match count
 */
export function getMatchCount(text: string, query: string): number {
  if (!query || !text) return 0;
  
  const searchTerms = query
    .trim()
    .split(/\s+/)
    .filter(term => term.length > 0)
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (searchTerms.length === 0) return 0;

  const pattern = new RegExp(searchTerms.join('|'), 'gi');
  const matches = text.match(pattern);
  
  return matches ? matches.length : 0;
}
