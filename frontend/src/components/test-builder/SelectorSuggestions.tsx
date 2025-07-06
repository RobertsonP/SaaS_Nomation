import { ProjectElement } from '../../types/element.types';

interface SelectorSuggestionsProps {
  elements: ProjectElement[];
  currentSelector: string;
  onSelectSuggestion: (selector: string, description?: string) => void;
  isVisible: boolean;
}

export function SelectorSuggestions({ 
  elements, 
  currentSelector, 
  onSelectSuggestion,
  isVisible 
}: SelectorSuggestionsProps) {
  if (!isVisible || currentSelector.length < 2) {
    return null;
  }

  const suggestions = elements
    .filter(element => {
      const selectorMatch = element.selector.toLowerCase().includes(currentSelector.toLowerCase());
      const descriptionMatch = element.description.toLowerCase().includes(currentSelector.toLowerCase());
      const textMatch = element.attributes.text?.toLowerCase().includes(currentSelector.toLowerCase());
      return selectorMatch || descriptionMatch || textMatch;
    })
    .slice(0, 5); // Limit to 5 suggestions

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs text-gray-500 font-medium">AI Suggestions</span>
      </div>
      {suggestions.map((element) => (
        <div
          key={element.id}
          onClick={() => onSelectSuggestion(element.selector, element.description)}
          className="px-3 py-2 cursor-pointer hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{element.description}</div>
              <div className="text-xs text-gray-600 font-mono truncate">{element.selector}</div>
              {element.attributes.text && (
                <div className="text-xs text-gray-500 truncate">"{element.attributes.text}"</div>
              )}
            </div>
            <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
              <span className={`px-2 py-1 text-xs rounded ${
                element.elementType === 'button' ? 'bg-blue-100 text-blue-800' :
                element.elementType === 'input' ? 'bg-green-100 text-green-800' :
                element.elementType === 'link' ? 'bg-purple-100 text-purple-800' :
                element.elementType === 'form' ? 'bg-orange-100 text-orange-800' :
                element.elementType === 'navigation' ? 'bg-indigo-100 text-indigo-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {element.elementType}
              </span>
              <span className="text-xs text-gray-500">
                {Math.round(element.confidence * 100)}%
              </span>
            </div>
          </div>
        </div>
      ))}
      
      {suggestions.length === 5 && elements.length > 5 && (
        <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
          <span className="text-xs text-gray-500">
            Showing top 5 matches. Type more to refine results.
          </span>
        </div>
      )}
    </div>
  );
}