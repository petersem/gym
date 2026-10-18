import { useState } from "react";
import { FaSearch, FaSortAmountDown, FaSortAmountUp } from "react-icons/fa";

/**
 * Search box plus sort controls mapping to the API's search_term / sort_by / sort_dir.
 * Search is applied on submit; sort changes apply immediately.
 */
function SearchSortBar({
  placeholder = "search",
  sorts,
  sortBy,
  sortDir,
  onSearch,
  onSortBy,
  onSortDir,
  children,
}) {
  const [term, setTerm] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <form
        className="join w-full"
        onSubmit={(e) => {
          e.preventDefault();
          onSearch(term.trim());
        }}
      >
        <input
          type="search"
          value={term}
          maxLength={100}
          onChange={(e) => {
            setTerm(e.target.value);
            if (e.target.value === "") {
              onSearch("");
            }
          }}
          className="input join-item grow"
          placeholder={placeholder}
        />
        <button className="btn join-item" aria-label="Search">
          <FaSearch />
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        <select
          className="select select-sm w-auto grow"
          aria-label="Sort by"
          value={sortBy}
          onChange={(e) => onSortBy(e.target.value)}
        >
          {sorts.map(({ value, label }) => (
            <option key={value} value={value}>
              Sort by {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-sm"
          aria-label={sortDir === "asc" ? "Ascending" : "Descending"}
          onClick={() => onSortDir(sortDir === "asc" ? "desc" : "asc")}
        >
          {sortDir === "asc" ? <FaSortAmountUp /> : <FaSortAmountDown />}
          {sortDir}
        </button>
        {children}
      </div>
    </div>
  );
}

export default SearchSortBar;
